import { expect, test } from '@playwright/test'

test.use({
  launchOptions: {
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  },
})

test.describe('config and camera visual smoke', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Fake camera smoke runs in Chromium')

  test('keeps config clear, camera framed at 4:3, and countdown unblurred', async ({ page }) => {
    await page.goto('/config?source=camera')

    await expect(page.getByRole('heading', { name: 'Pilih paket strip.' })).toBeVisible()
    await expect(page.getByText('Blanko Strip', { exact: true })).toBeVisible()
    await expect(page.getByText('Upload PNG/WebP, jumlah area transparan akan dideteksi otomatis.')).toBeVisible()

    const layoutButton = page.getByRole('button', { name: 'Classic 3 foto' })
    await expect(layoutButton).toBeVisible()

    const layoutRadius = await layoutButton.evaluate((button) =>
      Number.parseFloat(getComputedStyle(button).borderRadius),
    )
    expect(layoutRadius).toBeLessThanOrEqual(12)

    await page.goto('/camera')
    await page.waitForSelector('video')

    const cameraBox = await page.locator('video').evaluate((video) => {
      const box = video.parentElement!.getBoundingClientRect()
      return {
        width: box.width,
        height: box.height,
        ratio: box.width / box.height,
        radius: Number.parseFloat(getComputedStyle(video.parentElement!).borderRadius),
      }
    })

    expect(cameraBox.width).toBeGreaterThan(300)
    expect(cameraBox.ratio).toBeGreaterThan(1.32)
    expect(cameraBox.ratio).toBeLessThan(1.35)
    expect(cameraBox.radius).toBeLessThanOrEqual(12)

    await expect(page.getByText('Efek Kamera')).toBeVisible()
    await page.getByRole('button', { name: 'Pilih efek Hangat' }).click()

    const videoFilter = await page
      .locator('video')
      .evaluate((video) => getComputedStyle(video).filter)
    expect(videoFilter).toContain('sepia')

    await page.getByRole('button', { name: 'Ambil foto' }).click()
    const countdownLabel = page.getByText(/Foto ke-/)
    await expect(countdownLabel).toBeVisible()

    const backdropFilter = await countdownLabel.evaluate((label) => {
      const styles = getComputedStyle(label.parentElement!)
      return styles.backdropFilter || styles.webkitBackdropFilter || 'none'
    })

    expect(backdropFilter).toBe('none')
  })
})
