# 07 — Milestone 3: Parsing Pipeline

## Goal
When user clicks "Analyse Project", all chat messages and uploaded documents are processed by a multi-stage Claude pipeline. Output is a structured knowledge graph stored in Supabase. Agent shows a summary of what it understood.

## Deliverables
- [ ] `/api/parse` endpoint that runs the full pipeline
- [ ] 6-stage parsing pipeline (extract → resolve → detect conflicts → surface assumptions → map gaps → build graph)
- [ ] Knowledge graph stored in Supabase
- [ ] Agent Summary component showing results with confidence levels
- [ ] Project status updated to 'clarifying'

---

## The Parsing Pipeline

Each stage is a separate focused Claude call. Never combine stages into one prompt.

```
Stage 1 — Entity Extraction    (WHO, WHAT, WHY, HOW, WHY NOT)
Stage 2 — Reference Resolution (expand vague references)
Stage 3 — Conflict Detection   (cross-doc, cross-message contradictions)
Stage 4 — Assumption Surfacing (unstated beliefs, implied decisions)
Stage 5 — Gap Analysis         (what's missing, what's unclear)
Stage 6 — Graph Assembly       (merge all stages into knowledge graph)
```

---

## Task 1 — Claude Prompts

```typescript
// src/lib/claude/prompts/parser.ts

export const ENTITY_EXTRACTION_PROMPT = `You are a project analyst. Extract structured information from this project description.

Return ONLY valid JSON in this exact format:
{
  "project_type": "web_app | mobile_app | api | cli | data_pipeline | other",
  "summary": "2-3 sentence dense description of the project",
  "confirmed": {
    "key": "value"  // high confidence, explicitly stated facts
  },
  "inferred": {
    "key": "value"  // medium confidence, implied but not stated
  },
  "tentative": {
    "key": "value"  // low confidence, uncertain
  },
  "non_goals": ["list of things explicitly out of scope"],
  "decisions": [
    {
      "topic": "topic name",
      "choice": "what was decided",
      "rationale": "why (if given)"
    }
  ],
  "tradeoffs": [
    {
      "description": "what was traded off",
      "accepted": true,
      "rationale": "why accepted"
    }
  ],
  "domain_language": {
    "term": "definition"
  }
}

Focus on WHAT the project is and does. Ignore people, deadlines, and delivery dates.`

export const CONFLICT_DETECTION_PROMPT = `You are a consistency analyst. Review these project facts from multiple sources and identify conflicts.

Return ONLY valid JSON:
{
  "conflicts": [
    {
      "topic": "what the conflict is about",
      "source_a": "first source description",
      "value_a": "what source A says",
      "source_b": "second source description",
      "value_b": "what source B says",
      "resolved": false
    }
  ]
}

If no conflicts found, return: { "conflicts": [] }`

export const ASSUMPTION_SURFACING_PROMPT = `You are a project analyst. Identify unstated assumptions in this project description — things the author assumed without explicitly stating.

Look for:
- Linguistic hedges: "obviously", "the usual", "standard", "similar to X"
- Implied infrastructure (auth assumed but not mentioned)
- Implied technical decisions (no explicit stack but domain implies one)
- Vague references to other systems or tools

Return ONLY valid JSON:
{
  "assumptions": [
    "assumption statement as a clear fact"
  ]
}`

export const GAP_ANALYSIS_PROMPT = `You are a project analyst. Given these confirmed facts, inferred facts, and domain, identify what information is critically missing for an LLM to understand and build this project.

Return ONLY valid JSON:
{
  "open_questions": [
    {
      "topic": "short topic name",
      "priority": "high | medium | low",
      "context": "why this matters"
    }
  ]
}

Prioritize gaps that would block development decisions. Max 10 gaps.`
```

---

## Task 2 — Pipeline Engine

