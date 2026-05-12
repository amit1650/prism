import { callJsonLLM } from '@/lib/llm/json'
import { GAP_ANALYSIS_PROMPT } from './prompts'
import type { OpenQuestion } from '@/types/knowledge'

export interface GapResult {
  open_questions: OpenQuestion[]
}

export async function analyseGaps(
  facts: Record<string, unknown>,
  projectType: string
): Promise<GapResult> {
  const user = `Project Type: ${projectType || 'unknown'}

Known Facts:
${JSON.stringify(facts, null, 2)}`

  return callJsonLLM<GapResult>({
    system: GAP_ANALYSIS_PROMPT,
    user,
    maxTokens: 800,
  })
}
