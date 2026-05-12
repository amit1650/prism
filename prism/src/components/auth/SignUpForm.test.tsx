import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, userEvent } from '@/test/render'
import { mockSupabaseClient } from '@/test/supabase-mock'

vi.mock('@/lib/supabase/client')

const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
}))

import { createClient } from '@/lib/supabase/client'
import { SignUpForm } from './SignUpForm'

const mocked = vi.mocked(createClient)

beforeEach(() => {
  mocked.mockReset()
  pushMock.mockReset()
})

describe('SignUpForm', () => {
  it('renders name, email, password inputs and create-account button', () => {
    mocked.mockReturnValue(mockSupabaseClient() as any)
    render(<SignUpForm />)
    expect(screen.getByLabelText(/your name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
  })

  it('passes display_name in signUp metadata and navigates on success', async () => {
    const client = mockSupabaseClient({ user: { id: 'u', email: 'a@b' } })
    mocked.mockReturnValue(client as any)
    render(<SignUpForm />)
    await userEvent.type(screen.getByLabelText(/your name/i), 'Amit')
    await userEvent.type(screen.getByLabelText(/email/i), 'amit@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'StrongPass1')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(client.auth.signUp).toHaveBeenCalledWith({
      email: 'amit@example.com',
      password: 'StrongPass1',
      options: { data: { display_name: 'Amit' } },
    })
    expect(pushMock).toHaveBeenCalledWith('/dashboard')
  })

  it('shows existing-email error', async () => {
    const client = mockSupabaseClient({
      authHandlers: {
        signUp: vi.fn(async () => ({
          data: { user: null, session: null },
          error: { message: 'User already registered' },
        })),
      },
    })
    mocked.mockReturnValue(client as any)
    render(<SignUpForm />)
    await userEvent.type(screen.getByLabelText(/your name/i), 'Amit')
    await userEvent.type(screen.getByLabelText(/email/i), 'taken@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'StrongPass1')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByText(/account with this email already exists/i)).toBeInTheDocument()
  })

  it('shows weak-password error', async () => {
    const client = mockSupabaseClient({
      authHandlers: {
        signUp: vi.fn(async () => ({
          data: { user: null, session: null },
          error: { message: 'Password should be at least 8 characters' },
        })),
      },
    })
    mocked.mockReturnValue(client as any)
    render(<SignUpForm />)
    await userEvent.type(screen.getByLabelText(/your name/i), 'Amit')
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'short')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument()
  })

  it('links to /login', () => {
    mocked.mockReturnValue(mockSupabaseClient() as any)
    render(<SignUpForm />)
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login')
  })
})
