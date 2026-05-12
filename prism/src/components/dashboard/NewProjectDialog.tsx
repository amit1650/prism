'use client'
import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useNewProjectDialog } from './NewProjectDialogProvider'
import { createProjectAction } from '@/lib/actions/projects'
import { Button } from '@/components/ui/Button'

export function NewProjectDialog() {
  const { isOpen, close } = useNewProjectDialog()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const trimmedName = name.trim()
  const canSubmit = trimmedName.length > 0 && trimmedName.length <= 100 && !submitting

  function reset() {
    setName('')
    setDescription('')
    setError(null)
    setSubmitting(false)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      await createProjectAction({
        name: trimmedName,
        description: description.trim() || undefined,
      })
      reset()
      close()
    } catch (err) {
      const msg = (err as Error).message ?? ''
      // Next.js redirect throws with the digest "NEXT_REDIRECT" — let it bubble up
      if (msg.includes('NEXT_REDIRECT')) {
        // Close the dialog before the redirect propagates — the (app) layout
        // and its provider persist across same-tree navigation, so leaving
        // isOpen=true here would leave the dialog open on the destination page.
        reset()
        close()
        throw err
      }
      setError("Couldn't create project. Try again.")
      setSubmitting(false)
    }
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={(v) => (v ? null : (reset(), close()))}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] max-w-[90vw] bg-surface-0 border border-border-2 rounded-xl p-5 shadow-lg"
          onOpenAutoFocus={(e) => {
            // Focus the name input rather than the close button
            e.preventDefault()
            document.getElementById('new-project-name')?.focus()
          }}
        >
          <Dialog.Title className="text-sm font-semibold text-text-0 mb-3">
            New project
          </Dialog.Title>
          <Dialog.Description className="sr-only">
            Enter a name and optional description for your new project.
          </Dialog.Description>
          <form onSubmit={onSubmit} className="space-y-2">
            <div>
              <label htmlFor="new-project-name" className="sr-only">Project name</label>
              <input
                id="new-project-name"
                name="name"
                type="text"
                required
                maxLength={100}
                placeholder="Project name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-describedby={error ? 'new-project-error' : undefined}
                className="w-full px-3 py-2 bg-surface-2 border border-border-2 rounded-md text-sm text-text-0 placeholder:text-text-3 shadow-inner"
              />
            </div>
            <div>
              <label htmlFor="new-project-description" className="sr-only">One-line description (optional)</label>
              <input
                id="new-project-description"
                name="description"
                type="text"
                placeholder="One-line description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 bg-surface-2 border border-border-2 rounded-md text-sm text-text-0 placeholder:text-text-3 shadow-inner"
              />
            </div>
            {error && (
              <p id="new-project-error" role="alert" className="text-xs text-text-1">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => { reset(); close() }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {submitting ? 'Creating…' : 'Create & start'}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
