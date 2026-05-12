import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/llm/json')

import { callJsonLLM } from '@/lib/llm/json'
import { detectConflicts } from './conflicts'

const mocked = vi.mocked(callJsonLLM)

beforeEach(() => {
  mocked.mockReset()
})

describe('detectConflicts', () => {
  it('formats sources into labeled blocks and returns the conflicts array', async () => {
    mocked.mockResolvedValue({
      conflicts: [
        {
          topic: 'audience',
          source_a: 'Chat session',
          value_a: 'B2C',
          source_b: 'spec.pdf',
          value_b: 'B2B',
          resolved: false,
        },
      ],
    })

    const result = await detectConflicts([
      { label: 'Chat session', content: 'we target B2C consumers' },
      { label: 'spec.pdf', content: 'this product is sold to enterprises' },
    ])

    expect(mocked).toHaveBeenCalledTimes(1)
    const callArg = mocked.mock.calls[0][0]
    expect(callArg.system).toContain('consistency analyst')
    expect(callArg.maxTokens).toBe(1000)
    expect(callArg.user).toContain('SOURCE: Chat session')
    expect(callArg.user).toContain('SOURCE: spec.pdf')
    expect(callArg.user).toContain('we target B2C consumers')
    expect(callArg.user).toContain('this product is sold to enterprises')

    expect(result.conflicts).toHaveLength(1)
    expect(result.conflicts[0].topic).toBe('audience')
  })

  it('returns an empty conflicts array when LLM finds none', async () => {
    mocked.mockResolvedValue({ conflicts: [] })
    const result = await detectConflicts([
      { label: 'a', content: 'x' },
      { label: 'b', content: 'y' },
    ])
    expect(result.conflicts).toEqual([])
  })
})
