import { expect, test, type Page } from '@playwright/test'
import { Buffer } from 'node:buffer'
import { resolve } from 'node:path'

type RenderTestWindow = typeof window & {
  __renderTest: {
    hold: boolean
    quota: boolean
    release: (() => void) | null
  }
}

async function prepareReview(page: Page) {
  await page.goto('/config?source=upload')
  await page.getByRole('button', { name: 'Pilih Foto', exact: true }).click()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: /^Pilih Foto Lokal/ }).click()
  await (
    await chooser
  ).setFiles([
    resolve('e2e/fixtures/images/1759243291185.png'),
    resolve('e2e/fixtures/images/1769149454852.png'),
    resolve('e2e/fixtures/images/1770039834020.png'),
  ])
  await page.getByRole('button', { name: 'Lanjut ke Preview' }).click()
  await expect(page).toHaveURL('/review')
  await expect(page.getByRole('button', { name: 'Buat Hasil Akhir' })).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const state: RenderTestWindow['__renderTest'] = { hold: false, quota: false, release: null }
    ;(window as RenderTestWindow).__renderTest = state
    // Exercise the supported main-thread path so completion can be controlled.
    Object.defineProperty(window, 'Worker', { configurable: true, value: undefined })
    const toBlob = HTMLCanvasElement.prototype.toBlob
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      toBlob.call(
        this,
        (blob) => {
          if (state.hold && this.width === 1200 && this.height === 2740) {
            state.release = () => {
              state.hold = false
              state.release = null
              callback(blob)
            }
          } else callback(blob)
        },
        type,
        quality,
      )
    }
    const add = IDBObjectStore.prototype.add
    IDBObjectStore.prototype.add = function (value, key) {
      if (state.quota && this.name === 'renders') {
        throw new DOMException('Injected storage full', 'QuotaExceededError')
      }
      return key === undefined ? add.call(this, value) : add.call(this, value, key)
    }
  })
})

test('leaving a delayed render preserves the draft and renders the latest replacement', async ({
  page,
}) => {
  await prepareReview(page)
  await page.evaluate(() => {
    ;(window as RenderTestWindow).__renderTest.hold = true
  })
  await page.getByRole('button', { name: 'Buat Hasil Akhir' }).click()
  await expect
    .poll(() => page.evaluate(() => Boolean((window as RenderTestWindow).__renderTest.release)))
    .toBe(true)
  await expect(
    page
      .getByRole('navigation', { name: 'Progress sesi Stecute' })
      .locator('[aria-current="step"]'),
  ).toHaveText('Render')

  await page.goBack()
  await expect(page).toHaveURL('/upload')
  await expect(page.getByRole('img', { name: /^Upload [1-3]$/ })).toHaveCount(3)

  const replacementBase64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 400
    canvas.height = 300
    const context = canvas.getContext('2d')!
    context.fillStyle = 'rgb(15, 190, 80)'
    context.fillRect(0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png').split(',')[1]
  })
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Ganti Foto Ini', exact: true }).click()
  await (
    await chooser
  ).setFiles({
    name: 'replacement.png',
    mimeType: 'image/png',
    buffer: Buffer.from(replacementBase64, 'base64'),
  })

  // Keep the old job unresolved while a fresh job for the edited session finishes.
  await page.evaluate(() => {
    ;(window as RenderTestWindow).__renderTest.hold = false
  })
  await page.getByRole('button', { name: 'Lanjut ke Preview', exact: true }).click()
  await expect(page).toHaveURL('/review')
  await page.getByRole('button', { name: 'Buat Hasil Akhir', exact: true }).click()
  await expect(page).toHaveURL(/\/output\?renderId=.+/)
  const preview = page.getByRole('img', { name: 'Photo strip hasil render' })
  await expect(preview).toBeVisible()
  await expect
    .poll(() =>
      preview.evaluate((image) => {
        const canvas = document.createElement('canvas')
        canvas.width = 1200
        canvas.height = 2740
        const context = canvas.getContext('2d')!
        context.drawImage(image as HTMLImageElement, 0, 0)
        // The center of the first slot must contain the replacement, not the old snapshot.
        const pixel = Array.from(context.getImageData(600, 465, 1, 1).data)
        // Source shots use JPEG; allow its tiny color rounding while rejecting old photos.
        return pixel.every((channel, index) => Math.abs(channel - [15, 190, 80, 255][index]) <= 3)
      }),
    )
    .toBe(true)

  const outputUrl = page.url()
  await page.evaluate(() => {
    ;(window as RenderTestWindow).__renderTest.release!()
  })
  await expect(page).toHaveURL(outputUrl)
  await page.getByRole('button', { name: 'Kembali', exact: true }).click()
  await expect(page).toHaveURL('/gallery')
  await expect(page.getByText('1 item', { exact: true })).toBeVisible()
})

test('storage full still provides a downloadable PNG and an honest gallery status', async ({
  page,
}) => {
  await prepareReview(page)
  await page.evaluate(() => {
    ;(window as RenderTestWindow).__renderTest.quota = true
  })
  await page.getByRole('button', { name: 'Buat Hasil Akhir' }).click()
  await expect(page).toHaveURL(/\/output\?renderId=memory-/)
  await expect(page.getByRole('img', { name: 'Photo strip hasil render' })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('Hasil belum tersimpan di galeri')
  await expect(page.getByText('Tersimpan di galeri perangkat ini.', { exact: true })).toHaveCount(0)
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Unduh ke Perangkat', exact: true }).click()
  expect((await download).suggestedFilename()).toMatch(/\.png$/)
  await page.getByRole('button', { name: 'Lihat opsi tambahan' }).click()
  await page.getByRole('button', { name: 'Galeri', exact: true }).click()
  await expect(page.getByText('Belum Ada Hasil')).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('img', { name: 'Photo strip hasil render' })).toBeVisible()
})

test('a deleted gallery result is not restored from the output cache', async ({ page }) => {
  await prepareReview(page)
  await page.getByRole('button', { name: 'Buat Hasil Akhir', exact: true }).click()
  await expect(page).toHaveURL(/\/output\?renderId=.+/)
  await expect(page.getByRole('img', { name: 'Photo strip hasil render' })).toBeVisible()
  await page.getByRole('button', { name: 'Kembali', exact: true }).click()
  await expect(page).toHaveURL('/gallery')

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Hapus render 1', exact: true }).click()
  await expect(page.getByText('Belum Ada Hasil')).toBeVisible()
  await page.goBack()

  await expect(page.getByRole('heading', { name: 'Hasil Tidak Ditemukan' })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Photo strip hasil render' })).toHaveCount(0)
  await expect(page.getByText('Tersimpan di galeri perangkat ini.', { exact: true })).toHaveCount(0)
})
