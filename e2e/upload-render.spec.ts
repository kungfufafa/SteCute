import { expect, test, type Page } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const uploadFixtures = [
  'e2e/fixtures/images/1759243291185.png',
  'e2e/fixtures/images/1769149454852.png',
  'e2e/fixtures/images/1770039834020.png',
].map((path) => resolve(path))

async function openUploadFlow(page: Page) {
  await page.goto('/config?source=upload')
  await expect(page.getByRole('heading', { name: 'Pilih paket strip.' })).toBeVisible()
  await page.getByRole('button', { name: 'Pilih Foto' }).click()
  await expect(page).toHaveURL('/upload')
}

test.describe('real browser upload flow', () => {
  test('rejects invalid local files with localized copy', async ({ page }, testInfo) => {
    await openUploadFlow(page)

    const invalidFile = testInfo.outputPath('invalid-upload.txt')
    await writeFile(invalidFile, 'not an image')

    const chooserPromise = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: /Pilih Foto/ }).click()
    const chooser = await chooserPromise
    await chooser.setFiles([invalidFile])

    await expect(page.getByText('Masalah Upload')).toBeVisible()
    await expect(page.getByText('"invalid-upload.txt" bukan format yang didukung. Gunakan JPG, PNG, atau WebP.')).toBeVisible()
    await expect(page.getByText('Layout ini membutuhkan tepat 3 foto. Kamu memilih 1.')).toBeVisible()
  })

  test('uploads photos, renders output, and stores it in local gallery', async ({ page }) => {
    const consoleProblems: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') consoleProblems.push(message.text())
    })
    page.on('pageerror', (error) => consoleProblems.push(error.message))

    await openUploadFlow(page)

    const chooserPromise = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: /Pilih Foto/ }).click()
    const chooser = await chooserPromise
    await chooser.setFiles(uploadFixtures)

    await expect(page.getByText('Foto Ini', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Kembalikan posisi foto ini' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Ganti Foto Ini' })).toBeVisible()
    await expect(page.getByText('Semua Foto', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Rapikan Semua' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Rapi Otomatis' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Rapi Semua Foto' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Lanjut ke Preview' })).toBeVisible()

    const uploadErrors = await page.locator('[class*="text-stc-error"]').allTextContents()

    expect(
      { uploadErrors, consoleProblems },
      'Upload should prepare framing without browser errors',
    ).toEqual({ uploadErrors: [], consoleProblems: [] })

    await page.getByRole('button', { name: 'Lanjut ke Preview' }).click()

    await expect(page).toHaveURL('/review')
    await expect(page.getByRole('heading', { name: 'Preview' })).toBeVisible()
    await expect(page.getByText('Ganti Foto')).toHaveCount(3)

    const retakeChooserPromise = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: 'Ganti foto 1' }).click()
    const retakeChooser = await retakeChooserPromise
    await retakeChooser.setFiles([uploadFixtures[0]])

    await expect(page.getByText('Foto Pengganti', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Kembalikan Posisi' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Simpan Foto Pengganti' })).toBeVisible()
    await page.getByRole('button', { name: 'Simpan Foto Pengganti' }).click()
    await expect(page.getByText('Foto Pengganti', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Ganti Foto')).toHaveCount(3)

    await page.reload()
    await expect(page).toHaveURL('/review')
    await expect(page.getByRole('heading', { name: 'Preview' })).toBeVisible()
    await expect(page.getByText('Ganti Foto')).toHaveCount(3)

    await page.getByRole('button', { name: 'Buat Hasil' }).click()

    await expect(page).toHaveURL(/\/output\?renderId=.+/, { timeout: 20_000 })
    const renderedStrip = page.getByRole('img', { name: 'Rendered strip' })
    await expect(renderedStrip).toBeVisible({ timeout: 20_000 })
    await expect
      .poll(
        async () =>
          renderedStrip.evaluate((image) => ({
            width: (image as HTMLImageElement).naturalWidth,
            height: (image as HTMLImageElement).naturalHeight,
          })),
        { timeout: 20_000 },
      )
      .toEqual({ width: 1200, height: 2740 })
    await expect(page.getByRole('button', { name: 'PNG' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'JPG' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Unduh ke Perangkat' })).toBeVisible()
    await page.getByRole('button', { name: 'Lihat opsi tambahan' }).click()
    await page.getByRole('button', { name: 'Galeri' }).click()

    await expect(page).toHaveURL('/gallery')
    await expect(page.getByText('1 item')).toBeVisible()
    await expect(page.getByRole('img', { name: 'Render 1' })).toBeVisible()
    expect(consoleProblems).toEqual([])
  })
})
