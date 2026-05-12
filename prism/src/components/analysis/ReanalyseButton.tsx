'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import * as Dialog from '@radix-ui/react-dialog'
import { Button } from '@/components/ui/Button'

interface Props {
  projectId: string
  currentVersion: number
}

export function ReanalyseButton({ projectId, currentVersion }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onConfirm() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body?.error ?? "Couldn't re-analyse — try again.")
        return
      }
      setOpen(false)
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="ghost" type="button">Re-analyse</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] max-w-[90vw] bg-surface-0 border border-border-2 rounded-xl p-5 shadow-lg">
          <Dialog.Title className="text-sm font-semibold text-text-0 mb-2">
            Re-analyse from scratch?
          </Dialog.Title>
          <Dialog.Description className="text-xs text-text-2 mb-4 leading-relaxed">
            Replace v{currentVersion} with a fresh analysis. The new version
            will overwrite the current knowledge graph (~30–60 seconds).
          </Dialog.Description>
          {error && (
            <p role="alert" className="text-xs text-text-1 mb-3">{error}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="button" onClick={onConfirm} disabled={submitting}>
              {submitting ? 'Re-analysing…' : 'Confirm'}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
