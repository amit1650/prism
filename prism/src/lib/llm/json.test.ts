import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/llm/client')

import { getLLM } from '@/lib/llm/client'
import { callJsonLLM } from './json'

const mockedGetLLM = vi.mocked(getLLM)

beforeEach(() => {
  mockedGetLLM.mockReset()
})

function withLLM(create: ReturnType<typeof vi.fn>) {
  mockedGetLLM.mockReturnValue({
    client: { chat: { completions: { create } } } as any,
    model: 'test-model',
    provider: 'groq',
  })
}

describe('callJsonLLM', () => {
  it('returns parsed JSON on success', async () => {
    const create = vi.fn(async () => ({
      choices: [{ message: { content: '{"hello":"world"}' } }],
    }))
    withLLM(create)

    const result = await callJsonLLM<{ hello: string }>({
      system: 'sys json',
      user: 'usr',
    })
    expect(result).toEqual({ hello: 'world' })
    expect(create).toHaveBeenCalledWith({
      model: 'test-model',
      max_tokens: 2000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'sys json' },
        { role: 'user', content: 'usr' },
      ],
    })
  })

  it('retries once on parse failure and succeeds', async () => {
    let calls = 0
    const create = vi.fn(async () => {
      calls++
      return {
        choices: [{
          message: { content: calls === 1 ? 'not valid json' : '{"ok":true}' },
        }],
      }
    })
    withLLM(create)

    const result = await callJsonLLM<{ ok: boolean }>({
      system: 'sys json',
      user: 'usr',
    })
    expect(result).toEqual({ ok: true })
    expect(create).toHaveBeenCalledTimes(2)
  })

  it('throws after two consecutive parse failures', async () => {
    const create = vi.fn(async () => ({
      choices: [{ message: { content: 'still not json' } }],
    }))
    withLLM(create)

    await expect(
      callJsonLLM({ system: 'sys json', user: 'usr' })
    ).rejects.toThrow(/invalid JSON after retry/i)
    expect(create).toHaveBeenCalledTimes(2)
  })
})
