import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/llm/json')

import { callJsonLLM } from '@/lib/llm/json'
import { analyseGaps } from './gaps'

const mocked = vi.mocked(callJsonLLM)

beforeEach(() => {
  mocked.mockReset()
})

describe('analyseGaps', () => {
  it('passes the project type and facts as a stringified JSON user block', async () => {
    mocked.mockResolvedValue({
      open_questions: [
        { topic: 'authentication provider', priority: 'high', context: 'auth not mentioned' },
      ],
    })

    const facts = { confirmed_name: 'CRM', inferred_storage: 'postgres' }
    const result = await analyseGaps(facts, 'web_app')

    expect(mocked).toHaveBeenCalledWith({
      system: expect.stringContaining('information GAPS'),
      user: expect.stringContaining('Project Type: web_app'),
      maxTokens: 800,
    })
    const callArg = mocked.mock.calls[0][0]
    expect(callArg.user).toContain('"confirmed_name"')
    expect(callArg.user).toContain('"CRM"')

    expect(result.open_questions).toHaveLength(1)
    expect(result.open_questions[0].priority).toBe('high')
  })

  it('handles unknown project type', async () => {
    mocked.mockResolvedValue({ open_questions: [] })
    await analyseGaps({}, '')
    const callArg = mocked.mock.calls[0][0]
    expect(callArg.user).toContain('Project Type: unknown')
  })
})
