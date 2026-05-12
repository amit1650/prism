import OpenAI from 'openai'

export type LLMProvider = 'openai' | 'groq'

export function getLLM(): { client: OpenAI; model: string; provider: LLMProvider } {
  if (process.env.OPENAI_API_KEY) {
    return {
      client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
      model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      provider: 'openai',
    }
  }
  if (process.env.GROQ_API_KEY) {
    return {
      client: new OpenAI({
        apiKey: process.env.GROQ_API_KEY,
        baseURL: 'https://api.groq.com/openai/v1',
      }),
      model: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
      provider: 'groq',
    }
  }
  throw new Error(
    'No LLM provider configured. Set OPENAI_API_KEY or GROQ_API_KEY in .env.local.'
  )
}
