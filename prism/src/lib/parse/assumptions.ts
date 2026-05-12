import { callJsonLLM } from '@/lib/llm/json'
import { ASSUMPTION_SURFACING_PROMPT } from './prompts'

export interface AssumptionResult {
  assumptions: string[]
}

export async function surfaceAssumptions(allContent: string): Promise<AssumptionResult> {
  return callJsonLLM<AssumptionResult>({
    system: ASSUMPTION_SURFACING_PROMPT,
    user: allContent,
    maxTokens: 800,
  })
}
