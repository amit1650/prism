import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mockSupabaseClient, makeChain } from '@/test/supabase-mock'
import type { ProjectDocument } from '@/types/project'

vi.mock('@/lib/supabase/server')

import { createClient } from '@/lib/supabase/server'
import { getProjectDocuments } from './documents'

const mocked = vi.mocked(createClient)

beforeEach(() => {
  mocked.mockReset()
})

const sampleDocs: ProjectDocument[] = [
  { id: 'd1', project_id: 'p', filename: 'spec.pdf', file_type: 'pdf', raw_text: 'text', created_at: '2026-05-12T00:00:00Z' },
]

describe('getProjectDocuments', () => {
  it('returns rows ordered by created_at desc', async () => {
    const client = mockSupabaseClient({
      user: { id: 'u', email: 'a@b' },
      fromHandlers: {
        project_documents: () => makeChain({ data: sampleDocs, error: null }),
      },
    })
    mocked.mockResolvedValue(client as any)

    const result = await getProjectDocuments('p')
    expect(result).toEqual(sampleDocs)
    expect(client.from).toHaveBeenCalledWith('project_documents')
  })

  it('throws when no user', async () => {
    const client = mockSupabaseClient({ user: null })
    mocked.mockResolvedValue(client as any)
    await expect(getProjectDocuments('p')).rejects.toThrow(/not authenticated/i)
  })
})
