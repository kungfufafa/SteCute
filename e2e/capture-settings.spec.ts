import { expect, test, type Page } from '@playwright/test'

type SettingsTestWindow = typeof window & {
  __settingsMedia?: MediaStream[]
  __holdSettingsStill?: boolean
  __releaseSettingsStill?: () => void
  __failSettingsShotDelete?: boolean
}

test.use({
  launchOptions: {
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  },
})

async function observeCamera(page: Page) {
  await page.addInitScript(() => {
    const state = window as SettingsTestWindow
    state.__settingsMedia = []
    const originalMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await originalMedia(constraints)
      state.__settingsMedia!.push(stream)
      return stream
    }

    const originalBlob = HTMLCanvasElement.prototype.toBlob
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      if (!state.__holdSettingsStill || type !== 'image/jpeg') {
        return originalBlob.call(this, callback, type, quality)
      }
      state.__holdSettingsStill = false
      originalBlob.call(
        this,
        (blob) => {
          state.__releaseSettingsStill = () => {
            delete state.__releaseSettingsStill
            callback(blob)
          }
        },
        type,
        quality,
      )
    }

    const originalDelete = IDBObjectStore.prototype.delete
    IDBObjectStore.prototype.delete = function (key) {
      if (this.name === 'shots' && state.__failSettingsShotDelete) {
        state.__failSettingsShotDelete = false
        throw new DOMException('Simulated source photo write failure', 'UnknownError')
      }
      return originalDelete.call(this, key)
    }
  })
}

async function cameraTracks(page: Page) {
  return page.evaluate(() => {
    const stream = (window as SettingsTestWindow).__settingsMedia
      ?.filter((candidate) =>
        candidate.getVideoTracks().some((track) => track.readyState === 'live'),
      )
      .at(-1)
    return {
      videoId: stream?.getVideoTracks()[0]?.id ?? null,
      audioId: stream?.getAudioTracks()[0]?.id ?? null,
      audioEnabled: stream?.getAudioTracks()[0]?.enabled ?? null,
    }
  })
}

async function soloSnapshot(page: Page) {
  return page.evaluate(async () => {
    const sessionId = sessionStorage.getItem('stecute.activeSessionId')
    const request = indexedDB.open('stecute-db')
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      const transaction = database.transaction(['sessions', 'shots'])
      const sessionRequest = transaction.objectStore('sessions').get(sessionId!)
      const shotsRequest = transaction.objectStore('shots').getAll()
      const [session, shots] = await Promise.all([
        new Promise<{ layoutId: string; templateId: string; slotCount: number }>(
          (resolve, reject) => {
            sessionRequest.onsuccess = () => resolve(sessionRequest.result)
            sessionRequest.onerror = () => reject(sessionRequest.error)
          },
        ),
        new Promise<Array<{ id: string; sessionId: string; order: number; blob: Blob }>>(
          (resolve, reject) => {
            shotsRequest.onsuccess = () => resolve(shotsRequest.result)
            shotsRequest.onerror = () => reject(shotsRequest.error)
          },
        ),
      ])
      return {
        sessionId,
        layoutId: session?.layoutId,
        templateId: session?.templateId,
        slotCount: session?.slotCount,
        shots: shots
          .filter((shot) => shot.sessionId === sessionId)
          .sort((left, right) => left.order - right.order)
          .map((shot) => ({ id: shot.id, order: shot.order, size: shot.blob?.size })),
        flow: JSON.parse(sessionStorage.getItem('stecute.cameraFlow') ?? 'null') as {
          countdownSeconds: number
          autoCapture: boolean
        } | null,
      }
    } finally {
      database.close()
    }
  })
}

function editor(page: Page) {
  return page.getByTestId('capture-session-editor')
}

function openSettingsButton(page: Page) {
  return page.getByRole('button', { name: 'Ubah pengaturan sesi', exact: true })
}

async function openSettings(page: Page) {
  await openSettingsButton(page).click()
  await expect(editor(page)).toBeVisible()
}

