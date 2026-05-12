# 03 — Architecture

## Folder Structure

```
prism/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx          # Login page — Google + Email
│   │   │   └── layout.tsx
│   │   ├── (app)/
│   │   │   ├── layout.tsx            # App shell — sidebar + main area
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx          # Project thread list
│   │   │   ├── project/
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx      # Chat intake screen
│   │   │   │       ├── qa/
│   │   │   │       │   └── page.tsx  # Q&A wizard screen
│   │   │   │       ├── review/
│   │   │   │       │   └── page.tsx  # Compile review screen
│   │   │   │       └── export/
│   │   │   │           └── page.tsx  # Export screen
│   │   │   └── layout.tsx
│   │   ├── api/
│   │   │   ├── chat/
│   │   │   │   └── route.ts          # Claude chat endpoint (streaming)
│   │   │   ├── parse/
│   │   │   │   └── route.ts          # Document + chat parsing pipeline
│   │   │   ├── questions/
│   │   │   │   └── route.ts          # Q&A question generator
│   │   │   ├── compile/
│   │   │   │   └── route.ts          # Final spec compiler
│   │   │   └── upload/
│   │   │       └── route.ts          # File upload handler
│   │   ├── layout.tsx
│   │   └── page.tsx                  # Root → redirect to login or dashboard
│   ├── components/
│   │   ├── chat/
│   │   │   ├── ChatWindow.tsx        # Chatscope wrapper — main chat UI
│   │   │   ├── FileUploadButton.tsx  # Attachment button component
│   │   │   └── AgentSummary.tsx      # Structured summary after intake
│   │   ├── qa/
│   │   │   ├── QuestionCard.tsx      # Single Q&A question card
│   │   │   ├── OptionButton.tsx      # A/B/C/D option buttons
│   │   │   ├── CustomAnswerInput.tsx # D — custom answer text input
│   │   │   └── QAProgress.tsx        # Progress bar for wizard
│   │   ├── dashboard/
│   │   │   ├── ProjectSidebar.tsx    # Left sidebar with project list
│   │   │   ├── ProjectCard.tsx       # Individual project thread card
│   │   │   └── NewProjectButton.tsx  # Create new project CTA
│   │   ├── export/
│   │   │   ├── ExportPanel.tsx       # Export format selector
│   │   │   ├── FormatCard.tsx        # Individual format option card
│   │   │   └── SpecPreview.tsx       # .md preview before download
│   │   └── ui/
│   │       ├── Badge.tsx             # Confidence badges (confirmed/inferred/tentative)
│   │       ├── ProgressBar.tsx       # Generic progress bar
│   │       └── StatusDot.tsx         # Project status indicator
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts             # Browser Supabase client
│   │   │   ├── server.ts             # Server Supabase client
│   │   │   └── middleware.ts         # Auth middleware
│   │   ├── claude/
│   │   │   ├── client.ts             # Anthropic SDK instance
│   │   │   ├── prompts/
│   │   │   │   ├── parser.ts         # Entity extraction prompts
│   │   │   │   ├── questions.ts      # Q&A generation prompts
│   │   │   │   └── compiler.ts       # Spec compilation prompts
│   │   │   └── pipeline/
│   │   │       ├── extract.ts        # Layer-by-layer entity extraction
│   │   │       ├── conflict.ts       # Conflict detection
│   │   │       ├── assumptions.ts    # Assumption surfacing
│   │   │       ├── gaps.ts           # Gap analysis
│   │   │       └── graph.ts          # Knowledge graph builder
│   │   ├── export/
│   │   │   ├── builder.ts            # .md file builder
│   │   │   ├── formats/
│   │   │   │   ├── claude.ts         # Claude Projects format
│   │   │   │   ├── chatgpt.ts        # ChatGPT format
│   │   │   │   ├── cursor.ts         # .cursorrules format
│   │   │   │   └── raw.ts            # Raw markdown format
│   │   │   └── download.ts           # FileSaver wrapper
│   │   └── utils.ts                  # clsx, cn helpers
│   ├── types/
│   │   ├── project.ts                # Project, Thread types
│   │   ├── knowledge.ts              # KnowledgeGraph, Fact, Gap types
│   │   ├── qa.ts                     # Question, Answer types
│   │   └── export.ts                 # ExportFormat, ExportFile types
│   └── middleware.ts                 # Next.js middleware — auth guard
├── public/
├── .env.local
├── next.config.ts
├── tailwind.config.ts
└── package.json
```

---

## Data Flow

### Intake Phase
```
User types in chat / uploads file
        ↓
POST /api/upload (if file)
  → parse PDF/DOCX/TXT to plain text
  → store raw text in Supabase (project_documents)
        ↓
POST /api/chat (streaming)
  → Claude responds in Chatscope UI
  → messages stored in Supabase (project_messages)
        ↓
User clicks "I'm done, analyse this"
        ↓
POST /api/parse
  → runs full parsing pipeline on all messages + documents
  → returns structured KnowledgeGraph
  → stored in Supabase (project_knowledge)
        ↓
AgentSummary component displays results
```

### Q&A Phase
```
POST /api/questions
  → Claude reads KnowledgeGraph gaps + conflicts
  → generates max 25 targeted questions
  → returns Question[] array
        ↓
QA Wizard renders questions one by one
  → each answer updates local state
  → branching: answered question may mark others as skip
        ↓
On complete → POST /api/parse again with answers merged
  → KnowledgeGraph updated with Q&A answers
```

### Export Phase
```
POST /api/compile
  → reads final KnowledgeGraph
  → builds structured .md content
  → applies format template (Claude / ChatGPT / Cursor / Raw)
        ↓
ExportPanel shows preview + download buttons
  → FileSaver downloads the file
```

---

## State Management

No Redux or Zustand. Keep it simple:

- **URL state** — current project ID from `[id]` param
- **Server state** — Supabase via server components + client fetches
- **Local UI state** — React useState for chat messages, Q&A answers, wizard step
- **Knowledge graph** — always fetched from Supabase, never stored in memory long-term

---

## Auth Flow

```
/ (root)
  → check Supabase session
  → if authenticated → /dashboard
  → if not → /login

/login
  → Supabase Auth UI component (Google + Email)
  → on success → /dashboard

middleware.ts
  → protects all /app routes
  → redirects unauthenticated requests to /login
```

---

## API Route Patterns

All API routes follow this pattern:

```typescript
// POST /api/parse
export async function POST(req: Request) {
  // 1. Authenticate
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // 2. Validate input
  const body = await req.json()

  // 3. Do work (Claude API call, DB operation)

  // 4. Return structured response
  return Response.json({ result })
}
```
