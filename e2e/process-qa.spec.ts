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

test.describe('process QA empty and entry states', () => {
  test('landing exposes local and booth entries without login', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Stecute Photo Booth' })).toBeVisible()
    await expect(cta(page, 'Mulai Foto')).toBeVisible()
    await expect(cta(page, 'Upload Lokal')).toBeVisible()
    await expect(cta(page, 'Booth Bareng')).toBeVisible()
    await expect(page.getByText('Tanpa Login')).toBeVisible()
  })

  test('camera config process starts from Mulai Foto', async ({ page }) => {
    await page.goto('/')
    await cta(page, 'Mulai Foto').click()
    await expect(page).toHaveURL('/config?source=camera')
    await expect(page.getByRole('heading', { name: 'Atur Sesi' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Buka Kamera' })).toBeVisible()
    await expect(page.getByText('Blanko Strip', { exact: true })).toBeVisible()
  })

  test('upload config process starts from Upload Lokal', async ({ page }) => {
    await page.goto('/')
    await cta(page, 'Upload Lokal').click()
    await expect(page).toHaveURL('/config?source=upload')
    await page.getByRole('button', { name: 'Pilih Foto' }).click()
    await expect(page).toHaveURL('/upload')
    await expect(page.getByRole('heading', { name: 'Upload Foto' })).toBeVisible()
  })

  test('review without a session shows recovery copy', async ({ page }) => {
    await page.goto('/review')
    await expect(page.getByRole('heading', { name: 'Preview' })).toBeVisible()
    await expect(page.getByText('Sesi review tidak ditemukan')).toBeVisible()
  })

  test('output without renderId shows empty recovery, not a fake success strip', async ({
    page,
  }) => {
    await page.goto('/output')
    await expect(page.getByRole('heading', { name: 'Hasil Tidak Ditemukan' })).toBeVisible()
    await expect(page.getByText('Photo strip kamu sudah jadi')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Buka Galeri' })).toBeVisible()
  })

  test('gallery empty state keeps Mulai Foto', async ({ page }) => {
    await page.goto('/gallery')
    await expect(page.getByRole('heading', { name: 'Galeri' })).toBeVisible()
    await expect(page.getByText('Belum Ada Hasil')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Mulai Foto' })).toBeVisible()
  })

  test('public transparency processes stay reachable', async ({ page }) => {
    await page.goto('/privacy')
    await expect(page.getByRole('heading', { name: 'Kebijakan Privasi', level: 1 })).toBeVisible()
    await page.goto('/terms')
    await expect(page.getByRole('heading', { name: 'Syarat dan Ketentuan', level: 1 })).toBeVisible()
    await page.goto('/faq')
    await expect(page.getByText('Apakah foto saya diupload ke server?')).toBeVisible()
    await page.goto('/about')
    await expect(page.getByRole('heading', { name: 'Tentang Stecute', level: 1 })).toBeVisible()
  })

  test('booth process rejects malformed codes and keeps waiting for a well-formed host', async ({ page }) => {
    await page.goto('/booth')
    await expect(page.getByRole('heading', { name: 'Booth Bareng' })).toBeVisible()
    await page.getByLabel('Kode booth').fill('@@@')
    await page.getByRole('button', { name: 'Gabung' }).click()
    await expect(page.getByRole('alert')).toContainText('tidak valid')

    await page.goto('/j/ZZZ-ZZZ')
    await expect(page.getByRole('heading', { name: 'Booth Bareng' })).toBeVisible()
    await expect(page.getByText(/Menghubungkan ke host|Host belum online/)).toBeVisible()
    await expect(page.getByText('Booth tidak ditemukan')).toHaveCount(0)
  })

  test('unknown routes return to landing', async ({ page }) => {
    await page.goto('/this-process-does-not-exist')
    await expect(page).toHaveURL('/')
    await expect(cta(page, 'Mulai Foto')).toBeVisible()
  })
})

test.describe('camera process smoke', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Fake camera smoke runs in Chromium')

  test('camera process reaches live preview and shutter', async ({ page }) => {
    await page.goto('/config?source=camera')
    await page.getByRole('button', { name: 'Buka Kamera' }).click()
    await expect(page).toHaveURL('/camera')
    await page.waitForSelector('video', { timeout: 15_000 })
    await expect
      .poll(async () =>
        page.locator('video').evaluate((video) => video.videoWidth > 0 && Boolean(video.srcObject)),
      )
      .toBe(true)
    await expect(page.getByRole('button', { name: 'Ambil foto' })).toBeVisible()
    await expect(page.getByText('Efek Kamera')).toBeVisible()
    await expect(page.getByText('Overlay Kamera')).toBeVisible()
  })
})
