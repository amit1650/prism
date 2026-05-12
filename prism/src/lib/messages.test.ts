import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mockSupabaseClient, makeChain } from '@/test/supabase-mock'
import type { ProjectMessage } from '@/types/project'

vi.mock('@/lib/supabase/server')

import { createClient } from '@/lib/supabase/server'
import { getProjectMessages } from './messages'

const mocked = vi.mocked(createClient)

beforeEach(() => {
  mocked.mockReset()
})

const sampleMessages: ProjectMessage[] = [
  { id: 'm1', project_id: 'p', role: 'user', content: 'hi', created_at: '2026-05-12T00:00:00Z' },
  { id: 'm2', project_id: 'p', role: 'assistant', content: 'hello', created_at: '2026-05-12T00:00:01Z' },
]

describe('getProjectMessages', () => {
  it('returns rows ordered by created_at asc', async () => {
    const client = mockSupabaseClient({
      user: { id: 'u', email: 'a@b' },
      fromHandlers: {
        project_messages: () => makeChain({ data: sampleMessages, error: null }),
      },
    })
    mocked.mockResolvedValue(client as any)

    const result = await getProjectMessages('p')
    expect(result).toEqual(sampleMessages)
    expect(client.from).toHaveBeenCalledWith('project_messages')
  })

  it('throws when no user', async () => {
    const client = mockSupabaseClient({ user: null })
    mocked.mockResolvedValue(client as any)
    await expect(getProjectMessages('p')).rejects.toThrow(/not authenticated/i)
  })
})
