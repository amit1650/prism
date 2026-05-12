import { createClient } from '@/lib/supabase/server'
import { runPipeline } from '@/lib/parse/run'
import { getKnowledgeGraph, upsertKnowledgeGraph } from '@/lib/knowledge'
import type { KnowledgeGraph } from '@/types/knowledge'

interface ProjectMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

interface ProjectDocument {
  id: string
  filename: string
  raw_text: string
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { projectId?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const { projectId } = body
  if (!projectId) {
    return Response.json({ error: 'Missing projectId' }, { status: 400 })
  }

  // Verify project ownership via RLS-scoped select.
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .maybeSingle()
  if (!project) {
    return Response.json({ error: 'Project not found' }, { status: 404 })
  }

  // Fetch messages + documents in parallel.
  const [messagesRes, documentsRes] = await Promise.all([
    supabase
      .from('project_messages')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true }),
    supabase
      .from('project_documents')
      .select('*')
      .eq('project_id', projectId),
  ])

  const messages = (messagesRes.data ?? []) as ProjectMessage[]
  const documents = (documentsRes.data ?? []) as ProjectDocument[]

  const userMessageCount = messages.filter((m) => m.role === 'user').length
  if (userMessageCount === 0 && documents.length === 0) {
    return Response.json(
      { error: 'No content to analyse — chat with the agent first.' },
      { status: 400 }
    )
  }

  // Build inputs.
  const chatContent = messages
    .map((m) => `[${m.role.toUpperCase()}]: ${m.content}`)
    .join('\n\n')

  const allContent = [
    chatContent,
    ...documents.map((d) => `[DOCUMENT: ${d.filename}]:\n${d.raw_text}`),
  ]
    .filter(Boolean)
    .join('\n\n===\n\n')

  const sources = [
    ...(chatContent ? [{ label: 'Chat session', content: chatContent }] : []),
    ...documents.map((d) => ({ label: d.filename, content: d.raw_text })),
  ]

  let fragment
  try {
    fragment = await runPipeline({ allContent, sources })
  } catch {
    return Response.json(
      { error: "Couldn't analyse — try again." },
      { status: 502 }
    )
  }

  const existing = await getKnowledgeGraph(projectId)
  const isFirstRun = existing === null
  const graph: KnowledgeGraph = {
    ...fragment,
    project_id: projectId,
    version: (existing?.version ?? 0) + 1,
  }

  try {
    await upsertKnowledgeGraph(graph, isFirstRun)
  } catch {
    return Response.json(
      { error: 'Failed to save knowledge graph' },
      { status: 500 }
    )
  }

  if (isFirstRun) {
    try {
      await supabase
        .from('projects')
        .update({ status: 'clarifying' })
        .eq('id', projectId)
    } catch {
      // Non-fatal: graph is saved; status flip can be retried later.
    }
  }

  return Response.json({ graph })
}
