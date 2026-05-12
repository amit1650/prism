import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

vi.mock('openai', () => {
  return {
    default: vi.fn(function MockOpenAI(this: Record<string, unknown>, opts: any) {
      Object.assign(this, { __opts: opts })
    }),
  }
})

import OpenAI from 'openai'

describe('getLLM', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    vi.mocked(OpenAI).mockClear()
    process.env = { ...originalEnv }
    delete process.env.OPENAI_API_KEY
    delete process.env.GROQ_API_KEY
    delete process.env.OPENAI_MODEL
    delete process.env.GROQ_MODEL
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('throws when neither key is set', async () => {
    const { getLLM } = await import('./client')
    expect(() => getLLM()).toThrow(/No LLM provider configured/)
  })

  it('selects OpenAI when only OPENAI_API_KEY is set', async () => {
    process.env.OPENAI_API_KEY = 'sk-test'
    const { getLLM } = await import('./client')
    const r = getLLM()
    expect(r.provider).toBe('openai')
    expect(r.model).toBe('gpt-4o-mini')
    expect((OpenAI as any).mock.calls[0][0]).toEqual({ apiKey: 'sk-test' })
  })

  it('falls back to Groq when only GROQ_API_KEY is set', async () => {
    process.env.GROQ_API_KEY = 'gsk-test'
    const { getLLM } = await import('./client')
    const r = getLLM()
    expect(r.provider).toBe('groq')
    expect(r.model).toBe('llama-3.3-70b-versatile')
    expect((OpenAI as any).mock.calls[0][0]).toEqual({
      apiKey: 'gsk-test',
      baseURL: 'https://api.groq.com/openai/v1',
    })
  })

  it('prefers OpenAI when both keys are set', async () => {
    process.env.OPENAI_API_KEY = 'sk-test'
    process.env.GROQ_API_KEY = 'gsk-test'
    const { getLLM } = await import('./client')
    expect(getLLM().provider).toBe('openai')
  })

  it('uses OPENAI_MODEL and GROQ_MODEL env overrides', async () => {
    process.env.OPENAI_API_KEY = 'sk-test'
    process.env.OPENAI_MODEL = 'gpt-5-mini'
    const { getLLM: getLLMOpenAI } = await import('./client')
    expect(getLLMOpenAI().model).toBe('gpt-5-mini')

    vi.resetModules()
    delete process.env.OPENAI_API_KEY
    process.env.GROQ_API_KEY = 'gsk-test'
    process.env.GROQ_MODEL = 'llama-3.1-70b-versatile'
    const { getLLM: getLLMGroq } = await import('./client')
    expect(getLLMGroq().model).toBe('llama-3.1-70b-versatile')
  })
})
