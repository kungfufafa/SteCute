import { expect, type Page } from '@playwright/test'

export async function startHostBooth(page: Page) {
  await page.getByRole('button', { name: 'Buat Booth' }).click()
  await expect(page).toHaveURL(/\/config\?source=booth/)
  await page.getByRole('button', { name: 'Buka Booth' }).filter({ visible: true }).click()
  await expect(page).toHaveURL(/\/j\/[A-Z0-9]{3}-[A-Z0-9]{3}$/)
}
