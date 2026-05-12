import { createClient } from '@/lib/supabase/server'
import type { Project } from '@/types/project'

async function clientWithUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    throw new Error('Not authenticated')
  }
  return { supabase, user }
}

export async function getProjects(): Promise<Project[]> {
  const { supabase } = await clientWithUser()
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Project[]
}

export async function getProjectCount(): Promise<number> {
  const { supabase } = await clientWithUser()
  const { count, error } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true })
  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function getProjectById(id: string): Promise<Project | null> {
  const { supabase } = await clientWithUser()
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as Project) ?? null
}
