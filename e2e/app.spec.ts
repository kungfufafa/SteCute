import { expect, test, type Page } from '@playwright/test'

function cta(page: Page, name: string) {
  return page.getByRole('button', { name }).or(page.getByRole('link', { name })).first()
}

test.describe('Stecute app smoke', () => {
  test('loads landing with final CTA and desktop-friendly hero', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Stecute Photo Booth' })).toBeVisible()
    await expect(cta(page, 'Mulai Foto')).toBeVisible()
    await expect(cta(page, 'Upload Lokal')).toBeVisible()
    await expect(page.getByText('Foto diproses lokal di browser.')).toBeVisible()
  })

  test('navigates to session config from landing', async ({ page }) => {
    await page.goto('/')

    await cta(page, 'Mulai Foto').click()

    await expect(page).toHaveURL('/config?source=camera')
    await expect(page.getByRole('heading', { name: 'Atur Sesi' })).toBeVisible()
    await expect(page.getByText('Pilih paket strip.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Buka Kamera' })).toBeVisible()
  })

  test('navigates to upload view from landing', async ({ page }) => {
    await page.goto('/')

    await cta(page, 'Upload Lokal').click()

    await expect(page).toHaveURL('/config?source=upload')
    await page.getByRole('button', { name: 'Pilih Foto' }).click()

    await expect(page).toHaveURL('/upload')
    await expect(page.getByRole('heading', { name: 'Upload Foto' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Pilih Foto' })).toBeVisible()
  })

  test('shows gallery empty state on fresh app', async ({ page }) => {
    await page.goto('/gallery')

    await expect(page.getByRole('heading', { name: 'Galeri' })).toBeVisible()
    await expect(page.getByText('Belum Ada Hasil')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Mulai Foto' })).toBeVisible()
  })

  test('exposes public transparency pages', async ({ page }) => {
    const pages = [
      {
        path: '/privacy',
        link: 'Kebijakan Privasi',
        heading: 'Kebijakan Privasi',
        text: 'Stecute memproses foto di browser',
      },
      {
        path: '/terms',
        link: 'Syarat & Ketentuan',
        heading: 'Syarat dan Ketentuan',
        text: 'Aturan dasar memakai Stecute',
      },
      {
        path: '/faq',
        link: 'FAQ',
        heading: 'FAQ',
        text: 'Apakah foto saya diupload ke server?',
      },
      {
        path: '/about',
        link: 'Tentang',
        heading: 'Tentang Stecute',
        text: 'Stecute adalah photo booth web offline-first',
      },
    ]

    await page.goto('/')

    for (const item of pages) {
      await page.getByRole('link', { name: item.link }).last().click()
      await expect(page).toHaveURL(item.path)
      await expect(page.getByRole('heading', { name: item.heading, level: 1 })).toBeVisible()
      await expect(page.getByText(item.text)).toBeVisible()
      await page.goto('/')
    }
  })

  test('redirects unknown route to landing', async ({ page }) => {
    await page.goto('/unknown-page')

    await expect(page).toHaveURL('/')
    await expect(cta(page, 'Mulai Foto')).toBeVisible()
  })
})