```typescript
// src/lib/claude/pipeline/extract.ts
import Anthropic from '@anthropic-ai/sdk'
import { ENTITY_EXTRACTION_PROMPT } from '../prompts/parser'

const anthropic = new Anthropic()

export async function extractEntities(content: string) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    system: ENTITY_EXTRACTION_PROMPT,
    messages: [{ role: 'user', content }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  try {
    return JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())
  } catch {
    return null
  }
}

export async function detectConflicts(sources: { label: string; content: string }[]) {
  const { CONFLICT_DETECTION_PROMPT } = await import('../prompts/parser')
  const prompt = sources
    .map(s => `SOURCE: ${s.label}\n${s.content}`)
    .join('\n\n---\n\n')

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    system: CONFLICT_DETECTION_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  try {
    return JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())
  } catch {
    return { conflicts: [] }
  }
}

export async function surfaceAssumptions(content: string) {
  const { ASSUMPTION_SURFACING_PROMPT } = await import('../prompts/parser')

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 800,
    system: ASSUMPTION_SURFACING_PROMPT,
    messages: [{ role: 'user', content }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  try {
    return JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())
  } catch {
    return { assumptions: [] }
  }
}

export async function analyseGaps(facts: object, projectType: string) {
  const { GAP_ANALYSIS_PROMPT } = await import('../prompts/parser')

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 800,
    system: GAP_ANALYSIS_PROMPT,
    messages: [{
      role: 'user',
      content: `Project Type: ${projectType}\n\nKnown Facts:\n${JSON.stringify(facts, null, 2)}`
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  try {
    return JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())
  } catch {
    return { open_questions: [] }
  }
}
```

---

## Task 3 — Parse API Route

```typescript
// src/app/api/parse/route.ts
import { createClient } from '@/lib/supabase/server'
import {
  extractEntities,
  detectConflicts,
  surfaceAssumptions,
  analyseGaps,
} from '@/lib/claude/pipeline/extract'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId } = await req.json()

  // Fetch all messages and documents
  const [{ data: messages }, { data: documents }] = await Promise.all([
    supabase.from('project_messages').select('*').eq('project_id', projectId).order('created_at'),
    supabase.from('project_documents').select('*').eq('project_id', projectId),
  ])

  // Build combined text for analysis
  const chatContent = (messages || [])
    .map(m => `[${m.role.toUpperCase()}]: ${m.content}`)
    .join('\n\n')

  const allContent = [
    chatContent,
    ...(documents || []).map(d => `[DOCUMENT: ${d.filename}]:\n${d.raw_text}`),
  ].join('\n\n===\n\n')

  // Stage 1 — Entity Extraction
  const entities = await extractEntities(allContent)
  if (!entities) return Response.json({ error: 'Extraction failed' }, { status: 500 })

  // Stage 2 — Conflict Detection (if multiple sources)
  let conflictResult = { conflicts: [] }
  if (documents && documents.length > 0) {
    const sources = [
      { label: 'Chat session', content: chatContent },
      ...(documents || []).map(d => ({ label: d.filename, content: d.raw_text })),
    ]
    conflictResult = await detectConflicts(sources)
  }

  // Stage 3 — Assumption Surfacing
  const assumptionResult = await surfaceAssumptions(allContent)

  // Stage 4 — Gap Analysis
  const gapResult = await analyseGaps(
    { ...entities.confirmed, ...entities.inferred },
    entities.project_type || 'unknown'
  )

  // Stage 5 — Build Knowledge Graph
  const knowledgeGraph = {
    project_id: projectId,
    version: 1,
    project_type: entities.project_type,
    summary: entities.summary,
    confirmed_facts: entities.confirmed || {},
    inferred_facts: entities.inferred || {},
    tentative_facts: entities.tentative || {},
    non_goals: entities.non_goals || [],
    decisions: entities.decisions || [],
    tradeoffs: entities.tradeoffs || [],
    assumptions: assumptionResult.assumptions || [],
    open_questions: gapResult.open_questions || [],
    conflicts: conflictResult.conflicts || [],
    domain_language: entities.domain_language || {},
  }

  // Upsert knowledge graph
  const { data: existing } = await supabase
    .from('project_knowledge')
    .select('version')
    .eq('project_id', projectId)
    .single()

  if (existing) {
    knowledgeGraph.version = existing.version + 1
    await supabase.from('project_knowledge').update(knowledgeGraph).eq('project_id', projectId)
  } else {
    await supabase.from('project_knowledge').insert(knowledgeGraph)
  }

  // Update project status
  await supabase.from('projects').update({ status: 'clarifying' }).eq('id', projectId)

  return Response.json({ knowledge: knowledgeGraph })
}
```

