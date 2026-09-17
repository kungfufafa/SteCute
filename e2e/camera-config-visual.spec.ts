import { expect, test } from '@playwright/test'

test.use({
  baseURL: process.env.QA_BASE_URL ?? 'http://localhost:4173',
  launchOptions: {
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  },
})

test.describe('config and camera visual smoke', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Fake camera smoke runs in Chromium')

  test('keeps config clear, camera framed at 4:3, and countdown unblurred', async ({ page }) => {
    await page.goto('/config?source=camera')

    await expect(page.getByRole('heading', { name: 'Atur Sesi' })).toBeVisible()
    await expect(page.getByText('Jumlah Foto', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Upload Frame' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Classic 2 foto' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Classic 4 foto' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Classic 6 foto' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Youth, 2/3/4/6 Foto' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Mono, 2/3/4/6 Foto' })).toBeVisible()

    const layoutButton = page.getByRole('button', { name: 'Classic 3 foto' })
    await expect(layoutButton).toBeVisible()

    const layoutRadius = await layoutButton.evaluate((button) =>
      Number.parseFloat(getComputedStyle(button).borderRadius),
    )
    expect(layoutRadius).toBeLessThanOrEqual(12)

    await page.goto('/camera')
    await page.waitForSelector('video')
    await expect
      .poll(async () =>
        page.locator('video').evaluate((video) => video.videoWidth > 0 && Boolean(video.srcObject)),
      )
      .toBe(true)

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

    await expect(page.getByText('Efek', { exact: true })).toBeVisible()
    await expect(page.getByText('Overlay', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Pilih efek Hangat' }).click()
    await page.getByRole('button', { name: 'Pilih overlay Hati' }).click()

    const videoFilter = await page
      .locator('video')
      .evaluate((video) => getComputedStyle(video).filter)
    expect(videoFilter).toContain('sepia')

    const liveOverlay = page.locator('.camera-preview [data-camera-effect-id="hearts"]')
    await expect(liveOverlay).toBeVisible()
    const firstOverlayFrameMs = Number(await liveOverlay.getAttribute('data-overlay-frame-ms'))
    await page.waitForTimeout(260)
    const secondOverlayFrameMs = Number(await liveOverlay.getAttribute('data-overlay-frame-ms'))
    expect(Number.isFinite(firstOverlayFrameMs)).toBe(true)
    expect(Number.isFinite(secondOverlayFrameMs)).toBe(true)
    expect(secondOverlayFrameMs).not.toBe(firstOverlayFrameMs)

    await page.getByRole('button', { name: 'Ambil foto' }).click()
    const countdown = page.getByTestId('camera-countdown')
    await expect(countdown).toBeVisible()

    const backdropFilter = await countdown.evaluate((label) => {
      const styles = getComputedStyle(label)
      return styles.backdropFilter || styles.webkitBackdropFilter || 'none'
    })

    expect(backdropFilter).toBe('none')
  })
})
