import { callJsonLLM } from '@/lib/llm/json'
import { ENTITY_EXTRACTION_PROMPT } from './prompts'
import type { Extraction } from '@/types/knowledge'

export async function extractEntities(allContent: string): Promise<Extraction> {
  return callJsonLLM<Extraction>({
    system: ENTITY_EXTRACTION_PROMPT,
    user: allContent,
    maxTokens: 2000,
  })
}
