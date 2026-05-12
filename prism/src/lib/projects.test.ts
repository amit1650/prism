import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mockSupabaseClient, makeChain } from '@/test/supabase-mock'
import { makeProject } from '@/test/factories'

vi.mock('@/lib/supabase/server')

import { createClient } from '@/lib/supabase/server'
import { getProjects, getProjectCount, getProjectById } from './projects'

const mocked = vi.mocked(createClient)

beforeEach(() => {
  mocked.mockReset()
})

describe('getProjects', () => {
  it('returns rows scoped by RLS (no explicit user_id filter)', async () => {
    const projects = [makeProject({ name: 'A' }), makeProject({ name: 'B' })]
    const client = mockSupabaseClient({
      user: { id: 'u', email: 'a@b' },
      fromHandlers: {
        projects: () => makeChain({ data: projects, error: null }),
      },
    })
    mocked.mockResolvedValue(client as any)

    const result = await getProjects()
    expect(result).toEqual(projects)
    expect(client.from).toHaveBeenCalledWith('projects')
  })

  it('throws when no user', async () => {
    const client = mockSupabaseClient({ user: null })
    mocked.mockResolvedValue(client as any)
    await expect(getProjects()).rejects.toThrow(/not authenticated/i)
  })

  it('throws when query errors', async () => {
    const client = mockSupabaseClient({
      user: { id: 'u', email: 'a@b' },
      fromHandlers: {
        projects: () => makeChain({ data: null, error: { message: 'boom' } }),
      },
    })
    mocked.mockResolvedValue(client as any)
    await expect(getProjects()).rejects.toThrow(/boom/)
  })
})

describe('getProjectCount', () => {
  it('returns the count', async () => {
    const client = mockSupabaseClient({
      user: { id: 'u', email: 'a@b' },
      fromHandlers: {
        projects: () => makeChain({ data: null, error: null, count: 3 }),
      },
    })
    mocked.mockResolvedValue(client as any)

    const count = await getProjectCount()
    expect(count).toBe(3)
  })

  it('returns 0 when count is null', async () => {
    const client = mockSupabaseClient({
      user: { id: 'u', email: 'a@b' },
      fromHandlers: {
        projects: () => makeChain({ data: null, error: null }),
      },
    })
    mocked.mockResolvedValue(client as any)
    expect(await getProjectCount()).toBe(0)
  })
})

describe('getProjectById', () => {
  it('returns project when found', async () => {
    const p = makeProject({ id: 'abc', name: 'X' })
    const client = mockSupabaseClient({
      user: { id: 'u', email: 'a@b' },
      fromHandlers: {
        projects: () => makeChain({ data: p, error: null }),
      },
    })
    mocked.mockResolvedValue(client as any)

    expect(await getProjectById('abc')).toEqual(p)
  })

  it('returns null when not found (PGRST116)', async () => {
    const client = mockSupabaseClient({
      user: { id: 'u', email: 'a@b' },
      fromHandlers: {
        projects: () => makeChain({ data: null, error: null }),
      },
    })
    mocked.mockResolvedValue(client as any)

    expect(await getProjectById('missing')).toBeNull()
  })
})
