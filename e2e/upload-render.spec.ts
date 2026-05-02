import { expect, test, type Page } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const uploadFixtures = [
  'public/images/1759243291185.png',
  'public/images/1769149454852.png',
  'public/images/1770039834020.png',
  'public/icons/icon-512x512.png',
].map((path) => resolve(path))

async function openUploadFlow(page: Page) {
  await page.goto('/config?source=upload')
  await page.getByRole('button', { name: '4 Foto Ukuran 2x6 2x6' }).click()
  await page.getByRole('button', { name: 'Youth Bundled offline Ready' }).click()
  await page.getByRole('button', { name: 'Mulai Sesi' }).click()
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
    await expect(page.getByText('Layout ini membutuhkan tepat 4 foto. Kamu memilih 1.')).toBeVisible()
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

    await expect(page.getByRole('button', { name: 'Lanjut ke Preview' })).toBeEnabled()
    await page.getByRole('button', { name: 'Lanjut ke Preview' }).click()

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
    await page.getByRole('button', { name: 'Kustomisasi' }).click()

    await expect(page).toHaveURL('/customize')
    await page.getByRole('button', { name: 'Teks' }).click()
    await page.getByLabel('Teks Logo').fill('<b>Browser QA Logo With Long Text</b>')
    await page.getByText('Tanggal & Waktu').click()
    await page.getByRole('button', { name: 'Simpan Hasil' }).click()

    await expect(page).toHaveURL('/output', { timeout: 20_000 })
    await expect(page.getByRole('img', { name: 'Rendered strip' })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: 'Download' })).toBeVisible()
    await page.getByRole('button', { name: 'Galeri' }).click()

    await expect(page).toHaveURL('/gallery')
    await expect(page.getByText('1 item')).toBeVisible()
    await expect(page.getByRole('img', { name: 'Render 1' })).toBeVisible()
    expect(consoleProblems).toEqual([])
  })
})
