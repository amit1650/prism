# 09 — Milestone 5: Export

## Goal
User reviews the final compiled knowledge graph and exports a structured `.md` file formatted for the LLM platform of their choice. The export is the final product — it must be immediately useful when pasted into any LLM.

## Deliverables
- [ ] `/api/compile` endpoint that builds the final spec
- [ ] Review page showing the compiled knowledge graph
- [ ] Export page with format selector
- [ ] 4 export formats: Claude, ChatGPT, Cursor, Raw Markdown
- [ ] Copy to clipboard + download as file
- [ ] Export saved to Supabase

---

## Task 1 — Compile API Route

```typescript
// src/app/api/compile/route.ts
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic()

const COMPILER_PROMPT = `You are a technical writer specializing in AI context documents. 
Generate a concise "PRE-ANSWERED LLM QUESTIONS" section.

Given the project knowledge graph, generate the 10-15 questions an LLM would most likely ask 
when starting to work on this project, with their answers already provided.

Return ONLY valid JSON:
{
  "pre_answered": [
    {
      "question": "What is the main purpose of this project?",
      "answer": "..."
    }
  ]
}`

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId, format } = await req.json()

  const [{ data: project }, { data: knowledge }] = await Promise.all([
    supabase.from('projects').select('*').eq('id', projectId).single(),
    supabase.from('project_knowledge').select('*').eq('project_id', projectId).single(),
  ])

  if (!project || !knowledge) {
    return Response.json({ error: 'Project or knowledge not found' }, { status: 404 })
  }

  // Generate pre-answered questions
  const qaResponse = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    system: COMPILER_PROMPT,
    messages: [{
      role: 'user',
      content: JSON.stringify(knowledge),
    }],
  })

  const qaText = qaResponse.content[0].type === 'text' ? qaResponse.content[0].text : ''
  let preAnswered = []
  try {
    const parsed = JSON.parse(qaText.replace(/```json\n?|\n?```/g, '').trim())
    preAnswered = parsed.pre_answered || []
  } catch {}

  // Build the markdown spec
  const spec = buildSpec(project, knowledge, preAnswered, format)

  // Save export
  await supabase.from('project_exports').insert({
    project_id: projectId,
    format,
    content: spec,
    knowledge_version: knowledge.version,
  })

  // Update project status
  await supabase.from('projects').update({ status: 'exported' }).eq('id', projectId)

  return Response.json({ spec, filename: `${slugify(project.name)}-context.md` })
}

function buildSpec(project: any, knowledge: any, preAnswered: any[], format: string): string {
  const header = getFormatHeader(project.name, format)
  const footer = getFormatFooter(format)

  const body = `
## WHAT THIS IS
${knowledge.summary || `A ${knowledge.project_type} project named ${project.name}.`}

## WHAT THIS IS NOT
${knowledge.non_goals.length > 0
  ? knowledge.non_goals.map((g: string) => `- ${g}`).join('\n')
  : '- No explicit non-goals defined yet'}

## CONFIRMED FACTS
${Object.entries(knowledge.confirmed_facts)
  .map(([k, v]: [string, any]) => `- **${k}**: ${v.value || v}`)
  .join('\n') || '- No confirmed facts yet'}

## INFERRED (treat as tentative)
${Object.entries(knowledge.inferred_facts)
  .map(([k, v]: [string, any]) => `- **${k}**: ${v.value || v} *(inferred)*`)
  .join('\n') || '- No inferences'}

## TECHNICAL DECISIONS & RATIONALE
${knowledge.decisions.length > 0
  ? knowledge.decisions.map((d: any) =>
      `- **${d.topic}**: ${d.choice}${d.rationale ? ` — *${d.rationale}*` : ''}`
    ).join('\n')
  : '- No explicit technical decisions recorded'}

## ACCEPTED TRADEOFFS
${knowledge.tradeoffs.length > 0
  ? knowledge.tradeoffs.map((t: any) => `- ${t.description}${t.rationale ? ` — *${t.rationale}*` : ''}`).join('\n')
  : '- No explicit tradeoffs recorded'}

## ASSUMPTIONS (do not contradict these)
${knowledge.assumptions.length > 0
  ? knowledge.assumptions.map((a: string) => `- ${a}`).join('\n')
  : '- No explicit assumptions surfaced'}

