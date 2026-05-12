import { createClient } from '@/lib/supabase/server'
import type { ProjectMessage } from '@/types/project'

export async function getProjectMessages(projectId: string): Promise<ProjectMessage[]> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new Error('Not authenticated')
  }
  const { data, error } = await supabase
    .from('project_messages')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as ProjectMessage[]
}
