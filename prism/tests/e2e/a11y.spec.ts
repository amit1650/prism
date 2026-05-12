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

  test('/project/[id]/qa (with knowledge graph seeded)', async ({ page, testUser }) => {
    test.setTimeout(180_000)

    await signUpInUI(page, testUser)
    await page.getByRole('button', { name: /create your first project/i }).click()
    await page.getByLabel(/project name/i).fill('A11y parse project')
    await page.getByRole('button', { name: /create & start/i }).click()
    await page.waitForURL(/\/project\/[^/]+$/)

    const editor = page.locator('.cs-message-input__content-editor')
    const typing = page.locator('.cs-typing-indicator')
    await editor.click()
    await page.keyboard.type('We are building a small SaaS dashboard for analytics.')
    await page.keyboard.press('Enter')
    await typing.waitFor({ state: 'visible', timeout: 10_000 })
    await typing.waitFor({ state: 'hidden', timeout: 60_000 })

    await page.getByRole('link', { name: /analyse project/i }).click()
    await page.waitForURL(/\/project\/[^/]+\/qa$/)

    await page.getByRole('heading', { name: /here.{1,3}s what i understood/i }).waitFor({ timeout: 90_000 })

    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })
})
