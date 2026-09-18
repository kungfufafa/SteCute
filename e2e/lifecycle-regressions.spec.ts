import { expect, test } from '@playwright/test'

type CameraLifecycleWindow = typeof window & {
  __cameraLifecycle: {
    requestPending: boolean
    resolveRequest: (() => void) | null
    stream: MediaStream | null
    canvas: HTMLCanvasElement | null
  }
}

test.describe('Duet camera lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const state: CameraLifecycleWindow['__cameraLifecycle'] = {
        requestPending: false,
        resolveRequest: null,
        stream: null,
        canvas: null,
      }
      ;(window as CameraLifecycleWindow).__cameraLifecycle = state

      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
        configurable: true,
        value: () =>
          new Promise<MediaStream>((resolve) => {
            state.requestPending = true
            state.resolveRequest = () => {
              const canvas = document.createElement('canvas')
              canvas.width = 320
              canvas.height = 240
              const context = canvas.getContext('2d')!
              context.fillStyle = '#ef87b1'
              context.fillRect(0, 0, canvas.width, canvas.height)
              state.canvas = canvas
              state.stream = canvas.captureStream(1)
              state.requestPending = false
              resolve(state.stream)
            }
          }),
      })
    })
  })

  for (const destination of [
    { action: 'Buat Booth', path: '/config?source=booth' },
    { action: 'Kembali ke beranda', path: '/' },
  ]) {
    test(`stops a late camera stream after leaving for ${destination.path}`, async ({ page }) => {
      const pageErrors: string[] = []
      page.on('pageerror', (error) => pageErrors.push(error.message))

      await page.goto('/booth')
      await expect
        .poll(() =>
          page.evaluate(() => (window as CameraLifecycleWindow).__cameraLifecycle.requestPending),
        )
        .toBe(true)

      // Leave through the app while the permission/device request is still pending.
      await page.getByRole('button', { name: destination.action, exact: true }).click()
      await expect(page).toHaveURL(destination.path)

      const initialTrackStates = await page.evaluate(() => {
        const state = (window as CameraLifecycleWindow).__cameraLifecycle
        state.resolveRequest!()
        return state.stream!.getTracks().map((track) => track.readyState)
      })
      expect(initialTrackStates).toEqual(['live'])

      await expect
        .poll(() =>
          page.evaluate(() =>
            (window as CameraLifecycleWindow).__cameraLifecycle
              .stream!.getTracks()
              .map((track) => track.readyState),
          ),
        )
        .toEqual(['ended'])
      await expect(page).toHaveURL(destination.path)
      expect(pageErrors).toEqual([])
    })
  }
})