async function holdNextStill(page: Page) {
  await page.evaluate(() => {
    ;(window as SettingsTestWindow).__holdSettingsStill = true
  })
}

async function waitForHeldStill(page: Page) {
  await expect
    .poll(() => page.evaluate(() => Boolean((window as SettingsTestWindow).__releaseSettingsStill)))
    .toBe(true)
}

async function releaseStill(page: Page) {
  await page.evaluate(() => (window as SettingsTestWindow).__releaseSettingsStill!())
}

async function expectEditorLocked(page: Page) {
  await expect(openSettingsButton(page)).toBeDisabled()
  const gear = page.getByRole('button', { name: 'Ubah setup sesi', exact: true })
  await expect(gear).toBeDisabled()
  await gear.dispatchEvent('click')
  await expect(editor(page)).toBeHidden()
}

async function enterDuet(host: Page, slotCount: 2 | 3) {
  await observeCamera(host)
  await host.goto('/booth')
  await host.getByRole('button', { name: 'Buat Booth', exact: true }).click()
  await host.getByRole('button', { name: `Classic ${slotCount} foto`, exact: true }).click()
  await host.getByRole('button', { name: '3s', exact: true }).click()
  await host
    .getByRole('button', { name: 'Buka Booth', exact: true })
    .filter({ visible: true })
    .click()
  const guest = await host.context().newPage()
  await observeCamera(guest)
  await guest.goto(await host.getByTestId('booth-invite-url').inputValue())
  await expect(host.getByRole('button', { name: 'Mulai pose', exact: true })).toBeEnabled({
    timeout: 15_000,
  })
  return guest
}

async function captureDuet(host: Page, guest: Page) {
  const start = host.getByRole('button', { name: 'Mulai pose', exact: true })
  await expect(start).toBeEnabled({ timeout: 15_000 })
  await start.click()
  await expect(host.getByTestId('booth-countdown')).toBeVisible()
  await expect(guest.getByTestId('booth-countdown')).toBeVisible()
  await expect(host.getByTestId('booth-countdown')).toBeHidden({ timeout: 15_000 })
  await expect(guest.getByTestId('booth-countdown')).toBeHidden({ timeout: 15_000 })
}

async function confirmRestart(page: Page, accept: boolean) {
  let confirmation = ''
  page.once('dialog', async (dialog) => {
    confirmation = dialog.message()
    if (accept) await dialog.accept()
    else await dialog.dismiss()
  })
  await page.getByRole('button', { name: 'Ulang semua foto', exact: true }).click()
  expect(confirmation).toContain('Ulang semua foto?')
}

async function expectPhotoSettingsLocked(page: Page) {
  await expect(page.getByTestId('capture-session-locked')).toBeVisible()
  await expectEditorLocked(page)
  await openSettingsButton(page).dispatchEvent('click')
  await expect(editor(page)).toBeHidden()
}

