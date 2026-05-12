# 08 — Milestone 4: Q&A Wizard

## Goal
After the parsing summary, user enters a focused Q&A wizard. Claude generates targeted questions based on gaps and conflicts. User answers A/B/C/D or types a custom answer. Max 25 questions. Branching logic skips irrelevant questions. Answers update the knowledge graph.

## Deliverables
- [ ] `/api/questions` endpoint that generates targeted questions
- [ ] Q&A wizard page with question cards
- [ ] A/B/C/D option buttons + custom answer input
- [ ] Progress bar showing question N of total
- [ ] Branching — some answers skip subsequent questions
- [ ] Answers saved to Supabase and merged into knowledge graph

---

## Task 1 — Question Generation API

```typescript
// src/app/api/questions/route.ts
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic()

const QUESTION_GENERATION_PROMPT = `You are a project analyst. Based on the gaps and conflicts in this project knowledge graph, generate targeted clarification questions.

Rules:
- Maximum 25 questions total
- Only ask about genuine gaps — not things already confirmed
- Each question must have exactly 4 options (A, B, C, D)
- Option D is always "Custom answer..." (the user will type their own)
- Add branching: if answering A to question X makes question Y irrelevant, specify skip_if
- Include WHY you're asking each question (shown to user)
- Order: scope questions first, then technical, then constraints, then assumptions

Return ONLY valid JSON:
{
  "questions": [
    {
      "id": "q1",
      "topic": "short topic name",
      "question": "the question text",
      "why_asking": "one sentence explaining why this matters",
      "options": {
        "a": "option A text",
        "b": "option B text",
        "c": "option C text",
        "d": "Custom answer..."
      },
      "skippable": true,
      "skip_if": {}
    }
  ]
}

skip_if format: { "q3": ["a", "b"] } means if q3 was answered with a or b, skip this question.`

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId } = await req.json()

  const { data: knowledge } = await supabase
    .from('project_knowledge')
    .select('*')
    .eq('project_id', projectId)
    .single()

  if (!knowledge) return Response.json({ error: 'No knowledge graph found' }, { status: 404 })

  const prompt = `
Project Type: ${knowledge.project_type}
Summary: ${knowledge.summary}

Confirmed Facts:
${JSON.stringify(knowledge.confirmed_facts, null, 2)}

Open Questions (gaps to resolve):
${JSON.stringify(knowledge.open_questions, null, 2)}

Conflicts to resolve:
${JSON.stringify(knowledge.conflicts, null, 2)}

Unvalidated Assumptions:
${JSON.stringify(knowledge.assumptions, null, 2)}
`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    system: QUESTION_GENERATION_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  let questions
  try {
    const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())
    questions = parsed.questions
  } catch {
    return Response.json({ error: 'Failed to generate questions' }, { status: 500 })
  }

  // Save Q&A session
  const { data: session } = await supabase
    .from('project_qa_sessions')
    .insert({
      project_id: projectId,
      questions,
      status: 'pending',
    })
    .select()
    .single()

  return Response.json({ questions, sessionId: session?.id })
}
```

---

## Task 2 — Q&A Wizard Page

```typescript
// src/app/(app)/project/[id]/qa/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Question, Answer } from '@/types/qa'
import QuestionCard from '@/components/qa/QuestionCard'
import QAProgress from '@/components/qa/QAProgress'
import { createClient } from '@/lib/supabase/client'

export default function QAPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [questions, setQuestions] = useState<Question[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const generate = async () => {
      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })
      const data = await res.json()
      setQuestions(data.questions || [])
      setSessionId(data.sessionId)
      setLoading(false)
    }
    generate()
  }, [projectId])

  // Get visible questions (apply branching logic)
  const visibleQuestions = questions.filter(q => {
    if (!q.skip_if || Object.keys(q.skip_if).length === 0) return true
    return !Object.entries(q.skip_if).some(([questionId, triggerAnswers]) => {
      const answer = answers[questionId]
      return answer && triggerAnswers.includes(answer.selected)
    })
  })

  const currentQuestion = visibleQuestions[currentIndex]
  const isLast = currentIndex === visibleQuestions.length - 1

  const handleAnswer = (answer: Answer) => {
    setAnswers(prev => ({ ...prev, [answer.question_id]: answer }))
  }

  const handleNext = () => {
    if (isLast) {
      handleSubmit()
    } else {
      setCurrentIndex(i => i + 1)
    }
  }

  const handleBack = () => {
    if (currentIndex > 0) setCurrentIndex(i => i - 1)
  }

  const handleSkip = () => {
    if (!isLast) setCurrentIndex(i => i + 1)
  }

  const handleSubmit = async () => {
    setSubmitting(true)

    // Save answers to session
    if (sessionId) {
      await supabase
        .from('project_qa_sessions')
        .update({ answers, status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', sessionId)
    }

    // Re-run parsing with answers merged
    await fetch('/api/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, qaAnswers: answers }),
    })

    router.push(`/project/${projectId}/review`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-950">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Generating questions from your project...</p>
        </div>
      </div>
    )
  }

  if (visibleQuestions.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-950">
        <div className="text-center">
          <p className="text-white text-lg mb-4">No clarifications needed!</p>
          <p className="text-gray-400 mb-6">Your project is well defined. Ready to export.</p>
          <a
            href={`/project/${projectId}/review`}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-colors"
          >
            Continue to Review →
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <QAProgress
          current={currentIndex + 1}
          total={visibleQuestions.length}
        />

        <div className="mt-8">
          {currentQuestion && (
            <QuestionCard
              key={currentQuestion.id}
              question={currentQuestion}
              existingAnswer={answers[currentQuestion.id]}
              onAnswer={handleAnswer}
            />
          )}
        </div>

        <div className="flex items-center justify-between mt-6">
          <button
            onClick={handleBack}
            disabled={currentIndex === 0}
            className="px-4 py-2 text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            ← Back
          </button>

          <div className="flex gap-3">
            {currentQuestion?.skippable && (
              <button
                onClick={handleSkip}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm"
              >
                Decide later
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={!answers[currentQuestion?.id] || submitting}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl disabled:opacity-40 transition-colors"
            >
              {submitting ? 'Saving...' : isLast ? 'Complete →' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

---

## Task 3 — Question Card Component

```typescript
// src/components/qa/QuestionCard.tsx
'use client'
import { useState } from 'react'
import { Question, Answer } from '@/types/qa'
import OptionButton from './OptionButton'
import CustomAnswerInput from './CustomAnswerInput'
import { Info } from 'lucide-react'

