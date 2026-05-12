# 06 — Milestone 2: Chat Intake

## Goal
User can chat with the AI agent about their project and upload documents. Chatscope handles all chat UI. Claude API handles responses. Messages and documents stored in Supabase.

## Deliverables
- [ ] Chat screen using Chatscope (no custom chat components)
- [ ] Claude API streaming responses
- [ ] File upload (PDF, DOCX, TXT, MD)
- [ ] Messages saved to Supabase
- [ ] Documents parsed and saved to Supabase
- [ ] "Analyse Project" button to trigger parsing pipeline

---

## Task 1 — Chat API Route (Streaming)

```typescript
// src/app/api/chat/route.ts
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic()

const SYSTEM_PROMPT = `You are a project intelligence assistant. Your job is to help users define their software project deeply and precisely.

When a user describes their project:
- Ask clarifying questions if something is vague
- Acknowledge what you understood
- Don't ask for team members, deadlines, or delivery dates — those are out of scope
- Focus on: what the project does, what it doesn't do, technical decisions, constraints, and goals
- Be concise. One follow-up question at a time if needed.
- When the user seems to have shared everything, tell them they can click "Analyse Project" to proceed.`

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { messages, projectId } = await req.json()

  // Save user message
  const lastUserMessage = messages[messages.length - 1]
  if (lastUserMessage.role === 'user') {
    await supabase.from('project_messages').insert({
      project_id: projectId,
      role: 'user',
      content: lastUserMessage.content,
    })
  }

  // Stream response from Claude
  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: messages.map((m: any) => ({
      role: m.role,
      content: m.content,
    })),
  })

  const encoder = new TextEncoder()
  let fullResponse = ''

  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (
          chunk.type === 'content_block_delta' &&
          chunk.delta.type === 'text_delta'
        ) {
          const text = chunk.delta.text
          fullResponse += text
          controller.enqueue(encoder.encode(text))
        }
      }

      // Save assistant response
      await supabase.from('project_messages').insert({
        project_id: projectId,
        role: 'assistant',
        content: fullResponse,
      })

      controller.close()
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  })
}
```

---

## Task 2 — File Upload API Route

```typescript
// src/app/api/upload/route.ts
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File
  const projectId = formData.get('projectId') as string

  if (!file || !projectId) {
    return Response.json({ error: 'Missing file or projectId' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const fileType = getFileType(file.name)
  let rawText = ''

  try {
    if (fileType === 'pdf') {
      const pdfParse = (await import('pdf-parse')).default
      const result = await pdfParse(buffer)
      rawText = result.text
    } else if (fileType === 'docx') {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      rawText = result.value
    } else {
      // txt or md
      rawText = buffer.toString('utf-8')
    }
  } catch (err) {
    return Response.json({ error: 'Failed to parse file' }, { status: 422 })
  }

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

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ document: data, preview: rawText.slice(0, 200) })
}

function getFileType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return 'pdf'
  if (ext === 'docx' || ext === 'doc') return 'docx'
  if (ext === 'md') return 'md'
  return 'txt'
}
```

---

## Task 3 — Chat Window Component (Chatscope)

> ⚠️ Import Chatscope styles at the top. This is required.
> ⚠️ We use Chatscope as-is. No custom message bubbles.

```typescript
// src/components/chat/ChatWindow.tsx
'use client'
import '@chatscope/chat-ui-kit-styles/dist/default/styles.min.css'

import {
  MainContainer,
  ChatContainer,
  MessageList,
  Message,
  MessageInput,
  TypingIndicator,
  AttachmentButton,
} from '@chatscope/chat-ui-kit-react'
import { useState, useRef } from 'react'
import { ProjectMessage } from '@/types/project'

interface ChatWindowProps {
  projectId: string
  initialMessages: ProjectMessage[]
  onAnalyseReady: () => void
}

export default function ChatWindow({ projectId, initialMessages, onAnalyseReady }: ChatWindowProps) {
  const [messages, setMessages] = useState(
    initialMessages.length > 0
      ? initialMessages
      : [{ id: 'welcome', role: 'assistant' as const, content: 'What project do you want to plan? Tell me everything — what it does, what problem it solves, any tech ideas you have. You can also attach documents.', created_at: new Date().toISOString(), project_id: projectId }]
  )
  const [typing, setTyping] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const sendMessage = async (text: string) => {
    const userMsg: ProjectMessage = {
      id: Date.now().toString(),
      project_id: projectId,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setTyping(true)

    const assistantMsg: ProjectMessage = {
      id: (Date.now() + 1).toString(),
      project_id: projectId,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
    }
    setMessages([...newMessages, assistantMsg])

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        messages: newMessages.map(m => ({ role: m.role, content: m.content })),
      }),
    })

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let full = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      full += decoder.decode(value)
      setMessages(prev =>
        prev.map(m => m.id === assistantMsg.id ? { ...m, content: full } : m)
      )
    }

    setTyping(false)
  }

  const handleFileUpload = async (file: File) => {
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('projectId', projectId)

    const res = await fetch('/api/upload', { method: 'POST', body: formData })
    const data = await res.json()

    if (data.document) {
      await sendMessage(`[Uploaded: ${file.name}]\n\nDocument content preview: ${data.preview}...`)
    }
    setUploading(false)
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <MainContainer style={{ flex: 1 }}>
        <ChatContainer>
          <MessageList typingIndicator={typing ? <TypingIndicator content="Thinking..." /> : null}>
            {messages.map(msg => (
              <Message
                key={msg.id}
                model={{
                  message: msg.content,
                  direction: msg.role === 'user' ? 'outgoing' : 'incoming',
                  position: 'normal',
                }}
              />
            ))}
          </MessageList>
          <MessageInput
            placeholder="Describe your project..."
            onSend={sendMessage}
            attachButton={true}
            onAttachClick={() => fileInputRef.current?.click()}
            disabled={typing || uploading}
          />
        </ChatContainer>
      </MainContainer>

      <input
        ref={fileInputRef}
        type="file"
        hidden
        accept=".pdf,.docx,.txt,.md"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) handleFileUpload(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}
```

---

## Task 4 — Project Chat Page

```typescript
// src/app/(app)/project/[id]/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ChatWindow from '@/components/chat/ChatWindow'
import { ArrowRight } from 'lucide-react'

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!project) redirect('/dashboard')

  const { data: messages } = await supabase
    .from('project_messages')
    .select('*')
    .eq('project_id', params.id)
    .order('created_at', { ascending: true })

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-950">
        <div>
          <h1 className="text-white font-semibold">{project.name}</h1>
          <p className="text-gray-400 text-sm capitalize">{project.status}</p>
        </div>
        <a
          href={`/project/${params.id}/qa`}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors"
        >
          Analyse Project
          <ArrowRight size={16} />
        </a>
      </div>

      {/* Chat */}
      <div className="flex-1 overflow-hidden">
        <ChatWindow
          projectId={params.id}
          initialMessages={messages || []}
          onAnalyseReady={() => {}}
        />
      </div>
    </div>
  )
}
```

---

## M2 Done When
- [ ] Chat screen loads with welcome message
- [ ] User can type and receive streaming responses from Claude
- [ ] Messages persist after page refresh
- [ ] User can attach PDF, DOCX, TXT, MD files
- [ ] Uploaded file content appears in chat as a message
- [ ] "Analyse Project" button visible in header
- [ ] All messages saved in Supabase `project_messages` table
- [ ] All documents saved in Supabase `project_documents` table
