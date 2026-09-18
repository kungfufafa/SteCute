import { expect, test, type Page } from '@playwright/test'
import { startHostBooth } from './booth-flow'

type AudioTestWindow = typeof window & {
  __mediaStreams?: MediaStream[]
  __mediaRequests?: MediaStreamConstraints[]
  __releaseMicrophone?: () => void
  __retriedMicrophone?: MediaStream
}

test.use({
  launchOptions: {
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  },
})

async function observeMedia(
  page: Page,
  options: { denyInitialAudio?: boolean; delayAudioRetry?: boolean } = {},
) {
  await page.addInitScript((settings) => {
    const state = window as AudioTestWindow
    state.__mediaStreams = []
    state.__mediaRequests = []
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      state.__mediaRequests!.push(constraints ?? {})
      if (settings.denyInitialAudio && constraints?.audio && constraints.video) {
        throw new DOMException('Microphone permission denied', 'NotAllowedError')
      }
      if (settings.delayAudioRetry && constraints?.audio && !constraints.video) {
        await new Promise<void>((resolve) => {
          state.__releaseMicrophone = resolve
        })
      }
      const stream = await original(constraints)
      state.__mediaStreams!.push(stream)
      if (constraints?.audio && !constraints.video) state.__retriedMicrophone = stream
      return stream
    }
  }, options)
}

async function roomMedia(page: Page) {
  return page.evaluate(() => {
    const stream = (window as AudioTestWindow).__mediaStreams
      ?.filter((candidate) => candidate.getVideoTracks().some((track) => track.readyState === 'live'))
      .at(-1)
    const video = stream?.getVideoTracks()[0]
    const audio = stream?.getAudioTracks()[0]
    return {
      videoId: video?.id ?? null,
      videoEnabled: video?.enabled ?? false,
      audioEnabled: audio?.enabled ?? null,
      audioState: audio?.readyState ?? null,
    }
  })
}

async function enterHost(page: Page) {
  await page.goto('/booth')
  await startHostBooth(page)
  await expect(page.getByTestId('booth-microphone-toggle')).toBeEnabled()
  return page.getByTestId('booth-invite-url').inputValue()
}

