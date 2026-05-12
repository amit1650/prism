// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mockSupabaseClient, makeChain } from '@/test/supabase-mock'

vi.mock('@/lib/supabase/server')
vi.mock('@/lib/parse/run')
vi.mock('@/lib/knowledge')

import { createClient } from '@/lib/supabase/server'
import { runPipeline } from '@/lib/parse/run'
import { getKnowledgeGraph, upsertKnowledgeGraph } from '@/lib/knowledge'
import { POST } from './route'

const mockedSupabase = vi.mocked(createClient)
const mockedRun = vi.mocked(runPipeline)
const mockedGet = vi.mocked(getKnowledgeGraph)
const mockedUpsert = vi.mocked(upsertKnowledgeGraph)

beforeEach(() => {
  mockedSupabase.mockReset()
  mockedRun.mockReset()
  mockedGet.mockReset()
  mockedUpsert.mockReset()
})

function reqBody(body: unknown) {
  return new Request('http://localhost/api/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/parse', () => {
  it('returns 401 when no user', async () => {
    mockedSupabase.mockResolvedValue(mockSupabaseClient({ user: null }) as any)
    const res = await POST(reqBody({ projectId: 'p' }))
    expect(res.status).toBe(401)
  })

  it('returns 404 when project not owned', async () => {
    const projectsChain = makeChain({ data: null, error: null })
    const client = mockSupabaseClient({
      user: { id: 'u', email: 'a@b' },
      fromHandlers: { projects: () => projectsChain },
    })
    mockedSupabase.mockResolvedValue(client as any)

    const res = await POST(reqBody({ projectId: 'p' }))
    expect(res.status).toBe(404)
  })

  it('returns 400 when projectId missing', async () => {
    const client = mockSupabaseClient({ user: { id: 'u', email: 'a@b' } })
    mockedSupabase.mockResolvedValue(client as any)
    const res = await POST(reqBody({}))
    expect(res.status).toBe(400)
  })

  it('returns 400 when no user messages and no documents', async () => {
    const projectsChain = makeChain({ data: { id: 'p' }, error: null })
    const msgChain = makeChain({ data: [], error: null })
    const docChain = makeChain({ data: [], error: null })
    const client = mockSupabaseClient({
      user: { id: 'u', email: 'a@b' },
      fromHandlers: {
        projects: () => projectsChain,
        project_messages: () => msgChain,
        project_documents: () => docChain,
      },
    })
    mockedSupabase.mockResolvedValue(client as any)

    const res = await POST(reqBody({ projectId: 'p' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/no content to analyse/i)
  })

  it('happy path: runs pipeline, upserts graph v1, flips status to clarifying', async () => {
    const projectsChain = makeChain({ data: { id: 'p' }, error: null })
    const msgChain = makeChain({
      data: [
        { id: 'm1', role: 'user', content: 'hi', created_at: '2026-05-12T00:00:00Z' },
      ],
      error: null,
    })
    const docChain = makeChain({ data: [], error: null })
    const statusChain = makeChain({ data: null, error: null })

    // First call to from('projects') returns projectsChain (for select id);
    // second call returns statusChain (for update).
    let projectsCallCount = 0
    const client = mockSupabaseClient({
      user: { id: 'u', email: 'a@b' },
      fromHandlers: {
        projects: () => {
          projectsCallCount += 1
          return projectsCallCount === 1 ? projectsChain : statusChain
        },
        project_messages: () => msgChain,
        project_documents: () => docChain,
      },
    })
    mockedSupabase.mockResolvedValue(client as any)
    mockedGet.mockResolvedValue(null)
    mockedRun.mockResolvedValue({
      project_type: 'web_app',
      summary: 'A CRM.',
      confirmed_facts: { name: 'CRM' },
      inferred_facts: {},
      tentative_facts: {},
      non_goals: [],
      decisions: [],
      tradeoffs: [],
      assumptions: [],
      open_questions: [],
      conflicts: [],
      domain_language: {},
    })

    const res = await POST(reqBody({ projectId: 'p' }))
    expect(res.status).toBe(200)
    expect(mockedRun).toHaveBeenCalledTimes(1)
    expect(mockedUpsert).toHaveBeenCalledTimes(1)
    const [upsertGraph, isFirstRun] = mockedUpsert.mock.calls[0]
    expect(isFirstRun).toBe(true)
    expect(upsertGraph.project_id).toBe('p')
    expect(upsertGraph.version).toBe(1)
    // Status update was issued.
    expect(statusChain.update).toHaveBeenCalledWith({ status: 'clarifying' })
  })

  it('returns 502 when pipeline fails (no partial graph saved)', async () => {
    const projectsChain = makeChain({ data: { id: 'p' }, error: null })
    const msgChain = makeChain({
      data: [{ id: 'm1', role: 'user', content: 'hi', created_at: 'x' }],
      error: null,
    })
    const docChain = makeChain({ data: [], error: null })
    const client = mockSupabaseClient({
      user: { id: 'u', email: 'a@b' },
      fromHandlers: {
        projects: () => projectsChain,
        project_messages: () => msgChain,
        project_documents: () => docChain,
      },
    })
    mockedSupabase.mockResolvedValue(client as any)
    mockedGet.mockResolvedValue(null)
    mockedRun.mockRejectedValue(new Error('extraction failed'))

    const res = await POST(reqBody({ projectId: 'p' }))
    expect(res.status).toBe(502)
    expect(mockedUpsert).not.toHaveBeenCalled()
  })
})
