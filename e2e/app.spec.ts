import { expect, test } from '@playwright/test'

test.describe('Stecute app smoke', () => {
  test('loads landing with final CTA and desktop-friendly hero', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('img', { name: 'Stecute' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Mulai Foto' })).toBeVisible()
    await expect(page.getByText('Tanpa Login')).toBeVisible()
    await expect(page.getByText('Privasi Terjaga')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Upload Lokal' }).first()).toBeVisible()
  })

  test('navigates to session config from landing', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: 'Mulai Foto' }).click()

    await expect(page).toHaveURL('/config?source=camera')
    await expect(page.getByRole('heading', { name: 'Setup Sesi' })).toBeVisible()
    await expect(page.getByText('Hasil Cetak', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Mulai Sesi' })).toBeVisible()
  })

  test('navigates to upload view from landing', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: 'Upload Lokal' }).first().click()

    await expect(page).toHaveURL('/config?source=upload')
    await page.getByRole('button', { name: 'Mulai Sesi' }).click()

    await expect(page).toHaveURL('/upload')
    await expect(page.getByRole('heading', { name: 'Upload Foto' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Lanjut ke Preview' })).toBeDisabled()
  })

  test('shows gallery empty state on fresh app', async ({ page }) => {
    await page.goto('/gallery')

    await expect(page.getByRole('heading', { name: 'Galeri' })).toBeVisible()
    await expect(page.getByText('Belum Ada Hasil')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Mulai Foto' })).toBeVisible()
  })

  test('redirects unknown route to landing', async ({ page }) => {
    await page.goto('/unknown-page')

    await expect(page).toHaveURL('/')
    await expect(page.getByRole('button', { name: 'Mulai Foto' })).toBeVisible()
  })
})
