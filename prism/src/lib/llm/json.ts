import { getLLM } from '@/lib/llm/client'

type Args = {
  system: string
  user: string
  /** Default 2000. */
  maxTokens?: number
}

/**
 * Call the configured LLM in JSON mode and parse the response. Retries once
 * on parse failure (rare with JSON mode but possible if the model truncates
 * mid-object due to max_tokens or returns a stray non-JSON prefix).
 */
export async function callJsonLLM<T>({
  system,
  user,
  maxTokens = 2000,
}: Args): Promise<T> {
  const { client, model } = getLLM()
  let lastError: Error | null = null
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await client.chat.completions.create({
      model,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    })
    const text = response.choices[0]?.message?.content ?? ''
    try {
      return JSON.parse(text) as T
    } catch (err) {
      lastError = err as Error
    }
  }
  throw new Error(
    `LLM returned invalid JSON after retry: ${lastError?.message ?? 'unknown'}`
  )
}
