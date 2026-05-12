import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, userEvent } from '@/test/render'
import { mockSupabaseClient } from '@/test/supabase-mock'

vi.mock('@/lib/supabase/client')

const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
}))

import { createClient } from '@/lib/supabase/client'
import { SignOutButton } from './SignOutButton'

const mocked = vi.mocked(createClient)

beforeEach(() => {
  mocked.mockReset()
  pushMock.mockReset()
})

describe('SignOutButton', () => {
  it('signs out and navigates to /login', async () => {
    const client = mockSupabaseClient()
    mocked.mockReturnValue(client as any)
    render(<SignOutButton />)
    await userEvent.click(screen.getByRole('button', { name: /sign out/i }))
    expect(client.auth.signOut).toHaveBeenCalled()
    expect(pushMock).toHaveBeenCalledWith('/login')
  })

  it('still navigates even if signOut errors', async () => {
    const client = mockSupabaseClient({
      authHandlers: {
        signOut: vi.fn(async () => ({ error: { message: 'boom' } })),
      },
    })
    mocked.mockReturnValue(client as any)
    render(<SignOutButton />)
    await userEvent.click(screen.getByRole('button', { name: /sign out/i }))
    expect(pushMock).toHaveBeenCalledWith('/login')
  })
})
