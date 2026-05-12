// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mockSupabaseClient, makeChain } from '@/test/supabase-mock'
import { mockLLMClient } from '@/test/llm-mock'

vi.mock('@/lib/supabase/server')
vi.mock('@/lib/llm/client')

import { createClient } from '@/lib/supabase/server'
import { getLLM } from '@/lib/llm/client'
import { POST } from './route'

const mockedSupabase = vi.mocked(createClient)
const mockedGetLLM = vi.mocked(getLLM)

beforeEach(() => {
  mockedSupabase.mockReset()
  mockedGetLLM.mockReset()
})

function reqBody(body: unknown) {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function streamToString(res: Response): Promise<string> {
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let out = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    out += decoder.decode(value)
  }
  return out
}

describe('POST /api/chat', () => {
  it('returns 401 when no user', async () => {
    mockedSupabase.mockResolvedValue(mockSupabaseClient({ user: null }) as any)
    const res = await POST(reqBody({ projectId: 'p', messages: [] }))
    expect(res.status).toBe(401)
  })

  it('returns 404 when project not owned', async () => {
    const projectsChain = makeChain({ data: null, error: null })
    const client = mockSupabaseClient({
      user: { id: 'u', email: 'a@b' },
      fromHandlers: { projects: () => projectsChain },
    })
    mockedSupabase.mockResolvedValue(client as any)

    const res = await POST(reqBody({ projectId: 'p', messages: [{ role: 'user', content: 'hi' }] }))
    expect(res.status).toBe(404)
  })

  it('returns 400 when body is malformed', async () => {
    const client = mockSupabaseClient({ user: { id: 'u', email: 'a@b' } })
    mockedSupabase.mockResolvedValue(client as any)
    const res = await POST(reqBody({ projectId: 'p' })) // missing messages
    expect(res.status).toBe(400)
  })

  it('saves user message, streams response, saves assistant message', async () => {
    const projectsChain = makeChain({ data: { id: 'p' }, error: null })
    const messagesChain = makeChain({ data: { id: 'msg' }, error: null })
    const client = mockSupabaseClient({
      user: { id: 'u', email: 'a@b' },
      fromHandlers: {
        projects: () => projectsChain,
        project_messages: () => messagesChain,
      },
    })
    mockedSupabase.mockResolvedValue(client as any)
    mockedGetLLM.mockReturnValue({
      client: mockLLMClient({ chunks: ['Hi', ' there'] }) as any,
      model: 'test-model',
      provider: 'groq',
    })

    const res = await POST(reqBody({ projectId: 'p', messages: [{ role: 'user', content: 'hello' }] }))
    expect(res.status).toBe(200)

    const text = await streamToString(res)
    expect(text).toBe('Hi there')

    expect(messagesChain.insert).toHaveBeenNthCalledWith(1, {
      project_id: 'p',
      role: 'user',
      content: 'hello',
    })
    expect(messagesChain.insert).toHaveBeenNthCalledWith(2, {
      project_id: 'p',
      role: 'assistant',
      content: 'Hi there',
    })
  })

  it('streams a sentinel and does not persist on mid-stream error', async () => {
    const projectsChain = makeChain({ data: { id: 'p' }, error: null })
    const messagesChain = makeChain({ data: { id: 'msg' }, error: null })
    const client = mockSupabaseClient({
      user: { id: 'u', email: 'a@b' },
      fromHandlers: {
        projects: () => projectsChain,
        project_messages: () => messagesChain,
      },
    })
    mockedSupabase.mockResolvedValue(client as any)
    mockedGetLLM.mockReturnValue({
      client: mockLLMClient({ chunks: ['Partial'], failAfterChunk: 1 }) as any,
      model: 'test-model',
      provider: 'groq',
    })

    const res = await POST(reqBody({ projectId: 'p', messages: [{ role: 'user', content: 'hi' }] }))
    const text = await streamToString(res)
    expect(text).toMatch(/Partial.*\[Connection lost\. Try again\.\]/s)
    expect(messagesChain.insert).toHaveBeenCalledTimes(1)
  })
})
