import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@/test/render'
import { AnalysisRunner } from './AnalysisRunner'
import { makeKnowledgeGraph } from '@/test/factories'

beforeEach(() => {
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('AnalysisRunner', () => {
  it('shows the first rotating label immediately and rotates after 8s', async () => {
    vi.useFakeTimers()
    vi.spyOn(global, 'fetch').mockReturnValue(new Promise(() => {})) // never resolves
    render(<AnalysisRunner projectId="p1" />)

    expect(screen.getByText(/reading your chat \+ documents/i)).toBeInTheDocument()

    await act(async () => { await vi.advanceTimersByTimeAsync(8000) })
    expect(screen.getByText(/extracting facts/i)).toBeInTheDocument()

    await act(async () => { await vi.advanceTimersByTimeAsync(8000) })
    expect(screen.getByText(/looking for conflicts/i)).toBeInTheDocument()
  })

  it('renders <AgentSummary> when fetch resolves with a graph', async () => {
    const graph = makeKnowledgeGraph({ summary: 'A test project.' })
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ graph }), { status: 200 })
    )
    render(<AnalysisRunner projectId="p1" />)

    await waitFor(() => {
      expect(screen.getByText(/here.{1,3}s what i understood/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/a test project/i)).toBeInTheDocument()
  })

  it('renders an inline error + Try again button on failure', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: "Couldn't analyse — try again." }), {
        status: 502,
      })
    )
    render(<AnalysisRunner projectId="p1" />)

    await waitFor(() => {
      expect(screen.getByText(/couldn.{1,3}t analyse/i)).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })
})
