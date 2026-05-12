import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mockSupabaseClient, makeChain } from '@/test/supabase-mock'
import { makeKnowledgeGraph } from '@/test/factories'

vi.mock('@/lib/supabase/server')

import { createClient } from '@/lib/supabase/server'
import { getKnowledgeGraph, upsertKnowledgeGraph } from './knowledge'

const mocked = vi.mocked(createClient)

beforeEach(() => {
  mocked.mockReset()
})

describe('getKnowledgeGraph', () => {
  it('returns the row when one exists', async () => {
    const graph = makeKnowledgeGraph({ project_id: 'p', version: 3 })
    const client = mockSupabaseClient({
      user: { id: 'u', email: 'a@b' },
      fromHandlers: {
        project_knowledge: () => makeChain({ data: graph, error: null }),
      },
    })
    mocked.mockResolvedValue(client as any)

    const result = await getKnowledgeGraph('p')
    expect(result).toEqual(graph)
  })

  it('returns null when no row exists', async () => {
    const client = mockSupabaseClient({
      user: { id: 'u', email: 'a@b' },
      fromHandlers: {
        project_knowledge: () => makeChain({ data: null, error: null }),
      },
    })
    mocked.mockResolvedValue(client as any)

    const result = await getKnowledgeGraph('p')
    expect(result).toBeNull()
  })

  it('throws when not authenticated', async () => {
    const client = mockSupabaseClient({ user: null })
    mocked.mockResolvedValue(client as any)
    await expect(getKnowledgeGraph('p')).rejects.toThrow(/not authenticated/i)
  })
})

describe('upsertKnowledgeGraph', () => {
  it('inserts when isFirstRun is true', async () => {
    const chain = makeChain({ data: { id: 'new' }, error: null })
    const client = mockSupabaseClient({
      user: { id: 'u', email: 'a@b' },
      fromHandlers: { project_knowledge: () => chain },
    })
    mocked.mockResolvedValue(client as any)

    const graph = makeKnowledgeGraph({ project_id: 'p', version: 1 })
    await upsertKnowledgeGraph(graph, true)

    expect(chain.insert).toHaveBeenCalledTimes(1)
    expect(chain.update).not.toHaveBeenCalled()
  })

  it('updates when isFirstRun is false', async () => {
    const chain = makeChain({ data: { id: 'u' }, error: null })
    const client = mockSupabaseClient({
      user: { id: 'u', email: 'a@b' },
      fromHandlers: { project_knowledge: () => chain },
    })
    mocked.mockResolvedValue(client as any)

    const graph = makeKnowledgeGraph({ project_id: 'p', version: 2 })
    await upsertKnowledgeGraph(graph, false)

    expect(chain.update).toHaveBeenCalledTimes(1)
    expect(chain.insert).not.toHaveBeenCalled()
    expect(chain.eq).toHaveBeenCalledWith('project_id', 'p')
  })

  it('throws on Supabase error', async () => {
    const chain = makeChain({ data: null, error: { message: 'permission denied' } })
    const client = mockSupabaseClient({
      user: { id: 'u', email: 'a@b' },
      fromHandlers: { project_knowledge: () => chain },
    })
    mocked.mockResolvedValue(client as any)

    const graph = makeKnowledgeGraph()
    await expect(upsertKnowledgeGraph(graph, true)).rejects.toThrow(/permission denied/)
  })
})
