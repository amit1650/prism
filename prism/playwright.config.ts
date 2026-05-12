import { defineConfig, devices } from '@playwright/test'
import fs from 'fs'
import path from 'path'

// Load .env.local so E2E helpers can access NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
const envLocalPath = path.resolve(__dirname, '.env.local')
if (fs.existsSync(envLocalPath)) {
  const lines = fs.readFileSync(envLocalPath, 'utf-8').split('\n')
  for (const line of lines) {
    const match = line.match(/^([^#=\s][^=]*)=(.*)$/)
    if (match) {
      const [, key, value] = match
      if (!(key in process.env)) process.env[key] = value
    }
  }
}

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // We touch shared Supabase auth state
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    actionTimeout: 10_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
