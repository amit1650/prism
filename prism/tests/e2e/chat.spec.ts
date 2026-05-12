import path from 'path'
import { test, expect, signUpInUI } from './helpers'

test('full chat flow: signup → message → upload → analyse stub', async ({ page, testUser }) => {
  await signUpInUI(page, testUser)

  // Create a project from the welcome screen
  await page.getByRole('button', { name: /create your first project/i }).click()
  await page.getByLabel(/project name/i).fill('E2E chat project')
  await page.getByRole('button', { name: /create & start/i }).click()
  await page.waitForURL(/\/project\/[^/]+$/)

  // Header is visible
  await expect(page.getByRole('heading', { name: 'E2E chat project' })).toBeVisible()
  await expect(page.getByRole('link', { name: /analyse project/i })).toBeVisible()

  // Welcome message
  await expect(page.getByText(/what project do you want to plan/i)).toBeVisible()

  // Send a message. Chatscope's MessageInput is a contenteditable, not an <input>,
  // so we focus it and type via the keyboard rather than using locator.fill().
  const messageList = page.locator('.cs-message-list')
  const editor = page.locator('.cs-message-input__content-editor')
  await editor.click()
  await page.keyboard.type('We are building a CRM tool.')
  await page.keyboard.press('Enter')

  // The user message renders immediately (contains 'CRM'). Wait specifically for the
  // typing indicator to disappear — that means the stream has completed AND the
  // server-side assistant-message insert finished (the route awaits it before close).
  const typingIndicator = page.locator('.cs-typing-indicator')
  await expect(typingIndicator).toBeVisible({ timeout: 5_000 })
  await expect(typingIndicator).toHaveCount(0, { timeout: 60_000 })

  // After streaming completes there should be exactly 3 messages: welcome + user + assistant.
  await expect(messageList.locator('.cs-message')).toHaveCount(3)

  // Reload — messages should persist. The welcome is a client-only virtual message,
  // so after reload we'll see just the user + assistant (2 messages, no welcome).
  await page.reload()
  await expect(messageList.locator('.cs-message')).toHaveCount(2, { timeout: 10_000 })
  await expect(messageList).toContainText(/CRM/i)
  // Welcome should NOT be present after reload (DB has 2 real messages, length > 0)
  await expect(messageList).not.toContainText(/what project do you want to plan/i)

  // Upload a small text file
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles(
    path.resolve(__dirname, '..', '..', 'src', 'test', 'fixtures', 'sample.txt')
  )
  // The upload renders as a file card (filename header + preview body). The LLM
  // still receives the "[Uploaded: ...]" text — but in the chat view it's a card.
  await expect(messageList.locator('.upload-card')).toBeVisible({ timeout: 30_000 })
  await expect(messageList.locator('.upload-card__head')).toContainText('sample.txt')
  await expect(messageList.locator('.upload-card__body')).toContainText(/Prism Test Document/i)
  // And the assistant's streamed acknowledgement completes.
  await expect(typingIndicator).toHaveCount(0, { timeout: 60_000 })

  // Click "Analyse Project" → stub page
  await page.getByRole('link', { name: /analyse project/i }).click()
  await page.waitForURL(/\/project\/[^/]+\/qa$/)
  await expect(page.getByRole('heading', { name: /q&a wizard/i })).toBeVisible()
})
