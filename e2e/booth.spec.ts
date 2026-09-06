import { expect, test, type Page } from '@playwright/test'

test.use({
  baseURL: process.env.QA_BASE_URL ?? 'http://localhost:4173',
})

function cta(page: Page, name: string) {
  return page.getByRole('button', { name }).or(page.getByRole('link', { name })).first()
}

test.describe('Booth Bareng join paths', () => {
  test('keeps local camera navigation independent of booth', async ({ page }) => {
    await page.goto('/')

    await cta(page, 'Mulai Foto').click()

    await expect(page).toHaveURL('/config?source=camera')
    await expect(page.getByRole('heading', { name: 'Atur Sesi' })).toBeVisible()
  })

  test('host sees a room code and invite URL after creating a booth', async ({ page }) => {
    await page.goto('/')
    await cta(page, 'Booth Bareng').click()

    await expect(page).toHaveURL('/booth')
    await expect(page.getByRole('heading', { name: 'Booth Bareng' })).toBeVisible()

    await page.getByRole('button', { name: 'Buat Booth' }).click()

    const code = page.getByTestId('booth-code')
    await expect(code).toBeVisible()
    const roomCode = (await code.innerText()).trim()
    expect(roomCode).toMatch(/^[A-Z0-9]{3}-[A-Z0-9]{3}$/)

    const invite = page.getByLabel('Link undangan')
    await expect(invite).toHaveValue(new RegExp(`/j/${roomCode}$`))
    await expect(page).toHaveURL(new RegExp(`/j/${roomCode}$`))
  })

  test('guest can join by typing the host code', async ({ context, page }) => {
    await page.goto('/')
    await cta(page, 'Booth Bareng').click()
    await page.getByRole('button', { name: 'Buat Booth' }).click()

    const roomCode = (await page.getByTestId('booth-code').innerText()).trim()

    const guest = await context.newPage()
    await guest.goto('/booth')
    await guest.getByLabel('Kode booth').fill(roomCode)
    await guest.getByRole('button', { name: 'Gabung' }).click()

    await expect(guest).toHaveURL(new RegExp(`/j/${roomCode}$`))
    await expect(guest.getByTestId('booth-code')).toHaveText(roomCode)
    await expect(guest.getByLabel('Link undangan')).toHaveValue(new RegExp(`/j/${roomCode}$`))
  })

  test('invite URL enters the same booth as the host code', async ({ context, page }) => {
    await page.goto('/')
    await cta(page, 'Booth Bareng').click()
    await page.getByRole('button', { name: 'Buat Booth' }).click()

    const roomCode = (await page.getByTestId('booth-code').innerText()).trim()
    const inviteUrl = await page.getByLabel('Link undangan').inputValue()

    const guest = await context.newPage()
    await guest.goto(inviteUrl)

    await expect(guest).toHaveURL(new RegExp(`/j/${roomCode}$`))
    await expect(guest.getByTestId('booth-code')).toHaveText(roomCode)
    await expect(guest.getByText('Booth tidak ditemukan')).toHaveCount(0)
  })
})
