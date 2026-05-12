import { vi } from 'vitest'

type Result<T = unknown> = { data: T | null; error: { message: string } | null; count?: number }

export type SupabaseMock = ReturnType<typeof mockSupabaseClient>

export function mockSupabaseClient(opts: {
  user?: { id: string; email: string } | null
  fromHandlers?: Record<string, FromHandler>
  authHandlers?: Partial<AuthHandlers>
} = {}) {
  const auth: AuthHandlers = {
    getUser: vi.fn(async () => ({
      data: { user: opts.user ?? null },
      error: opts.user ? null : { message: 'Not authenticated' },
    })),
    signUp: vi.fn(async () => ({ data: { user: opts.user ?? null, session: {} }, error: null })),
    signInWithPassword: vi.fn(async () => ({ data: { user: opts.user ?? null, session: {} }, error: null })),
    signOut: vi.fn(async () => ({ error: null })),
    ...opts.authHandlers,
  }

  function from(table: string) {
    const handler = opts.fromHandlers?.[table]
    if (!handler) {
      return makeChain<unknown[]>({ data: [], error: null, count: 0 })
    }
    return handler()
  }

  return {
    auth,
    from: vi.fn(from),
  }
}

type AuthHandlers = {
  getUser: ReturnType<typeof vi.fn>
  signUp: ReturnType<typeof vi.fn>
  signInWithPassword: ReturnType<typeof vi.fn>
  signOut: ReturnType<typeof vi.fn>
}

type FromHandler = () => ChainStub

type ChainStub = {
  select: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  maybeSingle: ReturnType<typeof vi.fn>
  then: (resolve: (r: Result) => unknown) => Promise<unknown>
}

export function makeChain<T = unknown>(result: Result<T>): ChainStub {
  const self = {} as ChainStub
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'order', 'limit'] as const
  for (const m of methods) {
    self[m] = vi.fn(() => self) as ChainStub[typeof m]
  }
  self.single = vi.fn(async () => result) as ChainStub['single']
  self.maybeSingle = vi.fn(async () => result) as ChainStub['maybeSingle']
  self.then = (resolve) => Promise.resolve(result).then(resolve)
  return self
}
