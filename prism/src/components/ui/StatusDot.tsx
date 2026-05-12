import { cn } from '@/lib/utils'
import type { ProjectStatus } from '@/types/project'

const styles: Record<ProjectStatus, string> = {
  drafting: 'bg-text-3',
  clarifying: 'bg-text-1',
  compiling: 'bg-text-1',
  ready: 'bg-text-0 shadow-[0_0_8px_rgba(255,255,255,0.4)]',
  exported: 'bg-text-0 ring-2 ring-text-3',
}

const LABELS: Record<ProjectStatus, string> = {
  drafting: 'Status: drafting',
  clarifying: 'Status: clarifying',
  compiling: 'Status: compiling',
  ready: 'Status: ready',
  exported: 'Status: exported',
}

export function StatusDot({ status, className }: { status: ProjectStatus; className?: string }) {
  return (
    <span
      role="img"
      aria-label={LABELS[status]}
      className={cn(
        'inline-block w-1.5 h-1.5 rounded-full flex-shrink-0',
        styles[status],
        className
      )}
    />
  )
}
