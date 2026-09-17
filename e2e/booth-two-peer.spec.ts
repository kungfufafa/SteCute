import { expect, test } from '@playwright/test'

test.use({
  launchOptions: {
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  },
})

test.describe('Booth Bareng two-peer camera corroboration', () => {
  test.skip(
    !process.env.BOOTH_TWO_PEER,
    'Corroboration-only two-peer camera run; set BOOTH_TWO_PEER=1 to enable.',
  )
  test.skip(({ browserName }) => browserName !== 'chromium', 'Fake camera smoke runs in Chromium')

  test('two pages in one booth can show a camera preview', async ({ context }) => {
    const host = await context.newPage()
    await host.goto('/')
    await host.getByRole('button', { name: 'Foto Duet' }).click()
    await host.getByRole('button', { name: 'Buat Booth' }).click()

    const roomCode = (await host.getByTestId('booth-code').innerText()).trim()
    await expect(host.getByTestId('booth-local-video')).toBeVisible({ timeout: 15_000 })
    await expect(host.getByTestId('booth-remote-tile')).toBeVisible()
    await expect(host.getByTestId('booth-local-video')).toHaveClass(/scale-x-\[-1\]/)
    await expect(host.getByTestId('booth-remote-video')).toHaveClass(/scale-x-\[-1\]/)

    const guest = await context.newPage()
    await guest.goto(`/j/${roomCode}`)
    await expect(guest.getByTestId('booth-code')).toHaveText(roomCode)
    await expect(guest.getByTestId('booth-local-video')).toBeVisible({ timeout: 15_000 })
    await expect(guest.getByTestId('booth-local-tile')).toContainText('Kamu')
    await expect(guest.getByTestId('booth-local-video')).toHaveClass(/scale-x-\[-1\]/)
    await expect(guest.getByTestId('booth-remote-video')).toHaveClass(/scale-x-\[-1\]/)
  })
})
