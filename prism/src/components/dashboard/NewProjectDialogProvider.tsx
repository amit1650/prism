'use client'
import { createContext, useContext, useState, type ReactNode } from 'react'
import { NewProjectDialog } from './NewProjectDialog'

type Ctx = { open: () => void; close: () => void; isOpen: boolean }

const DialogContext = createContext<Ctx | null>(null)

export function useNewProjectDialog(): Ctx {
  const ctx = useContext(DialogContext)
  if (!ctx) throw new Error('useNewProjectDialog must be used inside NewProjectDialogProvider')
  return ctx
}

export function NewProjectDialogProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false)
  const value: Ctx = {
    isOpen,
    open: () => setOpen(true),
    close: () => setOpen(false),
  }
  return (
    <DialogContext.Provider value={value}>
      {children}
      <NewProjectDialog />
    </DialogContext.Provider>
  )
}
