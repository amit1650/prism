import path from 'path'
import { test, expect, signUpInUI } from './helpers'

test('full chat → analyse → summary → proceed flow', async ({ page, testUser }) => {
  test.setTimeout(180_000) // 3 minutes — analysis can take up to ~60s

  await signUpInUI(page, testUser)

  // Create project from welcome screen.
  await page.getByRole('button', { name: /create your first project/i }).click()
  await page.getByLabel(/project name/i).fill('E2E parse project')
  await page.getByRole('button', { name: /create & start/i }).click()
  await page.waitForURL(/\/project\/[^/]+$/)

  // Send a meaningful message so the project has real content.
  const editor = page.locator('.cs-message-input__content-editor')
  const typing = page.locator('.cs-typing-indicator')
  await editor.click()
  await page.keyboard.type(
    'We are building a CRM for small e-commerce shops. It tracks orders, sends follow-up emails, and analyses repeat-purchase behaviour.'
  )
  await page.keyboard.press('Enter')
  await typing.waitFor({ state: 'visible', timeout: 10_000 })
  await typing.waitFor({ state: 'hidden', timeout: 60_000 })

  // Upload a doc for richer analysis.
  await page
    .locator('input[type="file"]')
    .setInputFiles(path.resolve(__dirname, '..', '..', 'src', 'test', 'fixtures', 'sample.txt'))
  await page.locator('.upload-card').waitFor({ timeout: 30_000 })
  await typing.waitFor({ state: 'hidden', timeout: 60_000 })

  // Trigger the analysis.
  await page.getByRole('link', { name: /analyse project/i }).click()
  await page.waitForURL(/\/project\/[^/]+\/qa$/)

  // Spinner with rotating label.
  await expect(page.locator('[role="status"]')).toBeVisible()
  await expect(
    page.getByText(/reading your chat|extracting facts|looking for conflicts|surfacing assumptions|identifying gaps/i)
  ).toBeVisible()

  // Wait up to 90s for the summary to render.
  await expect(page.getByRole('heading', { name: /here.{1,3}s what i understood/i })).toBeVisible({
    timeout: 90_000,
  })

  // At least one section heading should appear.
  const sectionHeadings = page.locator('h3', {
    hasText: /confirmed facts|inferred|open questions|conflicts/i,
  })
  expect(await sectionHeadings.count()).toBeGreaterThan(0)

  // Proceed link goes to the wizard stub.
  await page.getByRole('link', { name: /proceed to q&a/i }).click()
  await page.waitForURL(/\/project\/[^/]+\/qa\/wizard$/)
  await expect(page.getByRole('heading', { name: /q&a wizard/i })).toBeVisible()
  await expect(page.getByText(/coming in m4/i)).toBeVisible()
})