## OPEN QUESTIONS (flag if you encounter these)
${knowledge.open_questions.length > 0
  ? knowledge.open_questions.map((q: any) =>
      `- [${q.priority.toUpperCase()}] **${q.topic}**${q.context ? `: ${q.context}` : ''}`
    ).join('\n')
  : '- No open questions — project is fully defined'}

## DOMAIN LANGUAGE
${Object.entries(knowledge.domain_language).length > 0
  ? Object.entries(knowledge.domain_language)
      .map(([term, def]) => `- **${term}**: ${def}`)
      .join('\n')
  : '- No domain-specific terminology defined'}

## PRE-ANSWERED QUESTIONS
${preAnswered.length > 0
  ? preAnswered.map((qa: any) => `**Q: ${qa.question}**\nA: ${qa.answer}`).join('\n\n')
  : '- Not generated'}
`

  return `${header}${body}${footer}`
}

function getFormatHeader(name: string, format: string): string {
  const version = new Date().toISOString().split('T')[0]

  if (format === 'claude') {
    return `# PROJECT CONTEXT — ${name}
> Generated by Prism | Version: ${version}
> **Instructions for Claude**: Read this document completely before responding. Treat CONFIRMED FACTS as ground truth. Flag any OPEN QUESTIONS if they become relevant. Do not contradict ASSUMPTIONS.

---
`
  }

  if (format === 'chatgpt') {
    return `# PROJECT CONTEXT — ${name}
> Generated by Prism | Version: ${version}
> You are acting as a development assistant for this project. The following is the complete project context. Use it as your primary reference. Ask for clarification only on OPEN QUESTIONS.

---
`
  }

  if (format === 'cursor') {
    return `# CLAUDE.md — ${name}
# Generated by Prism | ${version}
# This file provides full project context for AI coding assistants.
# Place this file in your project root.

`
  }

  // raw
  return `# PROJECT CONTEXT — ${name}
> Generated by Prism | Version: ${version}

---
`
}

function getFormatFooter(format: string): string {
  if (format === 'cursor') {
    return `\n\n# END OF CONTEXT\n# When in doubt, refer back to CONFIRMED FACTS and TECHNICAL DECISIONS sections above.\n`
  }
  return `\n\n---\n*Generated by Prism*\n`
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}
```

---

## Task 2 — Review Page

```typescript
// src/app/(app)/project/[id]/review/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CheckCircle, AlertCircle, HelpCircle, ArrowRight } from 'lucide-react'

export default async function ReviewPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: project }, { data: knowledge }] = await Promise.all([
    supabase.from('projects').select('*').eq('id', params.id).single(),
    supabase.from('project_knowledge').select('*').eq('project_id', params.id).single(),
  ])

  if (!project || !knowledge) redirect('/dashboard')

  const confirmedCount = Object.keys(knowledge.confirmed_facts).length
  const inferredCount = Object.keys(knowledge.inferred_facts).length
  const gapCount = knowledge.open_questions.length
  const completeness = Math.round(
    (confirmedCount / Math.max(confirmedCount + inferredCount + gapCount, 1)) * 100
  )

  return (
    <div className="max-w-3xl mx-auto py-12 px-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">{project.name}</h1>
        <p className="text-gray-400">Knowledge Graph v{knowledge.version} — Review before export</p>
      </div>

      {/* Completeness */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-white font-medium">Spec Completeness</span>
          <span className="text-2xl font-bold text-white">{completeness}%</span>
        </div>
        <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all"
            style={{ width: `${completeness}%` }}
          />
        </div>
        <div className="flex gap-6 mt-4 text-sm">
          <span className="text-green-400">✓ {confirmedCount} confirmed</span>
          <span className="text-yellow-400">~ {inferredCount} inferred</span>
          <span className="text-red-400">? {gapCount} open</span>
        </div>
      </div>

      {/* Summary */}
      {knowledge.summary && (
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 mb-6">
          <h2 className="text-white font-medium mb-2">Summary</h2>
          <p className="text-gray-300 text-sm leading-relaxed">{knowledge.summary}</p>
        </div>
      )}

      {/* Open Questions Warning */}
      {gapCount > 0 && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-4 mb-6">
          <p className="text-orange-300 text-sm font-medium mb-1">
            {gapCount} unresolved {gapCount === 1 ? 'question' : 'questions'}
          </p>
          <p className="text-orange-300/70 text-sm">
            These will be included in the export as open questions for the LLM to flag.
          </p>
        </div>
      )}

      {/* CTA */}
      <div className="flex gap-3">
        <a
          href={`/project/${params.id}/qa`}
          className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-colors text-sm"
        >
          ← Refine answers
        </a>
        <a
          href={`/project/${params.id}/export`}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors"
        >
          Export Context File
          <ArrowRight size={16} />
        </a>
      </div>
    </div>
  )
}
```

---

## Task 3 — Export Page

```typescript
// src/app/(app)/project/[id]/export/page.tsx
'use client'
import { useState } from 'react'
import { useParams } from 'next/navigation'
import { Download, Copy, Check } from 'lucide-react'
import saveAs from 'file-saver'

