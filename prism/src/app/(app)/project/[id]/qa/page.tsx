import Link from 'next/link'
import { getProjectById } from '@/lib/projects'
import { getProjectMessages } from '@/lib/messages'
import { getProjectDocuments } from '@/lib/documents'
import { getKnowledgeGraph } from '@/lib/knowledge'
import { AgentSummary } from '@/components/analysis/AgentSummary'
import { AnalysisRunner } from '@/components/analysis/AnalysisRunner'
import { ReanalyseButton } from '@/components/analysis/ReanalyseButton'

export default async function QaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const project = await getProjectById(id)

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-full p-6 text-center">
        <div>
          <h2 className="text-base font-semibold text-text-0">Project not found</h2>
          <Link
            href="/dashboard"
            className="inline-block mt-4 text-sm text-text-0 underline underline-offset-2"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    )
  }

  const graph = await getKnowledgeGraph(id)

  if (graph) {
    return (
      <div className="flex flex-col min-h-full">
        <div className="flex items-center justify-end px-6 py-3 border-b border-border bg-surface-1">
          <ReanalyseButton projectId={id} currentVersion={graph.version} />
        </div>
        <AgentSummary graph={graph} projectId={id} />
      </div>
    )
  }

  const [messages, documents] = await Promise.all([
    getProjectMessages(id),
    getProjectDocuments(id),
  ])
  const hasContent =
    messages.some((m) => m.role === 'user') || documents.length > 0

  if (!hasContent) {
    return (
      <div className="flex items-center justify-center min-h-full p-8 text-center">
        <div>
          <h2 className="text-base font-semibold text-text-0">
            Nothing to analyse yet
          </h2>
          <p className="text-xs text-text-2 mt-1.5 max-w-sm mx-auto">
            Have a chat with the agent and (optionally) upload documents.
            Then click <b>Analyse Project</b> again.
          </p>
          <Link
            href={`/project/${id}`}
            className="inline-block mt-6 text-sm text-text-0 underline underline-offset-2"
          >
            ← Back to chat
          </Link>
        </div>
      </div>
    )
  }

  return <AnalysisRunner projectId={id} />
}
