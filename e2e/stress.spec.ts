import { expect, test, type Page } from '@playwright/test'
import { startHostBooth } from './booth-flow'

function cta(page: Page, name: string) {
  return page.getByRole('button', { name }).or(page.getByRole('link', { name })).first()
}

test.use({ baseURL: process.env.STRESS_BASE_URL ?? 'http://127.0.0.1:5173' })

test.describe('Stecute UI stress', () => {
  test.describe.configure({ timeout: 90_000 })

  test('rapid booth create, bad joins, and local camera nav stay stable', async ({ page }) => {
    const codes: string[] = []

    for (let index = 0; index < 12; index++) {
      await page.goto('/booth')
      await startHostBooth(page)
      const code = (await page.getByTestId('booth-code').innerText()).trim()
      expect(code).toMatch(/^[A-Z2-9]{3}-[A-Z2-9]{3}$/)
      codes.push(code)
      await expect(page.getByTestId('booth-invite-url')).toHaveValue(new RegExp(`/j/${code}$`))
    }

    expect(new Set(codes).size).toBe(codes.length)

    const junk = ['', '@@@', 'AB', 'ZZZZZZZ', 'ABC0EF', '<script>', '🎉🎉🎉']
    for (const value of junk) {
      await page.goto('/booth')
      if (value) await page.getByLabel('Kode booth').fill(value)
      await page.getByRole('button', { name: 'Gabung' }).click()
      await expect(page.getByRole('alert')).toBeVisible()
      await expect(page.getByTestId('booth-code')).toHaveCount(0)
    }

    await page.goto('/')
    await cta(page, 'Mulai Foto').click()
    await expect(page).toHaveURL('/config?source=camera')
    await expect(page.getByRole('heading', { name: 'Atur Sesi' })).toBeVisible()
  })

  test('many guests hitting one invite still resolve the same booth identity', async ({
    context,
    page,
  }) => {
    await page.goto('/booth')
    await startHostBooth(page)
    const code = (await page.getByTestId('booth-code').innerText()).trim()
    const inviteUrl = await page.getByTestId('booth-invite-url').inputValue()

    const guests = await Promise.all(Array.from({ length: 6 }, () => context.newPage()))
    await Promise.all(guests.map((guest) => guest.goto(inviteUrl)))

    // The 2-participant cap cleanly rejects extra guests once the host is live:
    // each guest must either show the room code or the "penuh" rejection, never "not found".
    // A guest can transition joined -> rejected while the cap settles, so snapshot tolerantly.
    for (const guest of guests) {
      const codeButton = guest.getByTestId('booth-code')
      const fullNotice = guest.getByText('Booth sudah penuh')
      await expect(codeButton.or(fullNotice)).toBeVisible({ timeout: 30_000 })
      const codeText = await codeButton.textContent({ timeout: 1_000 }).catch(() => null)
      if (codeText !== null) {
        expect(codeText.trim()).toBe(code)
      } else {
        await expect(fullNotice).toBeVisible()
      }
      await expect(guest.getByText('Booth tidak ditemukan')).toHaveCount(0)
    }

    await Promise.all(guests.map((guest) => guest.close()))
  })

  test('hammering landing CTAs does not strand the local upload route', async ({ page }) => {
    for (let index = 0; index < 8; index++) {
      await page.goto('/')
      await cta(page, 'Foto Duet').click()
      await expect(page).toHaveURL('/booth')
      await page.goto('/')
      await cta(page, 'Mulai Foto').click()
      await expect(page).toHaveURL('/config?source=camera')
      await page.goto('/')
      await cta(page, 'Upload Lokal').click()
      await expect(page).toHaveURL('/config?source=upload')
    }

    await page.goto('/')
    await expect(cta(page, 'Mulai Foto')).toBeVisible()
    await expect(cta(page, 'Upload Lokal')).toBeVisible()
    await expect(cta(page, 'Foto Duet')).toBeVisible()
  })
})