test.describe('Duet participant audio controls', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Uses Chromium fake camera and audio')

  test.beforeEach(async ({ context }) => {
    await context.route(/\/api\/booth-relay\/|peerjs/i, (route) => route.abort())
  })

  test('host and guest mute their own microphone and speaker independently', async ({
    page: host,
    context,
  }) => {
    await observeMedia(host)
    const invite = await enterHost(host)
    const guest = await context.newPage()
    await observeMedia(guest)
    await guest.goto(invite)
    const hostMic = host.getByTestId('booth-microphone-toggle')
    const guestMic = guest.getByTestId('booth-microphone-toggle')
    await expect(guestMic).toBeEnabled()
    await expect.poll(() => roomMedia(host)).toMatchObject({ audioEnabled: true, audioState: 'live' })
    await expect.poll(() => roomMedia(guest)).toMatchObject({ audioEnabled: true, audioState: 'live' })
    const hostVideoId = (await roomMedia(host)).videoId
    const guestVideoId = (await roomMedia(guest)).videoId

    await hostMic.click()
    await expect(hostMic).toHaveAttribute('aria-label', 'Nyalakan mikrofon')
    await expect(hostMic).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => roomMedia(host)).toMatchObject({ audioEnabled: false, videoId: hostVideoId })
    await expect.poll(() => roomMedia(guest)).toMatchObject({ audioEnabled: true, videoId: guestVideoId })

    await guestMic.click()
    await expect(guestMic).toHaveAttribute('aria-label', 'Nyalakan mikrofon')
    await expect(guestMic).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => roomMedia(guest)).toMatchObject({ audioEnabled: false, videoEnabled: true })

    await hostMic.click()
    await expect(hostMic).toHaveAttribute('aria-label', 'Matikan mikrofon')
    await expect(hostMic).toHaveAttribute('aria-pressed', 'false')
    await expect.poll(() => roomMedia(host)).toMatchObject({ audioEnabled: true, videoId: hostVideoId })
    await expect.poll(() => roomMedia(guest)).toMatchObject({ audioEnabled: false, videoId: guestVideoId })
    await guestMic.click()
    await expect(guestMic).toHaveAttribute('aria-pressed', 'false')
    await expect.poll(() => roomMedia(guest)).toMatchObject({ audioEnabled: true, videoId: guestVideoId })

    const hostSpeaker = host.getByTestId('booth-speaker-toggle')
    const guestSpeaker = guest.getByTestId('booth-speaker-toggle')
    await hostSpeaker.click()
    await expect(hostSpeaker).toHaveAttribute('aria-pressed', 'true')
    await expect(host.getByTestId('booth-remote-video')).toHaveJSProperty('muted', true)
    await expect(guestSpeaker).toHaveAttribute('aria-pressed', 'false')
    await guestSpeaker.click()
    await expect(guestSpeaker).toHaveAttribute('aria-pressed', 'true')
    await hostSpeaker.click()
    await expect(hostSpeaker).toHaveAttribute('aria-pressed', 'false')
    await expect(guestSpeaker).toHaveAttribute('aria-pressed', 'true')
    await expect(host.getByTestId('booth-local-video')).toHaveJSProperty('muted', true)
    await expect(guest.getByTestId('booth-local-video')).toHaveJSProperty('muted', true)
    await expect.poll(() => roomMedia(host)).toMatchObject({ audioEnabled: true, videoEnabled: true })
    await expect.poll(() => roomMedia(guest)).toMatchObject({ audioEnabled: true, videoEnabled: true })
  })

  test('enables a previously denied microphone without replacing the camera', async ({ page }) => {
    await observeMedia(page, { denyInitialAudio: true })
    await enterHost(page)
    const microphone = page.getByTestId('booth-microphone-toggle')
    await expect(microphone).toHaveAttribute('aria-label', 'Nyalakan mikrofon')
    await expect(microphone).toHaveAttribute('aria-pressed', 'true')
    const before = await roomMedia(page)
    expect(before.videoId).toBeTruthy()
    expect(before.audioEnabled).toBeNull()

    await microphone.click()
    await expect(microphone).toHaveAttribute('aria-label', 'Matikan mikrofon')
    await expect(microphone).toHaveAttribute('aria-pressed', 'false')
    await expect.poll(() => roomMedia(page)).toMatchObject({
      videoId: before.videoId,
      videoEnabled: true,
      audioEnabled: true,
      audioState: 'live',
    })
    const lastRequest = await page.evaluate(() =>
      (window as AudioTestWindow).__mediaRequests?.at(-1),
    )
    expect(lastRequest?.audio).toBeTruthy()
    expect(lastRequest?.video).toBeFalsy()
    await microphone.click()
    await expect.poll(() => roomMedia(page)).toMatchObject({
      videoId: before.videoId,
      audioEnabled: false,
      videoEnabled: true,
    })
  })

  test('both participants keep audio controls in review and output', async ({ page: host, context }) => {
    test.setTimeout(60_000)
    await observeMedia(host)
    await host.goto('/booth')
    await host.getByRole('button', { name: 'Buat Booth' }).click()
    await host.getByRole('button', { name: 'Classic 2 foto' }).click()
    await host.getByRole('button', { name: '3s', exact: true }).click()
    await host.getByRole('button', { name: 'Buka Booth' }).filter({ visible: true }).click()
    const invite = await host.getByTestId('booth-invite-url').inputValue()
    const guest = await context.newPage()
    await observeMedia(guest)
    await guest.goto(invite)
    const start = host.getByRole('button', { name: 'Mulai pose', exact: true })
    await expect(start).toBeEnabled({ timeout: 15_000 })
    await host.getByTestId('booth-microphone-toggle').click()
    await guest.getByTestId('booth-microphone-toggle').click()

    for (let pose = 0; pose < 2; pose++) {
      await expect(start).toBeEnabled({ timeout: 15_000 })
      await start.click()
      await expect(host.getByTestId('booth-countdown')).toBeVisible()
      await expect(host.getByTestId('booth-countdown')).toBeHidden({ timeout: 15_000 })
    }
    for (const participant of [host, guest]) {
      await expect(participant.getByRole('button', { name: 'Buat Hasil Akhir', exact: true })).toBeVisible()
      const microphone = participant.getByTestId('booth-microphone-toggle')
      await expect(microphone).toBeVisible()
      await expect(microphone).toHaveAttribute('aria-pressed', 'true')
      await microphone.click()
      await expect.poll(() => roomMedia(participant)).toMatchObject({ audioEnabled: true })
      await expect(participant.getByTestId('booth-speaker-toggle')).toBeVisible()
      await participant.getByRole('button', { name: 'Buat Hasil Akhir', exact: true }).click()
      await expect(participant.getByRole('img', { name: 'Photo strip Foto Duet' })).toBeVisible({ timeout: 15_000 })
      await expect(microphone).toBeVisible()
      await microphone.click()
      await expect.poll(() => roomMedia(participant)).toMatchObject({ audioEnabled: false })
      await expect(participant.getByTestId('booth-speaker-toggle')).toBeVisible()
    }
  })

  test('stops a pending microphone stream when permission resolves after leaving the room', async ({
    page,
  }) => {
    await observeMedia(page, { denyInitialAudio: true, delayAudioRetry: true })
    await enterHost(page)
    const microphone = page.getByTestId('booth-microphone-toggle')
    await microphone.click()
    await expect(microphone).toBeDisabled()
    await expect
      .poll(() => page.evaluate(() => Boolean((window as AudioTestWindow).__releaseMicrophone)))
      .toBe(true)
    await page.getByRole('button', { name: 'Kembali ke Foto Duet', exact: true }).click()
    await expect(page).toHaveURL('/booth')
    await page.evaluate(() => (window as AudioTestWindow).__releaseMicrophone!())
    await expect
      .poll(() =>
        page.evaluate(() =>
          (window as AudioTestWindow).__retriedMicrophone?.getAudioTracks().map((track) => track.readyState),
        ),
      )
      .toEqual(['ended'])
    await expect(page).toHaveURL('/booth')
  })
})
