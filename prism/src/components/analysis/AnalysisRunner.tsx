'use client'
import { startTransition, useEffect, useRef, useState } from 'react'
import { AgentSummary } from './AgentSummary'
import type { KnowledgeGraph } from '@/types/knowledge'

const LABELS = [
  'Reading your chat + documents...',
  'Extracting facts...',
  'Looking for conflicts...',
  'Surfacing assumptions...',
  'Identifying gaps...',
]

interface AnalysisRunnerProps {
  projectId: string
}

export function AnalysisRunner({ projectId }: AnalysisRunnerProps) {
  const [labelIndex, setLabelIndex] = useState(0)
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const requestRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (graph || error) return
    const id = setInterval(() => {
      setLabelIndex((i) => (i + 1) % LABELS.length)
    }, 8000)
    return () => clearInterval(id)
  }, [graph, error])

  useEffect(() => {
    startTransition(() => {
      setError(null)
      setGraph(null)
      setLabelIndex(0)
    })
    const abort = new AbortController()
    requestRef.current = abort
    const timeoutId = setTimeout(() => abort.abort(), 180_000)

    fetch('/api/parse', {
      method: 'POST',
      signal: abort.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          setError(body?.error ?? "Couldn't analyse — try again.")
          return
        }
        const body = await res.json()
        setGraph(body.graph as KnowledgeGraph)
      })
      .catch(() => {
        setError("Couldn't analyse — try again.")
      })
      .finally(() => {
        clearTimeout(timeoutId)
      })

    return () => {
      abort.abort()
      clearTimeout(timeoutId)
    }
  }, [projectId, attempt])

  if (graph) {
    return <AgentSummary graph={graph} projectId={projectId} />
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto p-6 text-center">
        <p role="alert" className="text-sm text-text-1 mb-4">{error}</p>
        <button
          type="button"
          onClick={() => setAttempt((a) => a + 1)}
          className="inline-flex items-center bg-primary text-primary-fg px-4 py-2 rounded-md text-sm font-semibold shadow-sm shadow-inset-pri"
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="max-w-md mx-auto p-6 text-center"
    >
      <div className="mx-auto mb-4 w-6 h-6 border-2 border-text-2 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-text-1">{LABELS[labelIndex]}</p>
      <p className="text-xs text-text-2 mt-2">This usually takes 30–60 seconds.</p>
    </div>
  )
}
