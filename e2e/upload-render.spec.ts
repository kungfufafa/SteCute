import { expect, test, type Page } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const uploadFixtures = [
  'public/images/1759243291185.png',
  'public/images/1769149454852.png',
  'public/images/1770039834020.png',
].map((path) => resolve(path))

async function openUploadFlow(page: Page) {
  await page.goto('/config?source=upload')
  await page.getByRole('button', { name: /3 Foto, strip Fit 3 foto, slot foto rasio 4:3/ }).click()
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

    if (page.url().endsWith('/upload')) {
      await page.waitForTimeout(500)
      const uploadErrors = await page
        .locator('[class*="text-stc-error"]')
        .allTextContents()

      expect(
        { uploadErrors, consoleProblems },
        'Upload should advance to review without browser errors',
      ).toEqual({ uploadErrors: [], consoleProblems: [] })
    }

    await expect(page).toHaveURL('/review')
    await expect(page.getByRole('heading', { name: 'Preview' })).toBeVisible()
    await page.getByRole('button', { name: 'Buat Hasil' }).click()

    await expect(page).toHaveURL('/output', { timeout: 20_000 })
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
    await expect(page.getByRole('button', { name: 'Download' })).toBeVisible()
    await page.getByRole('button', { name: 'Opsi lain' }).click()
    await page.getByRole('button', { name: 'Lihat Galeri' }).click()

    await expect(page).toHaveURL('/gallery')
    await expect(page.getByText('1 item')).toBeVisible()
    await expect(page.getByRole('img', { name: 'Render 1' })).toBeVisible()
    expect(consoleProblems).toEqual([])
  })
})
