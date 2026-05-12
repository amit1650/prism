import { createClient } from '@supabase/supabase-js'
import { test as base, expect, type Page } from '@playwright/test'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SERVICE_ROLE) {
  throw new Error('E2E helpers require NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env')
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
})

export type TestUser = {
  email: string
  password: string
  name: string
  id?: string
}

export function makeTestUser(prefix = 'e2e'): TestUser {
  const ts = Date.now()
  const rnd = Math.random().toString(36).slice(2, 8)
  return {
    email: `${prefix}+${ts}+${rnd}@prism.test`,
    password: 'TestPass123!',
    name: 'E2E Tester',
  }
}

export async function signUpInUI(page: Page, user: TestUser) {
  await page.goto('/signup')
  await page.getByLabel(/your name/i).fill(user.name)
  await page.getByLabel(/email/i).fill(user.email)
  await page.getByLabel(/password/i).fill(user.password)
  await page.getByRole('button', { name: /create account/i }).click()
  await page.waitForURL(/\/dashboard$/)
}

export async function signInInUI(page: Page, user: TestUser) {
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(user.email)
  await page.getByLabel(/password/i).fill(user.password)
  await page.getByRole('button', { name: /^sign in$/i }).click()
  await page.waitForURL(/\/dashboard$/)
}

export async function deleteTestUser(email: string) {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 })
  const found = list?.users.find((u) => u.email === email)
  if (found) {
    await admin.auth.admin.deleteUser(found.id)
  }
}

export const test = base.extend<{ testUser: TestUser }>({
  testUser: async ({}, use) => {
    const user = makeTestUser()
    await use(user)
    try {
      await deleteTestUser(user.email)
    } catch (err) {
      // Best-effort cleanup — don't fail the test on a missed delete,
      // but surface the error so leaked accounts don't pile up silently.
      console.warn(`[e2e] failed to delete test user ${user.email}:`, err)
    }
  },
})

export { expect }
