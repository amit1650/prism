import { test, expect, signUpInUI } from './helpers'

test.describe('Auth guard', () => {
  test('unauthenticated /dashboard redirects to /login', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('unauthenticated /project/anything redirects to /login', async ({ page }) => {
    await page.goto('/project/some-id')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('authenticated /login redirects to /dashboard', async ({ page, testUser }) => {
    await signUpInUI(page, testUser)
    await page.goto('/login')
    await expect(page).toHaveURL(/\/dashboard$/)
  })

  test('authenticated /signup redirects to /dashboard', async ({ page, testUser }) => {
    await signUpInUI(page, testUser)
    await page.goto('/signup')
    await expect(page).toHaveURL(/\/dashboard$/)
  })
})
