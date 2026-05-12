import { createClient } from '@/lib/supabase/server'
import { getLLM } from '@/lib/llm/client'
import { SYSTEM_PROMPT } from '@/lib/llm/prompts'

type IncomingMessage = { role: 'user' | 'assistant'; content: string }

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  let body: { projectId?: string; messages?: IncomingMessage[] }
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }
  const { projectId, messages } = body
  if (!projectId || !Array.isArray(messages)) {
    return new Response('Missing projectId or messages', { status: 400 })
  }

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .maybeSingle()
  if (!project) return new Response('Project not found', { status: 404 })

  const lastUser = [...messages].reverse().find((m) => m.role === 'user')
  if (lastUser) {
    await supabase.from('project_messages').insert({
      project_id: projectId,
      role: 'user',
      content: lastUser.content,
    })
  }

  let llm
  try {
    llm = getLLM()
  } catch (err) {
    return new Response((err as Error).message, { status: 500 })
  }

  let stream
  try {
    stream = await llm.client.chat.completions.create({
      model: llm.model,
      stream: true,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    } as Parameters<typeof llm.client.chat.completions.create>[0])
  } catch {
    return new Response("Couldn't reach the assistant. Try again.", { status: 502 })
  }

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      let full = ''
      try {
        for await (const chunk of stream as unknown as AsyncIterable<{
          choices: Array<{ delta: { content?: string | null } }>
        }>) {
          const text = chunk.choices[0]?.delta?.content ?? ''
          if (text) {
            full += text
            controller.enqueue(encoder.encode(text))
          }
        }
        await supabase.from('project_messages').insert({
          project_id: projectId,
          role: 'assistant',
          content: full,
        })
      } catch {
        controller.enqueue(encoder.encode('\n\n[Connection lost. Try again.]'))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
