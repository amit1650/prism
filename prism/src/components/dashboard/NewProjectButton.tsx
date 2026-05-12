'use client'
import { useNewProjectDialog } from './NewProjectDialogProvider'
import { Button } from '@/components/ui/Button'

export function NewProjectButton() {
  const { open } = useNewProjectDialog()
  return (
    <Button onClick={open} className="w-full">
      <span aria-hidden>+</span> New Project
    </Button>
  )
}
