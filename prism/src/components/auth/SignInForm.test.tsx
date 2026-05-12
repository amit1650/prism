import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, userEvent } from '@/test/render'
import { mockSupabaseClient } from '@/test/supabase-mock'

vi.mock('@/lib/supabase/client')

const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
}))

import { createClient } from '@/lib/supabase/client'
import { SignInForm } from './SignInForm'

const mocked = vi.mocked(createClient)

beforeEach(() => {
  mocked.mockReset()
  pushMock.mockReset()
})

describe('SignInForm', () => {
  it('renders email + password inputs and a sign-in button', () => {
    mocked.mockReturnValue(mockSupabaseClient() as any)
    render(<SignInForm />)
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument()
  })

  it('signs in and navigates to /dashboard on success', async () => {
    const client = mockSupabaseClient({ user: { id: 'u', email: 'a@b' } })
    mocked.mockReturnValue(client as any)
    render(<SignInForm />)
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /^sign in$/i }))
    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'password123',
    })
    expect(pushMock).toHaveBeenCalledWith('/dashboard')
  })

  it('shows inline error on bad credentials', async () => {
    const client = mockSupabaseClient({
      authHandlers: {
        signInWithPassword: vi.fn(async () => ({
          data: { user: null, session: null },
          error: { message: 'Invalid login credentials' },
        })),
      },
    })
    mocked.mockReturnValue(client as any)
    render(<SignInForm />)
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: /^sign in$/i }))
    expect(await screen.findByText(/email or password is incorrect/i)).toBeInTheDocument()
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('disables button while submitting', async () => {
    let resolveFn!: (v: any) => void
    const client = mockSupabaseClient({
      authHandlers: {
        signInWithPassword: vi.fn(() => new Promise((res) => { resolveFn = res })),
      },
    })
    mocked.mockReturnValue(client as any)
    render(<SignInForm />)
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'password123')
    const btn = screen.getByRole('button', { name: /^sign in$/i })
    await userEvent.click(btn)
    expect(btn).toBeDisabled()
    resolveFn({ data: { user: { id: 'u' } }, error: null })
  })

  it('links to /signup', () => {
    mocked.mockReturnValue(mockSupabaseClient() as any)
    render(<SignInForm />)
    expect(screen.getByRole('link', { name: /create one/i })).toHaveAttribute('href', '/signup')
  })
})
