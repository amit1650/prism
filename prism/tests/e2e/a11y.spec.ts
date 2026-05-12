import AxeBuilder from '@axe-core/playwright'
import { test, expect, signUpInUI } from './helpers'

test.describe('Accessibility — no serious/critical violations', () => {
  test('/login', async ({ page }) => {
    await page.goto('/login')
    const results = await new AxeBuilder({ page })
      .disableRules(['region'])
      .analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('/signup', async ({ page }) => {
    await page.goto('/signup')
    const results = await new AxeBuilder({ page })
      .disableRules(['region'])
      .analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('/dashboard (welcome)', async ({ page, testUser }) => {
    await signUpInUI(page, testUser)
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('/project/[id] (with chat shell)', async ({ page, testUser }) => {
    await signUpInUI(page, testUser)
    await page.getByRole('button', { name: /create your first project/i }).click()
    await page.getByLabel(/project name/i).fill('A11y project')
    await page.getByRole('button', { name: /create & start/i }).click()
    await page.waitForURL(/\/project\/[^/]+$/)
    // Wait for the chat shell to fully render — header heading + welcome message.
    await page.getByRole('heading', { name: 'A11y project' }).waitFor()
    await page.getByText(/what project do you want to plan/i).waitFor()
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })
})
