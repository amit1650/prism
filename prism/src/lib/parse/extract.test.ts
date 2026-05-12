import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/llm/json')

import { callJsonLLM } from '@/lib/llm/json'
import { extractEntities } from './extract'

const mocked = vi.mocked(callJsonLLM)

beforeEach(() => {
  mocked.mockReset()
})

describe('extractEntities', () => {
  it('calls callJsonLLM with the extraction prompt + user content + maxTokens 2000', async () => {
    mocked.mockResolvedValue({
      project_type: 'web_app',
      summary: 'A CRM.',
      confirmed: { name: 'CRM' },
      inferred: {},
      tentative: {},
      non_goals: [],
      decisions: [],
      tradeoffs: [],
      domain_language: {},
    })

    const result = await extractEntities('chat + docs content here')

    expect(mocked).toHaveBeenCalledTimes(1)
    expect(mocked).toHaveBeenCalledWith({
      system: expect.stringContaining('You are a project analyst'),
      user: 'chat + docs content here',
      maxTokens: 2000,
    })
    expect(result.project_type).toBe('web_app')
    expect(result.summary).toBe('A CRM.')
    expect(result.confirmed).toEqual({ name: 'CRM' })
  })

  it('propagates errors from callJsonLLM', async () => {
    mocked.mockRejectedValue(new Error('LLM returned invalid JSON after retry'))
    await expect(extractEntities('x')).rejects.toThrow(/invalid JSON/i)
  })
})
