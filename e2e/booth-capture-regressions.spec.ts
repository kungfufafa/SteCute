import { expect, test, type Page } from '@playwright/test'
import { startHostBooth } from './booth-flow'

type ControlledBoothWindow = typeof window & {
  __releaseCamera?: () => void
  __releaseStill?: () => void
}

test.use({
  launchOptions: {
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  },
})

test.describe('Duet capture readiness', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Uses Chromium fake cameras')

  async function enterHost(page: Page) {
    await page.goto('/booth')
    await startHostBooth(page)
    return page.getByTestId('booth-invite-url').inputValue()
  }

  test.beforeEach(async ({ context }) => {
    // A shared browser channel keeps these flow regressions independent of signaling services.
    await context.route(/\/api\/booth-relay\/|peerjs/i, (route) => route.abort())
  })

  test('waits for the guest camera even after the guest joins', async ({ page, context }) => {
    const invite = await enterHost(page)
    const guest = await context.newPage()
    await guest.addInitScript(() => {
      const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
      navigator.mediaDevices.getUserMedia = (constraints) =>
        new Promise<MediaStream>((resolve, reject) => {
          ;(window as ControlledBoothWindow).__releaseCamera = () => {
            void original(constraints).then(resolve, reject)
          }
        })
    })
    await guest.goto(invite)
    const blocked = page.getByRole('button', { name: 'Menunggu kamera teman…', exact: true })
    await expect(blocked).toBeVisible({ timeout: 15000 })
    await expect(blocked).toBeDisabled()
    await expect(page.getByTestId('booth-countdown')).toBeHidden()
    await guest.evaluate(() => (window as ControlledBoothWindow).__releaseCamera!())
    await expect(page.getByRole('button', { name: 'Mulai pose', exact: true })).toBeEnabled({
      timeout: 15000,
    })
  })

  test('keeps start disabled until both stills finish exchanging', async ({ page, context }) => {
    const invite = await enterHost(page)
    const guest = await context.newPage()
    await guest.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.toBlob
      HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
        if (type !== 'image/jpeg') return original.call(this, callback, type, quality)
        original.call(
          this,
          (blob) => {
            ;(window as ControlledBoothWindow).__releaseStill = () => callback(blob)
          },
          type,
          quality,
        )
      }
    })
    await guest.goto(invite)
    const start = page.getByRole('button', { name: 'Mulai pose', exact: true })
    await expect(start).toBeEnabled({ timeout: 15000 })
    await start.click()
    await expect(page.getByTestId('booth-countdown')).toBeVisible()
    const exchanging = page.getByRole('button', { name: 'Menyiapkan foto bersama…', exact: true })
    await expect(exchanging).toBeVisible({ timeout: 15000 })
    await expect(exchanging).toBeDisabled()
    await expect
      .poll(() => guest.evaluate(() => Boolean((window as ControlledBoothWindow).__releaseStill)))
      .toBe(true)
    // Even a dispatched click must not clear the active attempt or queue another countdown.
    await exchanging.dispatchEvent('click')
    await expect(page.getByTestId('booth-countdown')).toBeHidden()
    await guest.evaluate(() => (window as ControlledBoothWindow).__releaseStill!())
    await expect(start).toBeEnabled({ timeout: 15000 })
    await expect(page.getByTestId('booth-countdown')).toBeHidden()
  })
})