interface QuestionCardProps {
  question: Question
  existingAnswer?: Answer
  onAnswer: (answer: Answer) => void
}

export default function QuestionCard({ question, existingAnswer, onAnswer }: QuestionCardProps) {
  const [selected, setSelected] = useState<'a' | 'b' | 'c' | 'd' | null>(
    existingAnswer?.selected || null
  )
  const [customText, setCustomText] = useState(existingAnswer?.custom_text || '')
  const [showWhy, setShowWhy] = useState(false)

  const handleSelect = (option: 'a' | 'b' | 'c' | 'd') => {
    setSelected(option)
    if (option !== 'd') {
      onAnswer({ question_id: question.id, selected: option })
    }
  }

  const handleCustomSubmit = () => {
    if (customText.trim()) {
      onAnswer({ question_id: question.id, selected: 'd', custom_text: customText })
    }
  }

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
      {/* Topic tag */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-medium text-blue-400 bg-blue-400/10 px-3 py-1 rounded-full">
          {question.topic}
        </span>
        <button
          onClick={() => setShowWhy(!showWhy)}
          className="text-gray-500 hover:text-gray-300 transition-colors"
          title="Why are we asking this?"
        >
          <Info size={16} />
        </button>
      </div>

      {/* Why asking */}
      {showWhy && (
        <div className="mb-4 p-3 bg-gray-800 rounded-xl text-sm text-gray-300">
          <span className="text-gray-500 font-medium">Why we're asking: </span>
          {question.why_asking}
        </div>
      )}

      {/* Question */}
      <h2 className="text-white text-lg font-medium mb-6 leading-snug">
        {question.question}
      </h2>

      {/* Options */}
      <div className="space-y-3">
        {(['a', 'b', 'c', 'd'] as const).map(opt => (
          <OptionButton
            key={opt}
            label={opt.toUpperCase()}
            text={question.options[opt]}
            selected={selected === opt}
            onClick={() => handleSelect(opt)}
            isCustom={opt === 'd'}
          />
        ))}
      </div>

      {/* Custom answer input */}
      {selected === 'd' && (
        <div className="mt-4">
          <CustomAnswerInput
            value={customText}
            onChange={setCustomText}
            onSubmit={handleCustomSubmit}
            placeholder={`Your answer to: ${question.question}`}
          />
        </div>
      )}
    </div>
  )
}
```

---

## Task 4 — Option Button + Custom Input Components

```typescript
// src/components/qa/OptionButton.tsx
interface OptionButtonProps {
  label: string
  text: string
  selected: boolean
  onClick: () => void
  isCustom?: boolean
}

export default function OptionButton({ label, text, selected, onClick, isCustom }: OptionButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-start gap-4 p-4 rounded-xl border text-left transition-all ${
        selected
          ? 'border-blue-500 bg-blue-500/10 text-white'
          : 'border-gray-700 hover:border-gray-600 text-gray-300 hover:text-white'
      } ${isCustom ? 'border-dashed' : ''}`}
    >
      <span className={`text-xs font-bold px-2 py-1 rounded flex-shrink-0 mt-0.5 ${
        selected ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-400'
      }`}>
        {label}
      </span>
      <span className="text-sm leading-relaxed">{text}</span>
    </button>
  )
}
```

```typescript
// src/components/qa/CustomAnswerInput.tsx
interface CustomAnswerInputProps {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  placeholder: string
}

export default function CustomAnswerInput({ value, onChange, onSubmit, placeholder }: CustomAnswerInputProps) {
  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none text-sm"
      />
      <button
        onClick={onSubmit}
        disabled={!value.trim()}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg disabled:opacity-40 transition-colors"
      >
        Confirm answer
      </button>
    </div>
  )
}
```

```typescript
// src/components/qa/QAProgress.tsx
interface QAProgressProps {
  current: number
  total: number
}

export default function QAProgress({ current, total }: QAProgressProps) {
  const pct = Math.round((current / total) * 100)
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-400 text-sm">Question {current} of {total}</span>
        <span className="text-gray-400 text-sm">{pct}%</span>
      </div>
      <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
```

---

## M4 Done When
- [ ] Q&A page loads with generated questions from Claude
- [ ] Questions are specific to detected gaps — not generic
- [ ] Each question shows topic tag + optional "why asking" info
- [ ] A/B/C/D buttons select correctly
- [ ] D option shows custom text input
- [ ] Progress bar updates correctly
- [ ] Back button works
- [ ] "Decide later" skip works on skippable questions
- [ ] Branching skips irrelevant questions based on previous answers
- [ ] On completion, answers saved to `project_qa_sessions`
- [ ] Parsing re-runs with answers and knowledge graph updates
- [ ] Redirects to `/project/[id]/review`
