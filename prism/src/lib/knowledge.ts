import { createClient } from '@/lib/supabase/server'
import type { KnowledgeGraph } from '@/types/knowledge'

async function clientWithUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Not authenticated')
  return supabase
}

export async function getKnowledgeGraph(
  projectId: string
): Promise<KnowledgeGraph | null> {
  const supabase = await clientWithUser()
  const { data, error } = await supabase
    .from('project_knowledge')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as KnowledgeGraph) ?? null
}

/**
 * Insert when the project has no knowledge graph yet (isFirstRun=true),
 * update otherwise. The DB enforces UNIQUE on project_id so we can't
 * accidentally double-insert.
 */
export async function upsertKnowledgeGraph(
  graph: KnowledgeGraph,
  isFirstRun: boolean
): Promise<void> {
  const supabase = await clientWithUser()
  // Strip id + updated_at — let the DB generate/update them.
  const { id: _id, updated_at: _ts, ...row } = graph

  if (isFirstRun) {
    const { error } = await supabase.from('project_knowledge').insert(row)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase
      .from('project_knowledge')
      .update(row)
      .eq('project_id', graph.project_id)
    if (error) throw new Error(error.message)
  }
}
