import { expect, test } from '@playwright/test'

test.use({
  launchOptions: {
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  },
})

test.describe('live cam countdown recording', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Uses Chromium fake cameras')
  test.setTimeout(30_000)

  test('starts Rec as soon as a 5 second countdown begins', async ({ page }) => {
    await page.goto('/camera')
    const shutter = page.getByRole('button', { name: 'Ambil foto', exact: true })
    await expect(shutter).toBeEnabled()

    await page.getByRole('button', { name: 'Ubah pengaturan sesi', exact: true }).click()
    const editor = page.getByTestId('capture-session-editor')
    await expect(editor).toBeVisible()
    await editor.getByRole('combobox', { name: 'Timer', exact: true }).selectOption('5')
    await editor.getByRole('button', { name: 'Terapkan', exact: true }).click()
    await expect(editor).toBeHidden()

    await shutter.click()
    await expect(page.getByTestId('camera-countdown')).toContainText('5')
    await expect(page.getByTestId('live-cam-recording')).toBeVisible()

    await page.getByRole('button', { name: 'Batal', exact: true }).click()
    await expect(page.getByTestId('camera-countdown')).toBeHidden()
    await expect(page.getByTestId('live-cam-recording')).toBeHidden()
  })
})
