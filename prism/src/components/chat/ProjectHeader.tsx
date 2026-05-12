import Link from 'next/link'
import { StatusDot } from '@/components/ui/StatusDot'
import type { Project } from '@/types/project'

export function ProjectHeader({ project }: { project: Project }) {
  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-surface-1">
      <div className="flex items-center gap-3 min-w-0">
        <h1 className="text-sm font-semibold text-text-0 truncate">{project.name}</h1>
        <div className="flex items-center gap-1.5 text-xs text-text-2">
          <StatusDot status={project.status} />
          <span className="capitalize">{project.status}</span>
        </div>
      </div>
      <Link
        href={`/project/${project.id}/qa`}
        className="inline-flex items-center gap-1.5 bg-primary text-primary-fg px-3 py-1.5 rounded-md text-xs font-semibold shadow-sm shadow-inset-pri"
      >
        Analyse Project →
      </Link>
    </header>
  )
}
