import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mockSupabaseClient, makeChain } from '@/test/supabase-mock'
import { makeProject } from '@/test/factories'

vi.mock('@/lib/supabase/server')
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => { throw new Error(`NEXT_REDIRECT:${url}`) }),
  revalidatePath: vi.fn(),
}))
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createProjectAction } from './projects'

const mocked = vi.mocked(createClient)
const mockedRedirect = vi.mocked(redirect)
const mockedRevalidate = vi.mocked(revalidatePath)

beforeEach(() => {
  mocked.mockReset()
  mockedRedirect.mockClear()
  mockedRevalidate.mockClear()
})

describe('createProjectAction', () => {
  it('inserts a project then revalidates and redirects', async () => {
    const created = makeProject({ id: 'new-id', name: 'My project' })
    const insertChain = makeChain({ data: created, error: null })
    const client = mockSupabaseClient({
      user: { id: 'u', email: 'a@b' },
      fromHandlers: { projects: () => insertChain },
    })
    mocked.mockResolvedValue(client as any)

    await expect(createProjectAction({ name: 'My project' })).rejects.toThrow(/NEXT_REDIRECT:\/project\/new-id/)
    expect(insertChain.insert).toHaveBeenCalledWith({
      name: 'My project',
      description: null,
      user_id: 'u',
    })
    expect(mockedRevalidate).toHaveBeenCalledWith('/', 'layout')
  })

  it('rejects empty name', async () => {
    await expect(createProjectAction({ name: '   ' })).rejects.toThrow(/name is required/i)
  })

  it('rejects name longer than 100 chars', async () => {
    const long = 'x'.repeat(101)
    await expect(createProjectAction({ name: long })).rejects.toThrow(/100/)
  })

  it('passes description when provided', async () => {
    const created = makeProject({ id: 'p2' })
    const insertChain = makeChain({ data: created, error: null })
    const client = mockSupabaseClient({
      user: { id: 'u', email: 'a@b' },
      fromHandlers: { projects: () => insertChain },
    })
    mocked.mockResolvedValue(client as any)

    await expect(createProjectAction({ name: 'X', description: 'desc' })).rejects.toThrow(/NEXT_REDIRECT/)
    expect(insertChain.insert).toHaveBeenCalledWith({
      name: 'X',
      description: 'desc',
      user_id: 'u',
    })
  })

  it('throws Not authenticated when no user', async () => {
    const client = mockSupabaseClient({ user: null })
    mocked.mockResolvedValue(client as any)
    await expect(createProjectAction({ name: 'X' })).rejects.toThrow(/not authenticated/i)
  })

  it('surfaces Supabase insert error', async () => {
    const insertChain = makeChain({ data: null, error: { message: 'permission denied' } })
    const client = mockSupabaseClient({
      user: { id: 'u', email: 'a@b' },
      fromHandlers: { projects: () => insertChain },
    })
    mocked.mockResolvedValue(client as any)

    await expect(createProjectAction({ name: 'X' })).rejects.toThrow(/permission denied/)
  })
})
