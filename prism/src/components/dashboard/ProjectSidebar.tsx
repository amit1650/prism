'use client'
import { Logo } from '@/components/ui/Logo'
import { ProjectRow } from './ProjectRow'
import { NewProjectButton } from './NewProjectButton'
import { SignOutButton } from './SignOutButton'
import type { Project } from '@/types/project'

export function ProjectSidebar({ projects }: { projects: Project[] }) {
  return (
    <aside className="w-64 h-full bg-surface-1 border-r border-border flex flex-col">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2.5">
        <Logo size={18} />
        <span className="font-semibold text-text-0 text-sm">Prism</span>
      </div>

      <div className="p-3">
        <NewProjectButton />
      </div>

      <nav aria-label="Projects" className="flex-1 overflow-y-auto px-2.5 pb-2 space-y-0.5">
        {projects.length === 0 ? (
          <p className="text-text-2 text-xs text-center py-6 leading-relaxed">
            No projects yet.
            <br />
            Create one to start.
          </p>
        ) : (
          projects.map((p) => <ProjectRow key={p.id} project={p} />)
        )}
      </nav>

      <div className="p-2 border-t border-border">
        <SignOutButton />
      </div>
    </aside>
  )
}
