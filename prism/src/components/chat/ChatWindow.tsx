'use client'
import '@chatscope/chat-ui-kit-styles/dist/default/styles.min.css'

import {
  MainContainer,
  ChatContainer,
  MessageList,
  Message,
  MessageInput,
  TypingIndicator,
} from '@chatscope/chat-ui-kit-react'
import { useEffect, useRef, useState } from 'react'
import type { ProjectMessage } from '@/types/project'

interface ChatWindowProps {
  projectId: string
  initialMessages: ProjectMessage[]
}

/**
 * Detect upload messages and split out the filename + preview body.
 * Format produced in handleFileUpload:
 *   `[Uploaded: ${file.name}]\n\nDocument content preview: ${preview}...`
 */
function parseUploadMessage(content: string): { filename: string; preview: string } | null {
  const match = content.match(/^\[Uploaded: ([^\]]+)\]\n\nDocument content preview: ([\s\S]*?)\.\.\.$/)
  if (!match) return null
  return { filename: match[1], preview: match[2] }
}

function makeWelcome(projectId: string): ProjectMessage {
  return {
    id: 'welcome',
    project_id: projectId,
    role: 'assistant',
    content:
      'What project do you want to plan? Tell me everything — what it does, what problem it solves, any tech ideas you have. You can also attach documents.',
    created_at: new Date().toISOString(),
  }
}

export function ChatWindow({ projectId, initialMessages }: ChatWindowProps) {
  const [messages, setMessages] = useState<ProjectMessage[]>(
    initialMessages.length > 0 ? initialMessages : [makeWelcome(projectId)]
  )
  const [typing, setTyping] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const idCounter = useRef(0)
  const nextId = () => `local-${++idCounter.current}`

  // Chatscope renders its attachment + send buttons without an accessible name.
  // Patch labels after mount so axe-core and screen readers can identify them.
  useEffect(() => {
    if (!rootRef.current) return
    const labels: Array<[string, string]> = [
      ['.cs-button--attachment', 'Attach file'],
      ['.cs-button--send', 'Send message'],
    ]
    for (const [selector, label] of labels) {
      const el = rootRef.current.querySelector(selector)
      if (el && !el.getAttribute('aria-label')) {
        el.setAttribute('aria-label', label)
      }
    }
  })

  // Chatscope's contenteditable preserves source HTML on paste — including
  // background colors, fonts, etc. — which leaks into the input and into
  // Chatscope's stateValue (innerHTML). Patch the paste handler to insert
  // plain text only.
  useEffect(() => {
    if (!rootRef.current) return
    const editor = rootRef.current.querySelector(
      '.cs-message-input__content-editor'
    ) as (HTMLElement & { __pastePatched?: boolean }) | null
    if (!editor || editor.__pastePatched) return
    editor.__pastePatched = true
    const onPaste = (e: Event) => {
      const ce = e as ClipboardEvent
      ce.preventDefault()
      const text = ce.clipboardData?.getData('text/plain') ?? ''
      // execCommand('insertText') is technically deprecated but is the only
      // cross-browser way to insert plain text into a contenteditable and have
      // the host framework's onChange fire correctly.
      document.execCommand('insertText', false, text)
    }
    editor.addEventListener('paste', onPaste)
  })

  async function sendMessage(text: string) {
    if (!text.trim()) return
    const userMsg: ProjectMessage = {
      id: nextId(),
      project_id: projectId,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    }
    const assistantMsg: ProjectMessage = {
      id: nextId(),
      project_id: projectId,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
    }
    const baseline = [...messages, userMsg]
    setMessages([...baseline, assistantMsg])
    setTyping(true)

    const abort = new AbortController()
    const timeoutId = setTimeout(() => abort.abort(), 60_000)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        signal: abort.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          messages: baseline.map((m) => ({ role: m.role, content: m.content })),
        }),
      })

      if (!res.ok) {
        const errText = await res
          .json()
          .then((j) => j?.error ?? "Couldn't reach the assistant. Try again.")
          .catch(() => "Couldn't reach the assistant. Try again.")
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: `[${errText}]` } : m))
        )
        return
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let full = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += decoder.decode(value)
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: full } : m))
        )
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: '[Connection lost. Try again.]' }
            : m
        )
      )
    } finally {
      clearTimeout(timeoutId)
      setTyping(false)
    }
  }

  async function handleFileUpload(file: File) {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('projectId', projectId)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        const reason = body?.error ?? 'Upload failed'
        const errMsg: ProjectMessage = {
          id: nextId(),
          project_id: projectId,
          role: 'assistant',
          content: `[Couldn't upload ${file.name}: ${reason}]`,
          created_at: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, errMsg])
        return
      }
      await sendMessage(
        `[Uploaded: ${file.name}]\n\nDocument content preview: ${body.preview}...`
      )
    } finally {
      setUploading(false)
    }
  }

  return (
    <div ref={rootRef} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <MainContainer style={{ flex: 1, border: 'none' }}>
        <ChatContainer>
          <MessageList
            typingIndicator={typing ? <TypingIndicator content="Thinking..." /> : null}
          >
            {messages.map((m) => {
              const upload = parseUploadMessage(m.content)
              if (upload) {
                return (
                  <Message
                    key={m.id}
                    model={{
                      direction: m.role === 'user' ? 'outgoing' : 'incoming',
                      position: 'normal',
                      type: 'custom',
                    }}
                  >
                    <Message.CustomContent>
                      <div className="upload-card">
                        <div className="upload-card__head">
                          <span className="upload-card__icon" aria-hidden />
                          {upload.filename}
                        </div>
                        <div className="upload-card__body">{upload.preview}</div>
                      </div>
                    </Message.CustomContent>
                  </Message>
                )
              }
              return (
                <Message
                  key={m.id}
                  model={{
                    message: m.content,
                    direction: m.role === 'user' ? 'outgoing' : 'incoming',
                    position: 'normal',
                  }}
                />
              )
            })}
          </MessageList>
          <MessageInput
            placeholder="Describe your project..."
            // Chatscope passes (innerHTML, textContent, innerText, nodes) — use
            // textContent so any HTML that snuck past the paste handler is
            // dropped before we persist or send to the LLM.
            onSend={(_innerHTML, textContent) => sendMessage(textContent)}
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
        accept=".pdf,.docx,.doc,.txt,.md"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFileUpload(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}
