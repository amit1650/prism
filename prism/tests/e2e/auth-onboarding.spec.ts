import { test, expect, makeTestUser, deleteTestUser } from './helpers'

test('full signup → welcome → modal create → project page', async ({ page }) => {
  const user = makeTestUser('e2e-onboarding')

  try {
    // Signup
    await page.goto('/signup')
    await page.getByLabel(/your name/i).fill(user.name)
    await page.getByLabel(/email/i).fill(user.email)
    await page.getByLabel(/password/i).fill(user.password)
    await page.getByRole('button', { name: /create account/i }).click()

    // Welcome screen
    await expect(page.getByRole('heading', { name: /welcome to prism/i })).toBeVisible()
    await expect(page.getByText(/01 \/ describe/i)).toBeVisible()
    await expect(page.getByText(/02 \/ refine/i)).toBeVisible()
    await expect(page.getByText(/03 \/ export/i)).toBeVisible()

    // CTA → dialog
    await page.getByRole('button', { name: /create your first project/i }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel(/project name/i)).toBeFocused()

    // Fill and submit
    await dialog.getByLabel(/project name/i).fill('My first project')
    await dialog.getByLabel(/one-line description/i).fill('Just trying it out')
    await dialog.getByRole('button', { name: /create & start/i }).click()

    // Lands on project page (M2: chat shell, no description shown in header)
    await page.waitForURL(/\/project\/[^/]+$/)
    await expect(page.getByRole('heading', { name: 'My first project' })).toBeVisible()
    await expect(page.getByText(/what project do you want to plan/i)).toBeVisible()

    // Sidebar shows the new row, marked active
    const row = page.getByRole('link', { name: /my first project/i })
    await expect(row).toBeVisible()
    await expect(row).toHaveAttribute('aria-current', 'page')
  } finally {
    await deleteTestUser(user.email).catch(() => {})
  }
})
