import { createClient } from '@/lib/supabase/server'
import type { ProjectDocument } from '@/types/project'

export async function getProjectDocuments(projectId: string): Promise<ProjectDocument[]> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new Error('Not authenticated')
  }
  const { data, error } = await supabase
    .from('project_documents')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as ProjectDocument[]
}
