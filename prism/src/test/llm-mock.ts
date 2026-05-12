import { vi } from 'vitest'

type MockLLMOptions = {
  /** Text chunks to stream. Default: ['Hello', ', ', 'world!']. */
  chunks?: string[]
  /** Throw before the iterator starts. */
  failBeforeStream?: boolean
  /** Throw after the Nth chunk has been yielded. */
  failAfterChunk?: number
}

export type MockLLMClient = ReturnType<typeof mockLLMClient>

/**
 * Returns an `openai`-shaped client where `chat.completions.create` returns an
 * async-iterable yielding OpenAI-style chunks: { choices: [{ delta: { content } }] }.
 */
export function mockLLMClient(opts: MockLLMOptions = {}) {
  const chunks = opts.chunks ?? ['Hello', ', ', 'world!']

  const create = vi.fn(async () => {
    if (opts.failBeforeStream) {
      throw new Error('upstream error')
    }
    return {
      [Symbol.asyncIterator]: async function* () {
        let yielded = 0
        for (const text of chunks) {
          yielded++
          yield { choices: [{ delta: { content: text } }] }
          if (opts.failAfterChunk !== undefined && yielded >= opts.failAfterChunk) {
            throw new Error('mid-stream error')
          }
        }
      },
    }
  })

  return {
    chat: {
      completions: { create },
    },
  }
}
