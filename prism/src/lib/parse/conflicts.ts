import { callJsonLLM } from '@/lib/llm/json'
import { CONFLICT_DETECTION_PROMPT } from './prompts'
import type { Conflict } from '@/types/knowledge'

export interface Source {
  label: string
  content: string
}

export interface ConflictResult {
  conflicts: Conflict[]
}

export async function detectConflicts(sources: Source[]): Promise<ConflictResult> {
  const user = sources
    .map((s) => `SOURCE: ${s.label}\n${s.content}`)
    .join('\n\n---\n\n')

  return callJsonLLM<ConflictResult>({
    system: CONFLICT_DETECTION_PROMPT,
    user,
    maxTokens: 1000,
  })
}
