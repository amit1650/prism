import { describe, expect, it, vi } from 'vitest'

vi.mock('@supabase/ssr', async () => {
  return {
    createBrowserClient: vi.fn(() => ({ __kind: 'browser-client' })),
    createServerClient: vi.fn(() => ({ __kind: 'server-client' })),
  }
})

// Mock next/headers; if not mocked, importing the server client throws in jsdom.
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    getAll: () => [],
    set: vi.fn(),
  })),
}))

describe('supabase clients', () => {
  it('createClient (browser) calls createBrowserClient with env vars', async () => {
    const { createBrowserClient } = await import('@supabase/ssr')
    const { createClient } = await import('./client')
    const client = createClient()
    expect((client as any).__kind).toBe('browser-client')
    expect(createBrowserClient).toHaveBeenCalledWith(
      'http://localhost:54321',
      'test-anon-key'
    )
  })

  it('createClient (server) calls createServerClient with env vars and cookies', async () => {
    const { createServerClient } = await import('@supabase/ssr')
    const { createClient } = await import('./server')
    const client = await createClient()
    expect((client as any).__kind).toBe('server-client')
    expect(createServerClient).toHaveBeenCalled()
    const [url, key, opts] = (createServerClient as any).mock.calls[0]
    expect(url).toBe('http://localhost:54321')
    expect(key).toBe('test-anon-key')
    expect(opts.cookies).toBeDefined()
  })
})