const FORMATS = [
  {
    id: 'claude',
    name: 'Claude (Projects / Opus / Sonnet)',
    description: 'Optimized for Claude Projects. Includes role instructions and ground truth markers.',
    badge: 'Recommended',
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT / Custom GPT',
    description: 'Formatted for ChatGPT system prompt or Custom GPT instructions.',
    badge: null,
  },
  {
    id: 'cursor',
    name: 'Cursor / Claude Code',
    description: 'CLAUDE.md / .cursorrules format. Place in project root for IDE AI tools.',
    badge: null,
  },
  {
    id: 'raw',
    name: 'Raw Markdown',
    description: 'Clean universal .md file. Works with any tool.',
    badge: null,
  },
]

export default function ExportPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const [selectedFormat, setSelectedFormat] = useState('claude')
  const [spec, setSpec] = useState<string | null>(null)
  const [filename, setFilename] = useState('project-context.md')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const compile = async () => {
    setLoading(true)
    const res = await fetch('/api/compile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, format: selectedFormat }),
    })
    const data = await res.json()
    setSpec(data.spec)
    setFilename(data.filename)
    setLoading(false)
  }

  const download = () => {
    if (!spec) return
    const blob = new Blob([spec], { type: 'text/markdown;charset=utf-8' })
    saveAs(blob, filename)
  }

  const copy = async () => {
    if (!spec) return
    await navigator.clipboard.writeText(spec)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="max-w-3xl mx-auto py-12 px-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Export Context File</h1>
        <p className="text-gray-400">Choose a format, compile, and download or copy.</p>
      </div>

      {/* Format selector */}
      <div className="space-y-3 mb-8">
        {FORMATS.map(fmt => (
          <button
            key={fmt.id}
            onClick={() => { setSelectedFormat(fmt.id); setSpec(null) }}
            className={`w-full text-left p-4 rounded-xl border transition-all ${
              selectedFormat === fmt.id
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-gray-700 hover:border-gray-600 bg-gray-900'
            }`}
          >
            <div className="flex items-center gap-3 mb-1">
              <span className="text-white font-medium text-sm">{fmt.name}</span>
              {fmt.badge && (
                <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full">
                  {fmt.badge}
                </span>
              )}
            </div>
            <p className="text-gray-400 text-sm">{fmt.description}</p>
          </button>
        ))}
      </div>

      {/* Compile button */}
      {!spec && (
        <button
          onClick={compile}
          disabled={loading}
          className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium disabled:opacity-50 transition-colors"
        >
          {loading ? 'Compiling...' : 'Compile Context File'}
        </button>
      )}

      {/* Preview + actions */}
      {spec && (
        <div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-4 max-h-80 overflow-y-auto">
            <pre className="text-gray-300 text-xs font-mono whitespace-pre-wrap leading-relaxed">
              {spec}
            </pre>
          </div>
          <div className="flex gap-3">
            <button
              onClick={copy}
              className="flex items-center gap-2 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-colors"
            >
              {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={download}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors"
            >
              <Download size={16} />
              Download {filename}
            </button>
          </div>
          <button
            onClick={() => setSpec(null)}
            className="w-full mt-3 text-gray-400 hover:text-white text-sm transition-colors"
          >
            Change format
          </button>
        </div>
      )}
    </div>
  )
}
```

---

## M5 Done When
- [ ] Review page shows completeness score correctly
- [ ] Compile runs without error for all 4 formats
- [ ] Each format has correct header/footer for its target platform
- [ ] Pre-answered questions section is generated and included
- [ ] Download button saves correct `.md` file
- [ ] Copy to clipboard works
- [ ] Export saved in Supabase `project_exports` table
- [ ] Project status updates to `exported`
- [ ] Pasting the exported file into Claude or ChatGPT gives immediate, accurate project understanding
