import { expect, test, type Page } from '@playwright/test'
import { resolve } from 'node:path'

test.use({
  launchOptions: {
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  },
})

const photos = ['1759243291185.png', '1769149454852.png', '1770039834020.png'].map((name) =>
  resolve('e2e/fixtures/images', name),
)

async function selectPhotos(page: Page) {
  await page.goto('/config?source=upload')
  await page.getByRole('button', { name: 'Pilih Foto', exact: true }).click()
  const chooserPromise = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: /Pilih Foto Lokal/ }).click()
  await (await chooserPromise).setFiles(photos)
  await expect(page.getByRole('button', { name: 'Lanjut ke Preview' })).toBeEnabled()
}

async function cropStyle(page: Page) {
  return page
    .locator('.cursor-grab > div')
    .first()
    .evaluate((element) => ({
      size: (element as HTMLElement).style.backgroundSize,
      position: (element as HTMLElement).style.backgroundPosition,
    }))
}

test('preserves upload sources and framing on review Back and reload', async ({ page }) => {
  await selectPhotos(page)
  const originalCrop = await cropStyle(page)
  await page.locator('.cursor-grab').dispatchEvent('wheel', { deltaY: -100 })
  await expect.poll(() => cropStyle(page)).not.toEqual(originalCrop)
  const selectedCrop = await cropStyle(page)

  await page.getByRole('button', { name: 'Lanjut ke Preview' }).click()
  await expect(page).toHaveURL('/review')
  await page.getByRole('button', { name: 'Kembali', exact: true }).click()
  await expect(page).toHaveURL('/upload')
  await expect(page.getByRole('button', { name: /Atur foto \d/ })).toHaveCount(3)
  await expect.poll(() => cropStyle(page)).toEqual(selectedCrop)

  await page.reload()
  await expect(page.getByRole('button', { name: /Atur foto \d/ })).toHaveCount(3)
  await expect.poll(() => cropStyle(page)).toEqual(selectedCrop)
  await page.getByRole('button', { name: 'Lanjut ke Preview' }).click()
  await expect(page.getByRole('button', { name: /Ganti foto \d/ })).toHaveCount(3)
})

test('keeps a review replacement when returning to upload and clears sources after render', async ({
  page,
}) => {
  await selectPhotos(page)
  await page.getByRole('button', { name: 'Lanjut ke Preview' }).click()
  await expect(page).toHaveURL('/review')
  const chooserPromise = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Ganti foto 1' }).click()
  await (await chooserPromise).setFiles([photos[2]])
  await page.getByRole('button', { name: 'Simpan Foto Pengganti' }).click()
  await expect(page.getByText('Foto Pengganti', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Kembali', exact: true }).click()
  await expect(page.getByRole('button', { name: /Atur foto \d/ })).toHaveCount(3)

  const sourceNames = async () =>
    page.evaluate(async () => {
      const request = indexedDB.open('stecute-db')
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      try {
        const assets = database.transaction('assets').objectStore('assets').getAll()
        const records = await new Promise<
          Array<{ type: string; order: number; name: string; blob?: unknown }>
        >((resolve, reject) => {
          assets.onsuccess = () => resolve(assets.result)
          assets.onerror = () => reject(assets.error)
        })
        return records
          .filter((asset) => asset.type === 'upload-source' && asset.blob)
          .sort((a, b) => a.order - b.order)
          .map((asset) => asset.name)
      } finally {
        database.close()
      }
    })
  await expect
    .poll(sourceNames)
    .toEqual(['1770039834020.png', '1769149454852.png', '1770039834020.png'])
  await page.getByRole('button', { name: 'Lanjut ke Preview' }).click()
  await page.getByRole('button', { name: 'Buat Hasil Akhir' }).click()
  await expect(page).toHaveURL(/\/output\?renderId=.+/, { timeout: 30_000 })
  await expect.poll(sourceNames).toEqual([])
})

test.describe('camera switch recovery', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Uses Chromium fake camera')

  test('allows capture again after switching to an unavailable camera', async ({ page }) => {
    await page.addInitScript(() => {
      const media = navigator.mediaDevices
      const enumerate = media.enumerateDevices.bind(media)
      const getUserMedia = media.getUserMedia.bind(media)
      media.enumerateDevices = async () => {
        const devices = await enumerate()
        const camera = devices.find((device) => device.kind === 'videoinput')
        return camera
          ? [
              camera,
              {
                deviceId: 'unavailable-back-camera',
                groupId: 'unavailable',
                kind: 'videoinput',
                label: 'Back Camera',
                toJSON: () => ({}),
              } as MediaDeviceInfo,
            ]
          : devices
      }
      media.getUserMedia = async (constraints) => {
        const video = constraints?.video
        if (
          video &&
          typeof video === 'object' &&
          JSON.stringify(video.deviceId)?.includes('unavailable-back-camera')
        ) {
          throw new DOMException('Camera is unavailable', 'OverconstrainedError')
        }
        return getUserMedia(constraints)
      }
    })
    await page.goto('/camera')
    await expect(page.getByRole('button', { name: /Ganti kamera/ })).toBeEnabled()
    await page.getByRole('button', { name: /Ganti kamera/ }).click()
    await expect(
      page.getByText('Kamera itu belum bisa dibuka. Coba pilih kamera lain.'),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: /Ganti kamera/ })).toBeEnabled()
    await page.getByRole('button', { name: 'Ambil foto' }).click()
    await expect(page.getByTestId('camera-countdown')).toBeVisible()
  })
})
