'use client'
import { Logo } from '@/components/ui/Logo'
import { useNewProjectDialog } from './NewProjectDialogProvider'

const STEPS = [
  {
    num: '01 / DESCRIBE',
    name: "Tell us what you're building",
    desc: 'Chat freely and upload any specs or docs.',
  },
  {
    num: '02 / REFINE',
    name: 'Answer a short Q&A',
    desc: 'Targeted questions fill the gaps. Max 25.',
  },
  {
    num: '03 / EXPORT',
    name: 'Download for any LLM',
    desc: 'A structured .md, optimized for context.',
  },
] as const

export function WelcomeScreen() {
  const { open } = useNewProjectDialog()
  return (
    <div className="flex items-center justify-center min-h-full p-8 text-center">
      <div>
        <div className="mx-auto mb-4">
          <Logo size={40} />
        </div>
        <h2 className="text-2xl font-semibold text-text-0 tracking-tight mb-2">
          Welcome to Prism
        </h2>
        <p className="text-sm text-text-1 max-w-md mx-auto leading-relaxed mb-7">
          Define your project once, properly. Feed the export to any LLM — Claude, ChatGPT, Cursor — and skip the back-and-forth.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl mx-auto mb-7">
          {STEPS.map((s) => (
            <div
              key={s.num}
              className="bg-surface-1 border border-border rounded-xl p-4 text-left shadow-md shadow-inset"
            >
              <div className="font-mono text-[10px] font-semibold text-text-2 tracking-wider">
                {s.num}
              </div>
              <div className="text-sm font-semibold text-text-0 mt-1.5">{s.name}</div>
              <p className="text-xs text-text-2 mt-1 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
        <button
          onClick={open}
          className="inline-block bg-primary text-primary-fg px-6 py-2.5 rounded-lg text-sm font-semibold shadow-md shadow-inset-pri"
        >
          Create your first project
        </button>
      </div>
    </div>
  )
}
