import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, userEvent, waitFor, fireEvent } from '@/test/render'
import type { ProjectMessage } from '@/types/project'

// Mock chatscope with simple, jsdom-friendly stubs that expose the same surface:
// - MessageList renders typingIndicator + children (the Messages)
// - Message renders message.content
// - MessageInput renders a real <textarea> + a Send button; calls onSend on Enter or click
vi.mock('@chatscope/chat-ui-kit-react', async () => {
  const React = await import('react')
  return {
    MainContainer: ({ children }: any) => React.createElement('div', { 'data-testid': 'cs-main' }, children),
    ChatContainer: ({ children }: any) => React.createElement('div', { 'data-testid': 'cs-chat' }, children),
    MessageList: ({ children, typingIndicator }: any) =>
      React.createElement('div', { 'data-testid': 'cs-message-list' }, typingIndicator ?? null, children),
    Message: ({ model }: any) =>
      React.createElement('div', { 'data-testid': 'cs-message', 'data-direction': model.direction }, model.message),
    TypingIndicator: ({ content }: any) =>
      React.createElement('div', { 'data-testid': 'cs-typing' }, content),
    MessageInput: ({ placeholder, onSend, onAttachClick, disabled }: any) => {
      const [value, setValue] = React.useState('')
      // Real Chatscope passes (innerHTML, textContent, innerText, nodes).
      // For a textarea, all three string fields are the same plain text.
      const send = () => { onSend(value, value, value, []); setValue('') }
      return React.createElement(
        'div',
        { 'data-testid': 'cs-message-input' },
        React.createElement('button', {
          type: 'button',
          'aria-label': 'Attach',
          onClick: onAttachClick,
          disabled,
        }, '📎'),
        React.createElement('textarea', {
          placeholder,
          disabled,
          value,
          onChange: (e: any) => setValue(e.target.value),
          onKeyDown: (e: any) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          },
        }),
        React.createElement('button', {
          type: 'button',
          'aria-label': 'Send',
          disabled,
          onClick: send,
        }, 'Send'),
      )
    },
  }
})

// Stub the Chatscope CSS side-effect import (a CSS file)
vi.mock('@chatscope/chat-ui-kit-styles/dist/default/styles.min.css', () => ({}))

import { ChatWindow } from './ChatWindow'

function makeStreamResponse(chunks: string[]): Response {
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      for (const c of chunks) {
        controller.enqueue(enc.encode(c))
        await new Promise((r) => setTimeout(r, 0))
      }
      controller.close()
    },
  })
  return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/plain' } })
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('ChatWindow', () => {
  it('shows the welcome message when no initialMessages', () => {
    render(<ChatWindow projectId="p1" initialMessages={[]} />)
    expect(screen.getByText(/what project do you want to plan/i)).toBeInTheDocument()
  })

  it('shows initialMessages when provided', () => {
    const msgs: ProjectMessage[] = [
      { id: 'm1', project_id: 'p1', role: 'user', content: 'Existing question', created_at: '2026-05-12T00:00:00Z' },
    ]
    render(<ChatWindow projectId="p1" initialMessages={msgs} />)
    expect(screen.getByText(/existing question/i)).toBeInTheDocument()
  })

  it('sends a message and renders streamed chunks', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      makeStreamResponse(['Hi', ' there'])
    )
    render(<ChatWindow projectId="p1" initialMessages={[]} />)

    const input = screen.getByPlaceholderText(/describe your project/i)
    await userEvent.type(input, 'Hello')
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(screen.getByText('Hello')).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(screen.getByText(/Hi there/i)).toBeInTheDocument()
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/chat',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('shows inline error on fetch failure', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'oops' }), { status: 500 })
    )
    render(<ChatWindow projectId="p1" initialMessages={[]} />)

    const input = screen.getByPlaceholderText(/describe your project/i)
    await userEvent.type(input, 'X')
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(screen.getByText(/oops|couldn't|connection lost/i)).toBeInTheDocument()
    })
  })
})