---

## Task 4 — Agent Summary Component

```typescript
// src/components/chat/AgentSummary.tsx
import { KnowledgeGraph } from '@/types/knowledge'
import { CheckCircle, AlertCircle, HelpCircle, Zap } from 'lucide-react'

interface AgentSummaryProps {
  knowledge: KnowledgeGraph
  onProceed: () => void
}

export default function AgentSummary({ knowledge, onProceed }: AgentSummaryProps) {
  const confirmedCount = Object.keys(knowledge.confirmed_facts).length
  const inferredCount = Object.keys(knowledge.inferred_facts).length
  const gapCount = knowledge.open_questions.length
  const conflictCount = knowledge.conflicts.length

  return (
    <div className="p-6 bg-gray-900 rounded-2xl border border-gray-800 max-w-2xl mx-auto">
      <h2 className="text-white font-semibold text-lg mb-1">Here's what I understood</h2>
      {knowledge.summary && (
        <p className="text-gray-400 text-sm mb-6">{knowledge.summary}</p>
      )}

      <div className="space-y-3 mb-6">
        <SummaryRow
          icon={<CheckCircle size={16} className="text-green-400" />}
          label="Confirmed"
          count={confirmedCount}
          color="text-green-400"
          items={Object.entries(knowledge.confirmed_facts).map(([k, v]) =>
            `${k}: ${typeof v === 'object' ? (v as any).value : v}`
          )}
        />
        <SummaryRow
          icon={<AlertCircle size={16} className="text-yellow-400" />}
          label="Inferred (not explicitly stated)"
          count={inferredCount}
          color="text-yellow-400"
          items={Object.entries(knowledge.inferred_facts).map(([k, v]) =>
            `${k}: ${typeof v === 'object' ? (v as any).value : v}`
          )}
        />
        <SummaryRow
          icon={<HelpCircle size={16} className="text-red-400" />}
          label="Gaps (need clarification)"
          count={gapCount}
          color="text-red-400"
          items={knowledge.open_questions.map(q => q.topic)}
        />
        {conflictCount > 0 && (
          <SummaryRow
            icon={<Zap size={16} className="text-orange-400" />}
            label="Conflicts detected"
            count={conflictCount}
            color="text-orange-400"
            items={knowledge.conflicts.map(c => c.topic)}
          />
        )}
      </div>

      <button
        onClick={onProceed}
        className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors"
      >
        Proceed to Q&A →
        {gapCount > 0 && <span className="ml-2 text-blue-200 text-sm">({gapCount} questions to clarify)</span>}
      </button>
    </div>
  )
}

function SummaryRow({ icon, label, count, color, items }: {
  icon: React.ReactNode
  label: string
  count: number
  color: string
  items: string[]
}) {
  if (count === 0) return null
  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className={`text-sm font-medium ${color}`}>{label}</span>
        <span className="ml-auto text-gray-400 text-sm">{count}</span>
      </div>
      <ul className="space-y-1">
        {items.slice(0, 5).map((item, i) => (
          <li key={i} className="text-gray-300 text-sm">• {item}</li>
        ))}
        {items.length > 5 && (
          <li className="text-gray-500 text-sm">+{items.length - 5} more</li>
        )}
      </ul>
    </div>
  )
}
```

---

## M3 Done When
- [ ] Clicking "Analyse Project" calls `/api/parse` successfully
- [ ] All 4 pipeline stages run without error
- [ ] Knowledge graph saved in Supabase `project_knowledge` table
- [ ] Agent Summary renders confirmed / inferred / gaps / conflicts correctly
- [ ] Version increments on re-analysis
- [ ] Project status changes to `clarifying`
- [ ] Empty projects handled gracefully (no crash)
