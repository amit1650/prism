import { createClient } from '@/lib/supabase/server'
import { fileTypeFor, parseFile } from '@/lib/files/parse'

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB
const MAX_CHARS = 200_000

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const projectId = formData.get('projectId') as string | null

  if (!file || !projectId) {
    return Response.json({ error: 'Missing file or projectId' }, { status: 400 })
  }

  if (file.size > MAX_BYTES) {
    return Response.json({ error: 'File too large (max 10 MB)' }, { status: 413 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase()
  const allowed = ['pdf', 'docx', 'doc', 'txt', 'md']
  if (!ext || !allowed.includes(ext)) {
    return Response.json({ error: 'Unsupported file type' }, { status: 415 })
  }

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .maybeSingle()
  if (!project) return Response.json({ error: 'Project not found' }, { status: 404 })

  const buffer = Buffer.from(await file.arrayBuffer())

  let rawText: string
  try {
    rawText = await parseFile(file.name, buffer)
  } catch {
    return Response.json({ error: "Couldn't parse the file" }, { status: 422 })
  }

  if (rawText.length > MAX_CHARS) {
    rawText = rawText.slice(0, MAX_CHARS)
  }

  const fileType = fileTypeFor(file.name)
  const { data, error } = await supabase
    .from('project_documents')
    .insert({
      project_id: projectId,
      filename: file.name,
      file_type: fileType,
      raw_text: rawText,
    })
    .select()
    .single()

  if (error || !data) {
    return Response.json({ error: 'Failed to save document' }, { status: 500 })
  }

  return Response.json({ document: data, preview: rawText.slice(0, 200) })
}
