import { Logo } from '@/components/ui/Logo'
import type { ReactNode } from 'react'

export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-6">
      <div className="w-full max-w-sm p-7 bg-surface-1 rounded-2xl border border-border shadow-lg">
        <div className="flex items-center gap-2.5 mb-4">
          <Logo size={18} />
          <span className="font-semibold text-text-0">Prism</span>
        </div>
        <h1 className="text-lg font-semibold text-text-0 tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-text-2 mt-1">{subtitle}</p>}
        <div className="mt-5">{children}</div>
      </div>
    </div>
  )
}
