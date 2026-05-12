'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { NewProjectInput } from '@/types/project'

const MAX_NAME = 100

export async function createProjectAction(input: NewProjectInput): Promise<never> {
  const name = (input.name ?? '').trim()
  const description = (input.description ?? '').trim() || null

  if (!name) {
    throw new Error('Project name is required')
  }
  if (name.length > MAX_NAME) {
    throw new Error(`Project name must be at most ${MAX_NAME} characters`)
  }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new Error('Not authenticated')
  }

  const { data, error } = await supabase
    .from('projects')
    .insert({ name, description, user_id: user.id })
    .select()
    .single()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Project creation returned no row')

  revalidatePath('/', 'layout')
  redirect(`/project/${data.id}`)
}
