import { test, expect, signUpInUI, signInInUI } from './helpers'

test('existing user signs in and sees EmptyState (not Welcome) after creating a project', async ({ page, testUser }) => {
  // Seed: signup, create a project, sign out
  await signUpInUI(page, testUser)
  await page.getByRole('button', { name: /create your first project/i }).click()
  await page.getByLabel(/project name/i).fill('Seeded project')
  await page.getByRole('button', { name: /create & start/i }).click()
  await page.waitForURL(/\/project\//)
  await page.getByRole('button', { name: /sign out/i }).click()

  // Sign back in
  await signInInUI(page, testUser)
  // EmptyState should show, not Welcome
  await expect(page.getByText(/select a project/i)).toBeVisible()
  await expect(page.getByRole('heading', { name: /welcome to prism/i })).toHaveCount(0)
  // Project should be in sidebar
  await expect(page.getByRole('link', { name: /seeded project/i })).toBeVisible()
})

test('login form shows inline error on wrong password', async ({ page, testUser }) => {
  await signUpInUI(page, testUser)
  await page.getByRole('button', { name: /sign out/i }).click()

  await page.goto('/login')
  await page.getByLabel(/email/i).fill(testUser.email)
  await page.getByLabel(/password/i).fill('wrongpassword!!')
  await page.getByRole('button', { name: /^sign in$/i }).click()
  await expect(page.getByText(/email or password is incorrect/i)).toBeVisible()
})