test.describe('capture settings lock after the first photo', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Uses Chromium fake cameras and audio')
  test.setTimeout(60_000)

  test.beforeEach(async ({ context }) => {
    // Use the local browser channel so room synchronization does not depend on a relay service.
    await context.route(/\/api\/booth-relay\/|peerjs/i, (route) => route.abort())
  })

  test('Solo edits before capture, persists configuration, then keeps every setting locked after the first photo and reload', async ({
    page,
  }) => {
    await observeCamera(page)
    await page.goto('/camera')
    const shutter = page.getByRole('button', { name: 'Ambil foto', exact: true })
    await expect(shutter).toBeEnabled()
    const originalCamera = await cameraTracks(page)
    const original = await soloSnapshot(page)
    expect(originalCamera.videoId).toBeTruthy()

    await openSettings(page)
    await expect(shutter).toBeDisabled()
    await page.locator('body').dispatchEvent('keydown', { key: ' ', bubbles: true })
    await expect(page.getByTestId('camera-countdown')).toBeHidden()
    await editor(page).getByRole('combobox', { name: 'Frame', exact: true }).selectOption('youth')
    await editor(page)
      .getByRole('combobox', { name: 'Jumlah pose', exact: true })
      .selectOption('strip-4-vertical')
    await editor(page).getByRole('combobox', { name: 'Timer', exact: true }).selectOption('5')
    await editor(page).getByRole('checkbox', { name: 'Ambil foto otomatis', exact: true }).check()
    expect(await soloSnapshot(page)).toEqual(original)
    await editor(page).getByRole('button', { name: 'Batal', exact: true }).click()
    expect(await soloSnapshot(page)).toEqual(original)

    await openSettings(page)
    await expect(editor(page).getByRole('combobox', { name: 'Frame', exact: true })).toHaveValue(
      'classic',
    )
    await expect(
      editor(page).getByRole('combobox', { name: 'Jumlah pose', exact: true }),
    ).toHaveValue('strip-3-vertical')
    await expect(editor(page).getByRole('combobox', { name: 'Timer', exact: true })).toHaveValue(
      '3',
    )
    await expect(
      editor(page).getByRole('checkbox', { name: 'Ambil foto otomatis', exact: true }),
    ).not.toBeChecked()
    await editor(page).getByRole('combobox', { name: 'Frame', exact: true }).selectOption('youth')
    await editor(page)
      .getByRole('combobox', { name: 'Jumlah pose', exact: true })
      .selectOption('strip-4-vertical')
    await editor(page).getByRole('combobox', { name: 'Timer', exact: true }).selectOption('5')
    await editor(page).getByRole('checkbox', { name: 'Ambil foto otomatis', exact: true }).check()
    await editor(page).getByRole('button', { name: 'Terapkan', exact: true }).click()
    await expect(editor(page)).toBeHidden()
    await expect(page).toHaveURL('/camera')
    await expect
      .poll(() => soloSnapshot(page))
      .toMatchObject({
        sessionId: original.sessionId,
        templateId: 'youth',
        layoutId: 'strip-4-vertical',
        slotCount: 4,
        shots: [],
        flow: { countdownSeconds: 5, autoCapture: true },
      })
    expect(await cameraTracks(page)).toEqual(originalCamera)

    const applied = await soloSnapshot(page)
    await page.reload()
    await expect(shutter).toBeEnabled()
    expect(await soloSnapshot(page)).toEqual(applied)
    await openSettings(page)
    await expect(editor(page).getByRole('combobox', { name: 'Frame', exact: true })).toHaveValue(
      'youth',
    )
    await expect(
      editor(page).getByRole('combobox', { name: 'Jumlah pose', exact: true }),
    ).toHaveValue('strip-4-vertical')
    await expect(editor(page).getByRole('combobox', { name: 'Timer', exact: true })).toHaveValue(
      '5',
    )
    await expect(
      editor(page).getByRole('checkbox', { name: 'Ambil foto otomatis', exact: true }),
    ).toBeChecked()
    await editor(page).getByRole('combobox', { name: 'Timer', exact: true }).selectOption('3')
    await editor(page).getByRole('checkbox', { name: 'Ambil foto otomatis', exact: true }).uncheck()
    await editor(page).getByRole('button', { name: 'Terapkan', exact: true }).click()

    const cameraBeforeCapture = await cameraTracks(page)
    await holdNextStill(page)
    await shutter.click()
    await expect(page.getByTestId('camera-countdown')).toBeVisible()
    await expectEditorLocked(page)
    await waitForHeldStill(page)
    await expect(page.getByTestId('camera-countdown')).toBeHidden()
    await expectEditorLocked(page)
    await releaseStill(page)
    await expect(page.getByRole('heading', { name: 'Foto 2 dari 4', exact: true })).toBeVisible()
    await expectPhotoSettingsLocked(page)
    await expect.poll(async () => (await soloSnapshot(page)).shots.length).toBe(1)
    const captured = await soloSnapshot(page)
    expect(await cameraTracks(page)).toEqual(cameraBeforeCapture)

    await page.reload()
    await expect(shutter).toBeEnabled()
    await expectPhotoSettingsLocked(page)
    expect(await soloSnapshot(page)).toEqual(captured)
    await expect(
      page.getByRole('button', { name: 'Pilih efek Hangat', exact: true }),
    ).toBeDisabled()
    await expect(
      page.getByRole('button', { name: 'Pilih overlay Hati', exact: true }),
    ).toBeDisabled()
  })

  test('Solo unlocks only after a confirmed successful reset and keeps the live camera', async ({
    page,
  }) => {
    await observeCamera(page)
    await page.goto('/camera')
    const shutter = page.getByRole('button', { name: 'Ambil foto', exact: true })
    await expect(shutter).toBeEnabled()
    await shutter.click()
    await expect(page.getByRole('heading', { name: 'Foto 2 dari 3', exact: true })).toBeVisible({
      timeout: 15_000,
    })
    await expectPhotoSettingsLocked(page)
    const captured = await soloSnapshot(page)
    const camera = await cameraTracks(page)
    expect(captured.shots).toHaveLength(1)

    await confirmRestart(page, false)
    await expectPhotoSettingsLocked(page)
    expect(await soloSnapshot(page)).toEqual(captured)
    expect(await cameraTracks(page)).toEqual(camera)

    await page.evaluate(() => {
      ;(window as SettingsTestWindow).__failSettingsShotDelete = true
    })
    await confirmRestart(page, true)
    await expect(
      page.getByText('Foto belum bisa diulang. Foto sebelumnya masih tersedia. Coba lagi.', {
        exact: true,
      }),
    ).toBeVisible()
    await expectPhotoSettingsLocked(page)
    expect(await soloSnapshot(page)).toEqual(captured)
    expect(await cameraTracks(page)).toEqual(camera)

    await confirmRestart(page, true)
    await expect(page.getByTestId('capture-session-locked')).toBeHidden()
    await expect(page.getByRole('heading', { name: 'Foto 1 dari 3', exact: true })).toBeVisible()
    await expect.poll(() => soloSnapshot(page)).toEqual({ ...captured, shots: [] })
    expect(await cameraTracks(page)).toEqual(camera)
    await expect(page).toHaveURL('/camera')
    if (!(await editor(page).isVisible())) await openSettings(page)
    await editor(page).getByRole('combobox', { name: 'Frame', exact: true }).selectOption('mono')
    await editor(page)
      .getByRole('combobox', { name: 'Jumlah pose', exact: true })
      .selectOption('strip-2-vertical')
    await editor(page).getByRole('button', { name: 'Terapkan', exact: true }).click()
    await expect
      .poll(() => soloSnapshot(page))
      .toMatchObject({ templateId: 'mono', slotCount: 2, shots: [] })
    expect(await cameraTracks(page)).toEqual(camera)
  })

  test('Duet locks both participants after capture and host resets both without replacing the room or audio', async ({
    page: host,
  }) => {
    const guest = await enterDuet(host, 2)
    const roomUrl = host.url()
    await expect(openSettingsButton(guest)).toHaveCount(0)
    await expect(guest.getByRole('button', { name: 'Ubah setup sesi', exact: true })).toHaveCount(0)
    await expect(guest.getByRole('button', { name: 'Ulang semua foto', exact: true })).toHaveCount(
      0,
    )
    await host.getByTestId('booth-microphone-toggle').click()
    await guest.getByTestId('booth-microphone-toggle').click()
    const hostCamera = await cameraTracks(host)
    const guestCamera = await cameraTracks(guest)

    await openSettings(host)
    await expect(host.getByRole('button', { name: 'Mulai pose', exact: true })).toBeDisabled()
    await editor(host).getByRole('combobox', { name: 'Frame', exact: true }).selectOption('mono')
    await editor(host).getByRole('combobox', { name: 'Timer', exact: true }).selectOption('5')
    await editor(host).getByRole('checkbox', { name: 'Ambil foto otomatis', exact: true }).check()
    await editor(host).getByRole('button', { name: 'Batal', exact: true }).click()
    await openSettings(host)
    await expect(editor(host).getByRole('combobox', { name: 'Frame', exact: true })).toHaveValue(
      'classic',
    )
    await expect(editor(host).getByRole('combobox', { name: 'Timer', exact: true })).toHaveValue(
      '3',
    )
    await expect(
      editor(host).getByRole('checkbox', { name: 'Ambil foto otomatis', exact: true }),
    ).not.toBeChecked()
    await editor(host).getByRole('combobox', { name: 'Frame', exact: true }).selectOption('mono')
    await editor(host).getByRole('combobox', { name: 'Timer', exact: true }).selectOption('5')
    await editor(host).getByRole('checkbox', { name: 'Ambil foto otomatis', exact: true }).check()
    await editor(host).getByRole('button', { name: 'Terapkan', exact: true }).click()
    const guestSummary = guest.getByTestId('booth-session-summary')
    await expect(guestSummary).toContainText('Mono')
    await expect(guestSummary).toContainText('5')
    await expect(guestSummary).toContainText('Otomatis')
    await openSettings(host)
    await editor(host).getByRole('combobox', { name: 'Timer', exact: true }).selectOption('3')
    await editor(host).getByRole('checkbox', { name: 'Ambil foto otomatis', exact: true }).uncheck()
    await editor(host).getByRole('button', { name: 'Terapkan', exact: true }).click()
    await expect(guestSummary).toContainText('3 detik')
    await expect(guestSummary).toContainText('Manual')

    await holdNextStill(guest)
    await host.getByRole('button', { name: 'Mulai pose', exact: true }).click()
    await expect(host.getByTestId('booth-countdown')).toBeVisible()
    await expectEditorLocked(host)
    await waitForHeldStill(guest)
    await expect(
      host.getByRole('button', { name: 'Menyiapkan foto bersama…', exact: true }),
    ).toBeDisabled()
    await expectEditorLocked(host)
    await releaseStill(guest)
    await expect(host.getByRole('button', { name: 'Mulai pose', exact: true })).toBeEnabled({
      timeout: 15_000,
    })
    await expectPhotoSettingsLocked(host)
    await expect(guest.getByTestId('capture-session-locked')).toBeVisible()
    await confirmRestart(host, false)
    await expectPhotoSettingsLocked(host)
    await expect(guest.getByTestId('capture-session-locked')).toBeVisible()
    await expect(guestSummary).toContainText('Mono')

    await confirmRestart(host, true)
    await expect(host.getByTestId('capture-session-locked')).toBeHidden()
    await expect(guest.getByTestId('capture-session-locked')).toBeHidden()
    for (const participant of [host, guest]) {
      await expect(participant).toHaveURL(roomUrl)
      await expect(participant.getByTestId('booth-microphone-toggle')).toHaveAttribute(
        'aria-pressed',
        'true',
      )
    }
    expect(await cameraTracks(host)).toEqual(hostCamera)
    expect(await cameraTracks(guest)).toEqual(guestCamera)
    if (!(await editor(host).isVisible())) await openSettings(host)
    await editor(host).getByRole('combobox', { name: 'Frame', exact: true }).selectOption('youth')
    await editor(host).getByRole('button', { name: 'Terapkan', exact: true }).click()
    await expect(guestSummary).toContainText('Youth')

    // Both peers must discard the old photo: one fresh pose cannot complete a two-pose session.
    await captureDuet(host, guest)
    await expect(host.getByRole('button', { name: 'Mulai pose', exact: true })).toBeEnabled({
      timeout: 15_000,
    })
    for (const participant of [host, guest]) {
      await expect(
        participant.getByRole('button', { name: 'Buat Hasil Akhir', exact: true }),
      ).toBeHidden()
    }
    await captureDuet(host, guest)
    for (const participant of [host, guest]) {
      await expect(
        participant.getByRole('button', { name: 'Buat Hasil Akhir', exact: true }),
      ).toBeVisible({ timeout: 15_000 })
      await participant.getByTestId('booth-microphone-toggle').click()
      await expect.poll(() => cameraTracks(participant)).toMatchObject({ audioEnabled: true })
    }
  })
})
