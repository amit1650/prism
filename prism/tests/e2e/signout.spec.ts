import { test, expect, signUpInUI } from './helpers'

test('signs out and prevents back-navigation to dashboard', async ({ page, testUser }) => {
  await signUpInUI(page, testUser)
  await expect(page).toHaveURL(/\/dashboard$/)

  await page.getByRole('button', { name: /sign out/i }).click()
  await expect(page).toHaveURL(/\/login$/)

  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login$/)
})
