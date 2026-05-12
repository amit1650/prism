import Link from 'next/link'
import { StatusDot } from '@/components/ui/StatusDot'
import type { KnowledgeGraph } from '@/types/knowledge'
import type { ProjectStatus } from '@/types/project'

interface AgentSummaryProps {
  graph: KnowledgeGraph
  projectId: string
}

interface SectionConfig {
  status: ProjectStatus
  heading: string
  items: string[]
}

function buildSections(graph: KnowledgeGraph): SectionConfig[] {
  const confirmedItems = Object.entries(graph.confirmed_facts).map(
    ([k, v]) => `${k}: ${v}`
  )
  const inferredItems = Object.entries(graph.inferred_facts).map(
    ([k, v]) => `${k}: ${v}`
  )
  const questionItems = graph.open_questions.map(
    (q) => `[${q.priority}] ${q.topic}${q.context ? ` — ${q.context}` : ''}`
  )
  const conflictItems = graph.conflicts.map(
    (c) =>
      `${c.topic}: "${c.source_a}" says ${c.value_a}; "${c.source_b}" says ${c.value_b}`
  )

  return [
    { status: 'ready', heading: 'Confirmed facts', items: confirmedItems },
    { status: 'clarifying', heading: 'Inferred', items: inferredItems },
    { status: 'drafting', heading: 'Open questions', items: questionItems },
    { status: 'exported', heading: 'Conflicts', items: conflictItems },
  ]
}

export function AgentSummary({ graph, projectId }: AgentSummaryProps) {
  const sections = buildSections(graph).filter((s) => s.items.length > 0)

  return (
    <div className="max-w-2xl mx-auto p-6">
      <header className="mb-6">
        <h2 className="text-lg font-semibold text-text-0 tracking-tight">
          Here&apos;s what I understood
        </h2>
        {graph.summary && (
          <p className="text-sm text-text-2 mt-1.5 leading-relaxed">
            {graph.summary}
          </p>
        )}
      </header>

      <div className="space-y-3 mb-6">
        {sections.map((section) => (
          <section
            key={section.heading}
            aria-labelledby={`section-${section.heading.replace(/\s+/g, '-')}`}
            className="bg-surface-1 border border-border rounded-xl p-4 shadow-md shadow-inset"
          >
            <h3
              id={`section-${section.heading.replace(/\s+/g, '-')}`}
              className="flex items-center gap-2 text-sm font-semibold text-text-0 mb-2"
            >
              <StatusDot status={section.status} />
              {section.heading} ({section.items.length})
            </h3>
            <ul className="space-y-1">
              {section.items.slice(0, 5).map((item, i) => (
                <li key={i} className="text-xs text-text-1 leading-relaxed">
                  • {item}
                </li>
              ))}
              {section.items.length > 5 && (
                <li className="text-xs text-text-2">
                  + {section.items.length - 5} more
                </li>
              )}
            </ul>
          </section>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-text-2">Version {graph.version}</p>
        <Link
          href={`/project/${projectId}/qa/wizard`}
          className="inline-flex items-center gap-1.5 bg-primary text-primary-fg px-4 py-2 rounded-md text-sm font-semibold shadow-sm shadow-inset-pri"
        >
          Proceed to Q&amp;A →
        </Link>
      </div>
    </div>
  )
}
