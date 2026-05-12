export type ConfidenceLevel = 'confirmed' | 'inferred' | 'tentative'

export interface Fact {
  value: string | boolean | string[]
  confidence: ConfidenceLevel
  source?: string
}

export interface Decision {
  topic: string
  choice: string
  rationale: string
}

export interface Tradeoff {
  description: string
  accepted: boolean
  rationale: string
}

export interface OpenQuestion {
  topic: string
  priority: 'high' | 'medium' | 'low'
  context?: string
}

export interface Conflict {
  topic: string
  source_a: string
  value_a: string
  source_b: string
  value_b: string
  resolved: boolean
  resolution?: string
}

/**
 * Output of Stage 1 (entity extraction). Subset of the full KnowledgeGraph
 * that comes directly from the LLM.
 */
export interface Extraction {
  project_type: string
  summary: string
  confirmed: Record<string, string>
  inferred: Record<string, string>
  tentative: Record<string, string>
  non_goals: string[]
  decisions: Decision[]
  tradeoffs: Tradeoff[]
  domain_language: Record<string, string>
}

/**
 * Result of the pure pipeline run (no DB I/O). Missing project_id + version,
 * which are added by the API route before upsert.
 */
export interface KnowledgeGraphFragment {
  project_type: string | null
  summary: string | null
  confirmed_facts: Record<string, string>
  inferred_facts: Record<string, string>
  tentative_facts: Record<string, string>
  non_goals: string[]
  decisions: Decision[]
  tradeoffs: Tradeoff[]
  assumptions: string[]
  open_questions: OpenQuestion[]
  conflicts: Conflict[]
  domain_language: Record<string, string>
}

/**
 * Full knowledge graph row as stored in Supabase + returned to clients.
 */
export interface KnowledgeGraph extends KnowledgeGraphFragment {
  id?: string
  project_id: string
  version: number
  updated_at?: string
}
