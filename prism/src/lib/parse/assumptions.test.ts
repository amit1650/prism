import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/llm/json')

import { callJsonLLM } from '@/lib/llm/json'
import { surfaceAssumptions } from './assumptions'

const mocked = vi.mocked(callJsonLLM)

beforeEach(() => {
  mocked.mockReset()
})

describe('surfaceAssumptions', () => {
  it('calls callJsonLLM with the assumption prompt + content + 800 maxTokens', async () => {
    mocked.mockResolvedValue({
      assumptions: ['User has internet', 'Single-tenant deployment'],
    })

    const result = await surfaceAssumptions('user text')

    expect(mocked).toHaveBeenCalledWith({
      system: expect.stringContaining('unstated assumptions'),
      user: 'user text',
      maxTokens: 800,
    })
    expect(result.assumptions).toHaveLength(2)
  })

  it('returns empty assumptions when LLM finds none', async () => {
    mocked.mockResolvedValue({ assumptions: [] })
    const result = await surfaceAssumptions('x')
    expect(result.assumptions).toEqual([])
  })
})
