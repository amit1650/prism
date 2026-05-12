// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mockSupabaseClient, makeChain } from '@/test/supabase-mock'

vi.mock('@/lib/supabase/server')
vi.mock('@/lib/files/parse', () => ({
  fileTypeFor: vi.fn((name: string) => {
    const ext = name.split('.').pop()?.toLowerCase()
    if (ext === 'pdf') return 'pdf'
    if (ext === 'docx' || ext === 'doc') return 'docx'
    if (ext === 'md') return 'md'
    return 'txt'
  }),
  parseFile: vi.fn(async (_name: string, buf: Buffer) => buf.toString('utf-8')),
}))

import { createClient } from '@/lib/supabase/server'
import { parseFile } from '@/lib/files/parse'
import { POST } from './route'

const mockedSupabase = vi.mocked(createClient)
const mockedParse = vi.mocked(parseFile)

beforeEach(() => {
  mockedSupabase.mockReset()
  mockedParse.mockClear()
})

function makeFormDataRequest(opts: {
  file?: File | null
  projectId?: string | null
}) {
  const fd = new FormData()
  if (opts.file) fd.append('file', opts.file)
  if (opts.projectId) fd.append('projectId', opts.projectId)
  return new Request('http://localhost/api/upload', { method: 'POST', body: fd })
}

describe('POST /api/upload', () => {
  it('returns 401 when no user', async () => {
    mockedSupabase.mockResolvedValue(mockSupabaseClient({ user: null }) as any)
    const file = new File(['hi'], 'a.txt', { type: 'text/plain' })
    const res = await POST(makeFormDataRequest({ file, projectId: 'p' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when file or projectId is missing', async () => {
    const client = mockSupabaseClient({ user: { id: 'u', email: 'a@b' } })
    mockedSupabase.mockResolvedValue(client as any)
    const res = await POST(makeFormDataRequest({ projectId: 'p' }))
    expect(res.status).toBe(400)
  })

  it('returns 413 when file is larger than 10 MB', async () => {
    const client = mockSupabaseClient({ user: { id: 'u', email: 'a@b' } })
    mockedSupabase.mockResolvedValue(client as any)
    const tooBig = new File([new Uint8Array(11 * 1024 * 1024)], 'big.txt', { type: 'text/plain' })
    const res = await POST(makeFormDataRequest({ file: tooBig, projectId: 'p' }))
    expect(res.status).toBe(413)
  })

  it('returns 415 for unsupported extensions', async () => {
    const client = mockSupabaseClient({ user: { id: 'u', email: 'a@b' } })
    mockedSupabase.mockResolvedValue(client as any)
    const file = new File(['x'], 'image.png', { type: 'image/png' })
    const res = await POST(makeFormDataRequest({ file, projectId: 'p' }))
    expect(res.status).toBe(415)
  })

  it('returns 422 when parsing fails', async () => {
    const projectsChain = makeChain({ data: { id: 'p' }, error: null })
    const client = mockSupabaseClient({
      user: { id: 'u', email: 'a@b' },
      fromHandlers: { projects: () => projectsChain },
    })
    mockedSupabase.mockResolvedValue(client as any)
    mockedParse.mockRejectedValueOnce(new Error('corrupt'))

    const file = new File(['x'], 'bad.pdf', { type: 'application/pdf' })
    const res = await POST(makeFormDataRequest({ file, projectId: 'p' }))
    expect(res.status).toBe(422)
  })

  it('happy path: returns document + 200-char preview', async () => {
    const projectsChain = makeChain({ data: { id: 'p' }, error: null })
    const insertChain = makeChain({
      data: { id: 'd1', project_id: 'p', filename: 'a.txt', file_type: 'txt', raw_text: 'hello world' },
      error: null,
    })
    const client = mockSupabaseClient({
      user: { id: 'u', email: 'a@b' },
      fromHandlers: {
        projects: () => projectsChain,
        project_documents: () => insertChain,
      },
    })
    mockedSupabase.mockResolvedValue(client as any)

    const file = new File(['hello world'], 'a.txt', { type: 'text/plain' })
    const res = await POST(makeFormDataRequest({ file, projectId: 'p' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.document.id).toBe('d1')
    expect(body.preview).toBe('hello world')
  })
})
