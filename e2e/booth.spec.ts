import { expect, test, type Page } from '@playwright/test'

test.use({
  baseURL: process.env.QA_BASE_URL ?? 'http://localhost:4173',
  launchOptions: {
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  },
})

function cta(page: Page, name: string) {
  return page.getByRole('button', { name }).or(page.getByRole('link', { name })).first()
}

test.describe('Booth Bareng join paths', () => {
  test('keeps local camera navigation independent of booth', async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))

    await page.goto('/')
    await expect(page).toHaveURL('/')
    await expect(cta(page, 'Mulai Foto')).toBeVisible()
    await expect(cta(page, 'Upload Lokal')).toBeVisible()
    await expect(cta(page, 'Foto Duet')).toBeVisible()

    await page.goto('/booth')
    await expect(cta(page, 'Buat Booth')).toBeVisible()
    await expect(page.getByText('Review, lalu unduh PNG')).toBeVisible()
    await expect(page.getByText(/review per-shot/i).first()).toBeVisible()

    await page.goto('/')
    await expect(cta(page, 'Mulai Foto')).toBeVisible()
    await page.goto('/booth')
    await expect(cta(page, 'Buat Booth')).toBeVisible()
    expect(pageErrors).toEqual([])

    await page.goto('/')
    await cta(page, 'Mulai Foto').click()

    await expect(page).toHaveURL('/config?source=camera')
    await expect(page.getByRole('heading', { name: 'Atur Sesi' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Progress sesi Stecute' })).toContainText(
      'Format',
    )
    await expect(page.getByRole('button', { name: 'Classic 2 foto' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Classic 3 foto' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Classic 4 foto' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Classic 6 foto' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Youth, 2/3/4/6 Foto' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Mono, 2/3/4/6 Foto' })).toBeVisible()

    const scratch = process.env.BOOTH_PARITY_SCRATCH
    if (scratch) {
      await page.screenshot({ path: `${scratch}/solo-config.png`, fullPage: true })
    }
  })

  test('host sees a room code and invite URL after creating a booth', async ({ page }) => {
    await page.goto('/')
    await cta(page, 'Foto Duet').click()

    await expect(page).toHaveURL('/booth')
    await expect(page.getByRole('heading', { name: 'Foto Duet' })).toBeVisible()
    await expect(page.getByText(/hotspot|4G vs Wi-Fi kantor sering gagal/i)).toHaveCount(0)
    await expect(page.getByText(/Perangkat bisa beda jaringan/)).toBeVisible()

    await page.getByRole('button', { name: 'Buat Booth' }).click()

    const code = page.getByTestId('booth-code')
    await expect(code).toBeVisible()
    const roomCode = (await code.innerText()).trim()
    expect(roomCode).toMatch(/^[A-Z0-9]{3}-[A-Z0-9]{3}$/)

    const invite = page.getByTestId('booth-invite-url')
    await expect(invite).toHaveValue(new RegExp(`/j/${roomCode}$`))
    await expect(page).toHaveURL(new RegExp(`/j/${roomCode}$`))
    await expect(page.getByTestId('booth-stage')).toBeVisible()
    await expect(page.getByTestId('booth-local-tile')).toBeVisible()
    await expect(page.getByTestId('booth-remote-tile')).toBeVisible()
    await expect(page.getByTestId('booth-local-video')).not.toHaveClass(/scale-x-\[-1\]/)
    await expect(page.getByText('Kamu · Host')).toBeVisible()
    await expect(page.getByText('Teman · Tamu')).toBeVisible()
    await expect(page.getByTestId('booth-remote-tile')).not.toContainText('Menunggu teman gabung')
    await expect(page.getByTestId('booth-remote-tile')).not.toContainText(
      'Menunggu host memulai pose',
    )
    const progress = page.getByRole('navigation', { name: 'Progress sesi Stecute' })
    await expect(progress).toContainText('Format')
    await expect(progress).toContainText('Foto')
    await expect(progress).toContainText('Review')
    await expect(progress).toContainText('Hasil')
    await expect(page.getByText('Efek Kamera')).toBeVisible()
    await expect(page.getByText('Overlay Kamera')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Pilih efek Hangat' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Pilih overlay Hati' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Classic 2 foto' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Classic 3 foto' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Classic 4 foto' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Classic 6 foto' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Youth, 2/3/4/6 Foto' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Mono, 2/3/4/6 Foto' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Menunggu teman' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Render strip' })).toHaveCount(0)

    const scratch = process.env.BOOTH_PARITY_SCRATCH
    if (scratch) {
      await page.screenshot({ path: `${scratch}/booth-room.png`, fullPage: true })
    }
  })

  test('guest can join by typing the host code', async ({ context, page }) => {
    await page.goto('/')
    await cta(page, 'Foto Duet').click()
    await page.getByRole('button', { name: 'Buat Booth' }).click()

    const roomCode = (await page.getByTestId('booth-code').innerText()).trim()

    const guest = await context.newPage()
    await guest.goto('/booth')
    await guest.getByLabel('Kode booth').fill(roomCode)
    await guest.getByRole('button', { name: 'Gabung' }).click()

    await expect(guest).toHaveURL(new RegExp(`/j/${roomCode}$`))
    await expect(guest.getByTestId('booth-code')).toHaveText(roomCode)
    await expect(guest.getByTestId('booth-invite-url')).toHaveValue(new RegExp(`/j/${roomCode}$`))
  })

  test('guest on a separate browser profile joins without a shared tab channel', async ({
    browser,
  }) => {
    const hostContext = await browser.newContext()
    const guestContext = await browser.newContext()
    const host = await hostContext.newPage()
    const guest = await guestContext.newPage()

    await host.route(/peerjs/i, (route) => route.abort())
    await guest.route(/peerjs/i, (route) => route.abort())

    await host.goto('/')
    await cta(host, 'Foto Duet').click()
    await host.getByRole('button', { name: 'Buat Booth' }).click()
    const roomCode = (await host.getByTestId('booth-code').innerText()).trim()
    const inviteUrl = await host.getByTestId('booth-invite-url').inputValue()

    await guest.goto(inviteUrl)
    await expect(guest.getByTestId('booth-code')).toHaveText(roomCode)
    await expect(host.getByText('Teman sudah masuk')).toBeVisible({ timeout: 15_000 })
    await expect(guest.getByText('Menunggu host memulai pose.')).toBeVisible({ timeout: 15_000 })

    await hostContext.close()
    await guestContext.close()
  })

  test('invite URL enters the same booth as the host code', async ({ context, page }) => {
    await page.goto('/')
    await cta(page, 'Foto Duet').click()
    await page.getByRole('button', { name: 'Buat Booth' }).click()

    const roomCode = (await page.getByTestId('booth-code').innerText()).trim()
    const inviteUrl = await page.getByTestId('booth-invite-url').inputValue()

    const guest = await context.newPage()
    await guest.goto(inviteUrl)

    await expect(guest).toHaveURL(new RegExp(`/j/${roomCode}$`))
    await expect(guest.getByTestId('booth-code')).toHaveText(roomCode)
    await expect(guest.getByText('Booth tidak ditemukan')).toHaveCount(0)
  })
})
