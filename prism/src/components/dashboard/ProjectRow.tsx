'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { StatusDot } from '@/components/ui/StatusDot'
import { cn } from '@/lib/utils'
import type { Project } from '@/types/project'

export function ProjectRow({ project }: { project: Project }) {
  const pathname = usePathname()
  const active = pathname?.includes(project.id) ?? false

  return (
    <Link
      href={`/project/${project.id}`}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors',
        active
          ? 'bg-surface-2 text-text-0 shadow-sm'
          : 'text-text-1 hover:bg-surface-2 hover:text-text-0'
      )}
    >
      <StatusDot status={project.status} />
      <span className="truncate">{project.name}</span>
    </Link>
  )
}
