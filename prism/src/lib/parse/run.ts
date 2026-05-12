import { extractEntities } from './extract'
import { detectConflicts, type Source } from './conflicts'
import { surfaceAssumptions } from './assumptions'
import { analyseGaps } from './gaps'
import type { KnowledgeGraphFragment } from '@/types/knowledge'

interface RunPipelineArgs {
  /** Concatenated chat + documents, separated by `===`. */
  allContent: string
  /** Labeled sources (chat + each document) for conflict detection. */
  sources: Source[]
}

/**
 * Pure orchestrator — runs the 4 stages (Stage 2 skipped if sources.length < 2)
 * and returns a KnowledgeGraphFragment. No Supabase I/O; the caller adds
 * project_id + version and persists.
 *
 * Throws if any stage fails. Caller maps to a 502.
 */
export async function runPipeline({
  allContent,
  sources,
}: RunPipelineArgs): Promise<KnowledgeGraphFragment> {
  const extraction = await extractEntities(allContent)

  const { conflicts } =
    sources.length >= 2 ? await detectConflicts(sources) : { conflicts: [] }

  const { assumptions } = await surfaceAssumptions(allContent)

  const facts = { ...extraction.confirmed, ...extraction.inferred }
  const { open_questions } = await analyseGaps(facts, extraction.project_type)

  return {
    project_type: extraction.project_type || null,
    summary: extraction.summary || null,
    confirmed_facts: extraction.confirmed ?? {},
    inferred_facts: extraction.inferred ?? {},
    tentative_facts: extraction.tentative ?? {},
    non_goals: extraction.non_goals ?? [],
    decisions: extraction.decisions ?? [],
    tradeoffs: extraction.tradeoffs ?? [],
    assumptions: assumptions ?? [],
    open_questions: open_questions ?? [],
    conflicts: conflicts ?? [],
    domain_language: extraction.domain_language ?? {},
  }
}
