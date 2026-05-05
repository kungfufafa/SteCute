import { expect, test, type Page } from '@playwright/test'
import { resolve } from 'node:path'

const uploadFixtures = [
  'public/images/1759243291185.png',
  'public/images/1769149454852.png',
  'public/images/1770039834020.png',
].map((path) => resolve(path))

async function warmOfflineCache(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Stecute Photo Booth' })).toBeVisible()
  await page.waitForFunction(
    async () => {
      if (!('serviceWorker' in navigator) || !('caches' in window)) return false

      const registration = await navigator.serviceWorker.ready.catch(() => null)
      if (!registration) return false

      const keys = await caches.keys()
      return keys.length > 0
    },
    undefined,
    { timeout: 20_000 },
  )
}

test.describe('offline behavior', () => {
  test('blocks first visit before cache exists', async ({ context, page }) => {
    await context.setOffline(true)

    await expect(page.goto('/')).rejects.toThrow()
  })

  test('reloads core routes after app cache is ready', async ({ browserName, context, page }) => {
    test.skip(
      browserName === 'webkit',
      'Playwright WebKit reports an internal error for offline service-worker document navigations.',
    )

    await warmOfflineCache(page)
    await context.setOffline(true)

    const routes = [
      { path: '/', text: 'Stecute Photo Booth' },
      { path: '/config?source=upload', text: 'Atur Sesi' },
      { path: '/upload', text: 'Upload Foto' },
      { path: '/review', text: 'Preview' },
      { path: '/output', text: 'Selesai!' },
      { path: '/gallery', text: 'Galeri' },
    ]

    for (const route of routes) {
      await page.goto(route.path)
      await expect(page.getByText(route.text).first()).toBeVisible()
    }
  })

  test('completes upload, review, render, output, and gallery while offline', async ({
    browserName,
    context,
    page,
  }) => {
    test.skip(
      browserName === 'webkit',
      'Playwright WebKit cannot decode local uploaded file blobs after switching the context offline; cover this on real Safari devices.',
    )

    let collectConsoleProblems = false
    const consoleProblems: string[] = []
    page.on('console', (message) => {
      if (!collectConsoleProblems) return

      if (message.type() === 'error' || message.type() === 'warning') {
        consoleProblems.push(`${message.type()}: ${message.text()}`)
      }
    })
    page.on('pageerror', (error) => {
      if (collectConsoleProblems) consoleProblems.push(error.message)
    })

    await warmOfflineCache(page)
    await context.setOffline(true)
    await page.goto('/config?source=upload')
    await page.getByRole('button', { name: 'Pilih Foto' }).click()
    await expect(page).toHaveURL('/upload')

    collectConsoleProblems = true

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
        'Offline upload should advance to review without browser errors',
      ).toEqual({ uploadErrors: [], consoleProblems: [] })
    }

    await expect(page).toHaveURL('/review')

    await page.getByRole('button', { name: 'Buat Hasil Akhir' }).click()

    await expect(page)
      .toHaveURL('/output', { timeout: 20_000 })
      .catch((error) => {
        throw new Error(`${error.message}\nConsole problems:\n${consoleProblems.join('\n')}`)
      })
    await expect(page.getByRole('img', { name: 'Rendered strip' })).toBeVisible({
      timeout: 20_000,
    })

    await page.getByRole('button', { name: 'Lihat opsi tambahan' }).click()
    await page.getByRole('button', { name: 'Galeri' }).click()

    await expect(page).toHaveURL('/gallery')
    await expect(page.getByText('1 item')).toBeVisible()
  })
})
