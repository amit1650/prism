# Prism M2 — Chat Intake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the M2 chat intake layer for Prism — a chat-enabled `/project/[id]` page that streams an LLM response (OpenAI primary, Groq fallback) over a persisted message history, plus a file-upload pipeline that parses PDF/DOCX/TXT/MD and stores the extracted text.

**Architecture:** Two new API routes (`/api/chat` streaming, `/api/upload` multipart) sit on top of a thin provider abstraction (the `openai` SDK with provider-specific `baseURL`). The chat page composes a small custom `<ProjectHeader>` with a `<ChatWindow>` that wraps Chatscope as-is — no custom message bubbles, scrolling, or input components. Messages and documents persist in Supabase with the same RLS-by-project pattern used in M1.

**Tech Stack:** Next.js 16, TypeScript, `openai` SDK (pointed at OpenAI or Groq), `@chatscope/chat-ui-kit-react`, `pdf-parse`, `mammoth`, Supabase, Vitest + RTL, Playwright + `@axe-core/playwright`.

---

## Spec Reference

This plan implements `docs/superpowers/specs/2026-05-12-prism-m2-chat-intake-design.md`. Read it first; it documents every decision, deviation from `Docs/06`, and the deferred items.

## Prerequisites

- M1 is complete and passing (`npm test`, `npm run test:e2e`, `npm run build` all green from the `prism/` subdirectory)
- User has a Groq API key (will paste it during Task 2). OpenAI key is empty for now and falls through to Groq.
- The Supabase project from M1 is still accessible and the user can run SQL in its dashboard.

## File Structure

All paths are **inside the `prism/` subdirectory**.

### Created

| File | Responsibility |
|---|---|
| `src/app/api/chat/route.ts` | POST: validate, save user message, call LLM with `stream: true`, stream chunks to client, save assistant message |
| `src/app/api/upload/route.ts` | POST multipart: validate, parse by extension, truncate, insert into `project_documents` |
| `src/app/(app)/project/[id]/qa/page.tsx` | M2 stub for the M3 entry point |
| `src/components/chat/ChatWindow.tsx` | Chatscope wrapper, `sendMessage` (streaming fetch), `handleFileUpload` |
| `src/components/chat/ProjectHeader.tsx` | Header with project name, status badge, "Analyse Project" link |
| `src/lib/llm/client.ts` | `getLLM()` provider factory |
| `src/lib/llm/prompts.ts` | `SYSTEM_PROMPT` constant |
| `src/lib/files/parse.ts` | `parseFile(filename, buffer)` dispatching to pdf-parse / mammoth / plain |
| `src/lib/messages.ts` | `getProjectMessages(id)` |
| `src/lib/documents.ts` | `getProjectDocuments(id)` |
| `src/test/llm-mock.ts` | `mockLLMClient({ chunks, failBeforeStream, failAfterChunk })` |
| `src/test/fixtures/sample.txt` | Plain-text fixture for E2E upload spec |
| Tests | one `*.test.ts(x)` next to each module above + 1 new E2E spec |

### Modified

| File | Change |
|---|---|
| `src/app/(app)/project/[id]/page.tsx` | Replace M1 stub with chat-enabled page |
| `src/types/project.ts` | Add `ProjectMessage`, `ProjectDocument` interfaces |
| `src/app/globals.css` | Add Chatscope CSS import + theme variable overrides |
| `src/test/supabase-mock.ts` | Extend default `fromHandlers` to support `project_messages` / `project_documents` |
| `prism/package.json` | Add `openai`, `@chatscope/chat-ui-kit-react`, `@chatscope/chat-ui-kit-styles`, `pdf-parse`, `mammoth` (+ `@types/pdf-parse` dev) |
| `prism/.env.local` | Add `OPENAI_API_KEY=`, `OPENAI_MODEL`, `GROQ_API_KEY`, `GROQ_MODEL` |
| `prism/.env.local.example` | Same with placeholder values |
| `Docs/02-tech-stack.md` | Update to reflect multi-provider design |
| `CLAUDE.md` (repo root) | Mark M2 shipped |
| `tests/e2e/a11y.spec.ts` | Add a `/project/[id]` audit after seeding a message |

---

## Tasks

### Task 1: Supabase schema setup (manual user step)

**Files:** No code in this task — the engineer talks the user through SQL in the Supabase dashboard, exactly as in M1 Task 1.

- [ ] **Step 1: Tell the user to open the SQL Editor**

Message to send to the user:

> Open https://supabase.com/dashboard, pick the `prism-dev` project, click **SQL Editor → New query**. Paste the SQL block I'm sending in the next step and click **Run**. Tell me when it shows "Success. No rows returned."

- [ ] **Step 2: SQL to paste**

```sql
-- M2: project_messages
create table project_messages (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);
alter table project_messages enable row level security;
create policy "Users access messages for their projects"
  on project_messages for all using (
    exists (select 1 from projects
            where projects.id = project_messages.project_id
              and projects.user_id = auth.uid())
  );

-- M2: project_documents
create table project_documents (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects(id) on delete cascade not null,
  filename text not null,
  file_type text not null,
  raw_text text not null,
  created_at timestamptz default now()
);
alter table project_documents enable row level security;
create policy "Users access documents for their projects"
  on project_documents for all using (
    exists (select 1 from projects
            where projects.id = project_documents.project_id
              and projects.user_id = auth.uid())
  );
```

- [ ] **Step 3: Verify**

Ask the user to confirm the SQL ran without errors. If they see "ERROR: relation already exists", that means a previous run created the tables — that's fine, skip.

- [ ] **Step 4: Ask for the Groq API key**

Message:

> Now I need your Groq API key. Sign in to https://console.groq.com/keys, click **Create API Key**, copy the value (starts with `gsk_…`), and paste it back. Treat it as a secret.

Hold the key — it goes into `.env.local` in Task 2.

No commit in this task (git deferred).

---

### Task 2: Install M2 dependencies + env additions

**Files:**
- Modify: `prism/package.json` (via `npm install`)
- Modify: `prism/.env.local`
- Modify: `prism/.env.local.example`

- [ ] **Step 1: Install runtime deps**

```bash
cd /Users/user/Documents/AI-Projects/prism/prism
npm install \
  openai@^4 \
  @chatscope/chat-ui-kit-react@^2 \
  @chatscope/chat-ui-kit-styles@^1 \
  pdf-parse@^1 \
  mammoth@^1
```

Expected: dependencies installed without errors.

- [ ] **Step 2: Install pdf-parse types as a dev dep**

```bash
npm install -D @types/pdf-parse
```

Expected: installs cleanly.

- [ ] **Step 3: Append the 4 new env vars to `prism/.env.local`**

Open `prism/.env.local`. After the existing 4 lines, append:

```
# LLM providers — OpenAI primary (empty for now), Groq fallback (active)
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
GROQ_API_KEY=<paste the gsk_... value from Task 1 Step 4>
GROQ_MODEL=llama-3.3-70b-versatile
```

Substitute the real Groq key in for `<paste …>`.

- [ ] **Step 4: Append same shape to `prism/.env.local.example`** (placeholder values, gets committed when git is initialized later)

Open `prism/.env.local.example`. After the existing 4 lines, append:

```
# LLM providers
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
GROQ_API_KEY=your-groq-key
GROQ_MODEL=llama-3.3-70b-versatile
```

- [ ] **Step 5: Verify**

```bash
npm run typecheck
npm run build
```

Both should exit zero. Build summary should be unchanged from M1.

No commit (git deferred).

---

### Task 3: Add `ProjectMessage` + `ProjectDocument` types

**Files:**
- Modify: `prism/src/types/project.ts`

- [ ] **Step 1: Append new interfaces**

Open `prism/src/types/project.ts`. After the existing `NewProjectInput` interface, append:

```ts
export interface ProjectMessage {
  id: string
  project_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface ProjectDocument {
  id: string
  project_id: string
  filename: string
  file_type: string
  raw_text: string
  created_at: string
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/user/Documents/AI-Projects/prism/prism
npm run typecheck
```

Expected: exit 0.

No commit.

---

### Task 4: `lib/llm/prompts.ts` (constant)

**Files:**
- Create: `prism/src/lib/llm/prompts.ts`

No test file — it's a single exported constant.

- [ ] **Step 1: Create the file**

```ts
export const SYSTEM_PROMPT = `You are a project intelligence assistant inside Prism.
Your job is to help the user define their software project deeply and precisely.

When a user describes their project:
- Ask one clarifying question at a time when something is vague
- Acknowledge what you understood before asking the next question
- Focus on: what the project does, what it doesn't do, technical decisions, constraints, and goals
- Do not ask about team members, deadlines, sprint planning, or delivery dates
- Be concise. Avoid restating what they said back at them
- When the user seems to have shared everything, tell them they can click "Analyse Project" to proceed`
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: exit 0.

No commit.

---

### Task 5: `lib/llm/client.ts` provider factory + tests

**Files:**
- Create: `prism/src/lib/llm/client.ts`
- Create: `prism/src/lib/llm/client.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/llm/client.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

vi.mock('openai', () => {
  return {
    default: vi.fn(function MockOpenAI(opts: any) {
      Object.assign(this, { __opts: opts })
    }),
  }
})

import OpenAI from 'openai'

describe('getLLM', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    vi.mocked(OpenAI).mockClear()
    process.env = { ...originalEnv }
    delete process.env.OPENAI_API_KEY
    delete process.env.GROQ_API_KEY
    delete process.env.OPENAI_MODEL
    delete process.env.GROQ_MODEL
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('throws when neither key is set', async () => {
    const { getLLM } = await import('./client')
    expect(() => getLLM()).toThrow(/No LLM provider configured/)
  })

  it('selects OpenAI when only OPENAI_API_KEY is set', async () => {
    process.env.OPENAI_API_KEY = 'sk-test'
    const { getLLM } = await import('./client')
    const r = getLLM()
    expect(r.provider).toBe('openai')
    expect(r.model).toBe('gpt-4o-mini')
    expect((OpenAI as any).mock.calls[0][0]).toEqual({ apiKey: 'sk-test' })
  })

  it('falls back to Groq when only GROQ_API_KEY is set', async () => {
    process.env.GROQ_API_KEY = 'gsk-test'
    const { getLLM } = await import('./client')
    const r = getLLM()
    expect(r.provider).toBe('groq')
    expect(r.model).toBe('llama-3.3-70b-versatile')
    expect((OpenAI as any).mock.calls[0][0]).toEqual({
      apiKey: 'gsk-test',
      baseURL: 'https://api.groq.com/openai/v1',
    })
  })

  it('prefers OpenAI when both keys are set', async () => {
    process.env.OPENAI_API_KEY = 'sk-test'
    process.env.GROQ_API_KEY = 'gsk-test'
    const { getLLM } = await import('./client')
    expect(getLLM().provider).toBe('openai')
  })

  it('uses OPENAI_MODEL and GROQ_MODEL env overrides', async () => {
    process.env.OPENAI_API_KEY = 'sk-test'
    process.env.OPENAI_MODEL = 'gpt-5-mini'
    const { getLLM: getLLMOpenAI } = await import('./client')
    expect(getLLMOpenAI().model).toBe('gpt-5-mini')

    vi.resetModules()
    delete process.env.OPENAI_API_KEY
    process.env.GROQ_API_KEY = 'gsk-test'
    process.env.GROQ_MODEL = 'llama-3.1-70b-versatile'
    const { getLLM: getLLMGroq } = await import('./client')
    expect(getLLMGroq().model).toBe('llama-3.1-70b-versatile')
  })
})
```

- [ ] **Step 2: Run, expect failure**

```bash
cd /Users/user/Documents/AI-Projects/prism/prism
npx vitest run src/lib/llm/client.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement the factory**

`src/lib/llm/client.ts`:

```ts
import OpenAI from 'openai'

export type LLMProvider = 'openai' | 'groq'

export function getLLM(): { client: OpenAI; model: string; provider: LLMProvider } {
  if (process.env.OPENAI_API_KEY) {
    return {
      client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
      model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      provider: 'openai',
    }
  }
  if (process.env.GROQ_API_KEY) {
    return {
      client: new OpenAI({
        apiKey: process.env.GROQ_API_KEY,
        baseURL: 'https://api.groq.com/openai/v1',
      }),
      model: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
      provider: 'groq',
    }
  }
  throw new Error(
    'No LLM provider configured. Set OPENAI_API_KEY or GROQ_API_KEY in .env.local.'
  )
}
```

- [ ] **Step 4: Run, expect 5/5 pass**

```bash
npx vitest run src/lib/llm/client.test.ts
```

Expected: 5 tests pass.

No commit.

---

### Task 6: `src/test/llm-mock.ts` (mock factory for streaming chat completions)

**Files:**
- Create: `prism/src/test/llm-mock.ts`

No test file — it's a test helper.

- [ ] **Step 1: Create the helper**

`src/test/llm-mock.ts`:

```ts
import { vi } from 'vitest'

type MockLLMOptions = {
  /** Text chunks to stream. Default: ['Hello', ', ', 'world!']. */
  chunks?: string[]
  /** Throw before the iterator starts. */
  failBeforeStream?: boolean
  /** Throw after the Nth chunk has been yielded. */
  failAfterChunk?: number
}

export type MockLLMClient = ReturnType<typeof mockLLMClient>

/**
 * Returns an `openai`-shaped client where `chat.completions.create` returns an
 * async-iterable yielding OpenAI-style chunks: { choices: [{ delta: { content } }] }.
 */
export function mockLLMClient(opts: MockLLMOptions = {}) {
  const chunks = opts.chunks ?? ['Hello', ', ', 'world!']

  const create = vi.fn(async () => {
    if (opts.failBeforeStream) {
      throw new Error('upstream error')
    }
    return {
      [Symbol.asyncIterator]: async function* () {
        let yielded = 0
        for (const text of chunks) {
          if (opts.failAfterChunk !== undefined && yielded >= opts.failAfterChunk) {
            throw new Error('mid-stream error')
          }
          yielded++
          yield { choices: [{ delta: { content: text } }] }
        }
      },
    }
  })

  return {
    chat: {
      completions: { create },
    },
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: exit 0.

No commit.

---

### Task 7: `lib/files/parse.ts` + tests

**Files:**
- Create: `prism/src/lib/files/parse.ts`
- Create: `prism/src/lib/files/parse.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/files/parse.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('pdf-parse', () => ({
  default: vi.fn(async (_buf: Buffer) => ({ text: 'pdf content' })),
}))

vi.mock('mammoth', () => ({
  extractRawText: vi.fn(async ({ buffer: _b }: { buffer: Buffer }) => ({
    value: 'docx content',
    messages: [],
  })),
}))

import { fileTypeFor, parseFile } from './parse'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('fileTypeFor', () => {
  it('detects pdf', () => expect(fileTypeFor('foo.pdf')).toBe('pdf'))
  it('detects docx', () => expect(fileTypeFor('foo.docx')).toBe('docx'))
  it('detects doc as docx', () => expect(fileTypeFor('foo.doc')).toBe('docx'))
  it('detects md', () => expect(fileTypeFor('foo.md')).toBe('md'))
  it('falls back to txt for unknown', () => expect(fileTypeFor('foo')).toBe('txt'))
  it('is case-insensitive', () => expect(fileTypeFor('FOO.PDF')).toBe('pdf'))
})

describe('parseFile', () => {
  it('parses pdf via pdf-parse', async () => {
    const text = await parseFile('a.pdf', Buffer.from('binary'))
    expect(text).toBe('pdf content')
  })

  it('parses docx via mammoth', async () => {
    const text = await parseFile('a.docx', Buffer.from('binary'))
    expect(text).toBe('docx content')
  })

  it('returns plain text for .txt', async () => {
    const text = await parseFile('a.txt', Buffer.from('hello world'))
    expect(text).toBe('hello world')
  })

  it('returns plain text for .md', async () => {
    const text = await parseFile('a.md', Buffer.from('# heading\n\nbody'))
    expect(text).toBe('# heading\n\nbody')
  })

  it('wraps pdf-parse errors with a friendly message', async () => {
    const pdfParse = await import('pdf-parse')
    vi.mocked(pdfParse.default).mockRejectedValueOnce(new Error('corrupt'))
    await expect(parseFile('bad.pdf', Buffer.from('x'))).rejects.toThrow(
      /Failed to parse pdf/
    )
  })

  it('wraps mammoth errors with a friendly message', async () => {
    const mammoth = await import('mammoth')
    vi.mocked(mammoth.extractRawText).mockRejectedValueOnce(new Error('boom'))
    await expect(parseFile('bad.docx', Buffer.from('x'))).rejects.toThrow(
      /Failed to parse docx/
    )
  })
})
```

- [ ] **Step 2: Run, expect failure**

```bash
npx vitest run src/lib/files/parse.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement the parser**

`src/lib/files/parse.ts`:

```ts
export type FileType = 'pdf' | 'docx' | 'md' | 'txt'

export function fileTypeFor(filename: string): FileType {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return 'pdf'
  if (ext === 'docx' || ext === 'doc') return 'docx'
  if (ext === 'md') return 'md'
  return 'txt'
}

export async function parseFile(filename: string, buffer: Buffer): Promise<string> {
  const type = fileTypeFor(filename)
  try {
    if (type === 'pdf') {
      const pdfParse = (await import('pdf-parse')).default
      const result = await pdfParse(buffer)
      return result.text
    }
    if (type === 'docx') {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      return result.value
    }
    // txt or md
    return buffer.toString('utf-8')
  } catch (err) {
    throw new Error(`Failed to parse ${type}: ${(err as Error).message}`)
  }
}
```

- [ ] **Step 4: Run, expect pass**

```bash
npx vitest run src/lib/files/parse.test.ts
```

Expected: 12 tests pass (6 fileTypeFor + 6 parseFile).

No commit.

---

### Task 8: `lib/messages.ts` + tests

**Files:**
- Create: `prism/src/lib/messages.ts`
- Create: `prism/src/lib/messages.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/messages.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mockSupabaseClient, makeChain } from '@/test/supabase-mock'
import type { ProjectMessage } from '@/types/project'

vi.mock('@/lib/supabase/server')

import { createClient } from '@/lib/supabase/server'
import { getProjectMessages } from './messages'

const mocked = vi.mocked(createClient)

beforeEach(() => {
  mocked.mockReset()
})

const sampleMessages: ProjectMessage[] = [
  { id: 'm1', project_id: 'p', role: 'user', content: 'hi', created_at: '2026-05-12T00:00:00Z' },
  { id: 'm2', project_id: 'p', role: 'assistant', content: 'hello', created_at: '2026-05-12T00:00:01Z' },
]

describe('getProjectMessages', () => {
  it('returns rows ordered by created_at asc', async () => {
    const client = mockSupabaseClient({
      user: { id: 'u', email: 'a@b' },
      fromHandlers: {
        project_messages: () => makeChain({ data: sampleMessages, error: null }),
      },
    })
    mocked.mockResolvedValue(client as any)

    const result = await getProjectMessages('p')
    expect(result).toEqual(sampleMessages)
    expect(client.from).toHaveBeenCalledWith('project_messages')
  })

  it('throws when no user', async () => {
    const client = mockSupabaseClient({ user: null })
    mocked.mockResolvedValue(client as any)
    await expect(getProjectMessages('p')).rejects.toThrow(/not authenticated/i)
  })
})
```

- [ ] **Step 2: Run, expect failure**

```bash
npx vitest run src/lib/messages.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

`src/lib/messages.ts`:

```ts
import { createClient } from '@/lib/supabase/server'
import type { ProjectMessage } from '@/types/project'

export async function getProjectMessages(projectId: string): Promise<ProjectMessage[]> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new Error('Not authenticated')
  }
  const { data, error } = await supabase
    .from('project_messages')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as ProjectMessage[]
}
```

- [ ] **Step 4: Run, expect 2/2 pass**

```bash
npx vitest run src/lib/messages.test.ts
```

No commit.

---

### Task 9: `lib/documents.ts` + tests

**Files:**
- Create: `prism/src/lib/documents.ts`
- Create: `prism/src/lib/documents.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/documents.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mockSupabaseClient, makeChain } from '@/test/supabase-mock'
import type { ProjectDocument } from '@/types/project'

vi.mock('@/lib/supabase/server')

import { createClient } from '@/lib/supabase/server'
import { getProjectDocuments } from './documents'

const mocked = vi.mocked(createClient)

beforeEach(() => {
  mocked.mockReset()
})

const sampleDocs: ProjectDocument[] = [
  { id: 'd1', project_id: 'p', filename: 'spec.pdf', file_type: 'pdf', raw_text: 'text', created_at: '2026-05-12T00:00:00Z' },
]

describe('getProjectDocuments', () => {
  it('returns rows ordered by created_at desc', async () => {
    const client = mockSupabaseClient({
      user: { id: 'u', email: 'a@b' },
      fromHandlers: {
        project_documents: () => makeChain({ data: sampleDocs, error: null }),
      },
    })
    mocked.mockResolvedValue(client as any)

    const result = await getProjectDocuments('p')
    expect(result).toEqual(sampleDocs)
    expect(client.from).toHaveBeenCalledWith('project_documents')
  })

  it('throws when no user', async () => {
    const client = mockSupabaseClient({ user: null })
    mocked.mockResolvedValue(client as any)
    await expect(getProjectDocuments('p')).rejects.toThrow(/not authenticated/i)
  })
})
```

- [ ] **Step 2: Run, expect failure**

```bash
npx vitest run src/lib/documents.test.ts
```

- [ ] **Step 3: Implement**

`src/lib/documents.ts`:

```ts
import { createClient } from '@/lib/supabase/server'
import type { ProjectDocument } from '@/types/project'

export async function getProjectDocuments(projectId: string): Promise<ProjectDocument[]> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new Error('Not authenticated')
  }
  const { data, error } = await supabase
    .from('project_documents')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as ProjectDocument[]
}
```

- [ ] **Step 4: Run, expect 2/2 pass**

```bash
npx vitest run src/lib/documents.test.ts
```

No commit.

---

### Task 10: `/api/chat` route + tests

**Files:**
- Create: `prism/src/app/api/chat/route.ts`
- Create: `prism/src/app/api/chat/route.test.ts`

- [ ] **Step 1: Write the failing test**

`src/app/api/chat/route.test.ts`:

```ts
// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mockSupabaseClient, makeChain } from '@/test/supabase-mock'
import { mockLLMClient } from '@/test/llm-mock'

vi.mock('@/lib/supabase/server')
vi.mock('@/lib/llm/client')

import { createClient } from '@/lib/supabase/server'
import { getLLM } from '@/lib/llm/client'
import { POST } from './route'

const mockedSupabase = vi.mocked(createClient)
const mockedGetLLM = vi.mocked(getLLM)

beforeEach(() => {
  mockedSupabase.mockReset()
  mockedGetLLM.mockReset()
})

function reqBody(body: unknown) {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function streamToString(res: Response): Promise<string> {
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let out = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    out += decoder.decode(value)
  }
  return out
}

describe('POST /api/chat', () => {
  it('returns 401 when no user', async () => {
    mockedSupabase.mockResolvedValue(mockSupabaseClient({ user: null }) as any)
    const res = await POST(reqBody({ projectId: 'p', messages: [] }))
    expect(res.status).toBe(401)
  })

  it('returns 404 when project not owned', async () => {
    const projectsChain = makeChain({ data: null, error: null })
    const client = mockSupabaseClient({
      user: { id: 'u', email: 'a@b' },
      fromHandlers: { projects: () => projectsChain },
    })
    mockedSupabase.mockResolvedValue(client as any)

    const res = await POST(reqBody({ projectId: 'p', messages: [{ role: 'user', content: 'hi' }] }))
    expect(res.status).toBe(404)
  })

  it('returns 400 when body is malformed', async () => {
    const client = mockSupabaseClient({ user: { id: 'u', email: 'a@b' } })
    mockedSupabase.mockResolvedValue(client as any)
    const res = await POST(reqBody({ projectId: 'p' })) // missing messages
    expect(res.status).toBe(400)
  })

  it('saves user message, streams response, saves assistant message', async () => {
    const projectsChain = makeChain({ data: { id: 'p' }, error: null })
    const messagesChain = makeChain({ data: { id: 'msg' }, error: null })
    const client = mockSupabaseClient({
      user: { id: 'u', email: 'a@b' },
      fromHandlers: {
        projects: () => projectsChain,
        project_messages: () => messagesChain,
      },
    })
    mockedSupabase.mockResolvedValue(client as any)
    mockedGetLLM.mockReturnValue({
      client: mockLLMClient({ chunks: ['Hi', ' there'] }) as any,
      model: 'test-model',
      provider: 'groq',
    })

    const res = await POST(reqBody({ projectId: 'p', messages: [{ role: 'user', content: 'hello' }] }))
    expect(res.status).toBe(200)

    const text = await streamToString(res)
    expect(text).toBe('Hi there')

    // user msg insert happened before streaming
    expect(messagesChain.insert).toHaveBeenNthCalledWith(1, {
      project_id: 'p',
      role: 'user',
      content: 'hello',
    })
    // assistant insert after stream done
    expect(messagesChain.insert).toHaveBeenNthCalledWith(2, {
      project_id: 'p',
      role: 'assistant',
      content: 'Hi there',
    })
  })

  it('streams a sentinel and does not persist on mid-stream error', async () => {
    const projectsChain = makeChain({ data: { id: 'p' }, error: null })
    const messagesChain = makeChain({ data: { id: 'msg' }, error: null })
    const client = mockSupabaseClient({
      user: { id: 'u', email: 'a@b' },
      fromHandlers: {
        projects: () => projectsChain,
        project_messages: () => messagesChain,
      },
    })
    mockedSupabase.mockResolvedValue(client as any)
    mockedGetLLM.mockReturnValue({
      client: mockLLMClient({ chunks: ['Partial'], failAfterChunk: 1 }) as any,
      model: 'test-model',
      provider: 'groq',
    })

    const res = await POST(reqBody({ projectId: 'p', messages: [{ role: 'user', content: 'hi' }] }))
    const text = await streamToString(res)
    expect(text).toMatch(/Partial.*\[Connection lost\. Try again\.\]/s)
    // Only the user message persisted (one call to insert)
    expect(messagesChain.insert).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run, expect failure**

```bash
npx vitest run src/app/api/chat/route.test.ts
```

- [ ] **Step 3: Implement the route**

`src/app/api/chat/route.ts`:

```ts
import { createClient } from '@/lib/supabase/server'
import { getLLM } from '@/lib/llm/client'
import { SYSTEM_PROMPT } from '@/lib/llm/prompts'

type IncomingMessage = { role: 'user' | 'assistant'; content: string }

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  let body: { projectId?: string; messages?: IncomingMessage[] }
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }
  const { projectId, messages } = body
  if (!projectId || !Array.isArray(messages)) {
    return new Response('Missing projectId or messages', { status: 400 })
  }

  // Verify project belongs to user via RLS-scoped select
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .maybeSingle()
  if (!project) return new Response('Project not found', { status: 404 })

  // Save the latest user message
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')
  if (lastUser) {
    await supabase.from('project_messages').insert({
      project_id: projectId,
      role: 'user',
      content: lastUser.content,
    })
  }

  let llm
  try {
    llm = getLLM()
  } catch (err) {
    return new Response((err as Error).message, { status: 500 })
  }

  let stream
  try {
    stream = await llm.client.chat.completions.create({
      model: llm.model,
      stream: true,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    } as any)
  } catch (err) {
    return new Response("Couldn't reach the assistant. Try again.", { status: 502 })
  }

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      let full = ''
      try {
        for await (const chunk of stream as AsyncIterable<{
          choices: Array<{ delta: { content?: string | null } }>
        }>) {
          const text = chunk.choices[0]?.delta?.content ?? ''
          if (text) {
            full += text
            controller.enqueue(encoder.encode(text))
          }
        }
        await supabase.from('project_messages').insert({
          project_id: projectId,
          role: 'assistant',
          content: full,
        })
      } catch {
        controller.enqueue(encoder.encode('\n\n[Connection lost. Try again.]'))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
```

- [ ] **Step 4: Run, expect 5/5 pass**

```bash
npx vitest run src/app/api/chat/route.test.ts
```

No commit.

---

### Task 11: `/api/upload` route + tests

**Files:**
- Create: `prism/src/app/api/upload/route.ts`
- Create: `prism/src/app/api/upload/route.test.ts`

- [ ] **Step 1: Write the failing test**

`src/app/api/upload/route.test.ts`:

```ts
// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mockSupabaseClient, makeChain } from '@/test/supabase-mock'

vi.mock('@/lib/supabase/server')
vi.mock('@/lib/files/parse', () => ({
  fileTypeFor: vi.fn((name: string) => {
    const ext = name.split('.').pop()?.toLowerCase()
    if (ext === 'pdf') return 'pdf'
    if (ext === 'docx' || ext === 'doc') return 'docx'
    if (ext === 'md') return 'md'
    return 'txt'
  }),
  parseFile: vi.fn(async (_name: string, buf: Buffer) => buf.toString('utf-8')),
}))

import { createClient } from '@/lib/supabase/server'
import { parseFile } from '@/lib/files/parse'
import { POST } from './route'

const mockedSupabase = vi.mocked(createClient)
const mockedParse = vi.mocked(parseFile)

beforeEach(() => {
  mockedSupabase.mockReset()
  mockedParse.mockClear()
})

function makeFormDataRequest(opts: {
  file?: File | null
  projectId?: string | null
}) {
  const fd = new FormData()
  if (opts.file) fd.append('file', opts.file)
  if (opts.projectId) fd.append('projectId', opts.projectId)
  return new Request('http://localhost/api/upload', { method: 'POST', body: fd })
}

describe('POST /api/upload', () => {
  it('returns 401 when no user', async () => {
    mockedSupabase.mockResolvedValue(mockSupabaseClient({ user: null }) as any)
    const file = new File(['hi'], 'a.txt', { type: 'text/plain' })
    const res = await POST(makeFormDataRequest({ file, projectId: 'p' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when file or projectId is missing', async () => {
    const client = mockSupabaseClient({ user: { id: 'u', email: 'a@b' } })
    mockedSupabase.mockResolvedValue(client as any)
    const res = await POST(makeFormDataRequest({ projectId: 'p' }))
    expect(res.status).toBe(400)
  })

  it('returns 413 when file is larger than 10 MB', async () => {
    const client = mockSupabaseClient({ user: { id: 'u', email: 'a@b' } })
    mockedSupabase.mockResolvedValue(client as any)
    const tooBig = new File([new Uint8Array(11 * 1024 * 1024)], 'big.txt', { type: 'text/plain' })
    const res = await POST(makeFormDataRequest({ file: tooBig, projectId: 'p' }))
    expect(res.status).toBe(413)
  })

  it('returns 415 for unsupported extensions', async () => {
    const client = mockSupabaseClient({ user: { id: 'u', email: 'a@b' } })
    mockedSupabase.mockResolvedValue(client as any)
    const file = new File(['x'], 'image.png', { type: 'image/png' })
    const res = await POST(makeFormDataRequest({ file, projectId: 'p' }))
    expect(res.status).toBe(415)
  })

  it('returns 422 when parsing fails', async () => {
    const projectsChain = makeChain({ data: { id: 'p' }, error: null })
    const client = mockSupabaseClient({
      user: { id: 'u', email: 'a@b' },
      fromHandlers: { projects: () => projectsChain },
    })
    mockedSupabase.mockResolvedValue(client as any)
    mockedParse.mockRejectedValueOnce(new Error('corrupt'))

    const file = new File(['x'], 'bad.pdf', { type: 'application/pdf' })
    const res = await POST(makeFormDataRequest({ file, projectId: 'p' }))
    expect(res.status).toBe(422)
  })

  it('happy path: returns document + 200-char preview', async () => {
    const projectsChain = makeChain({ data: { id: 'p' }, error: null })
    const insertChain = makeChain({
      data: { id: 'd1', project_id: 'p', filename: 'a.txt', file_type: 'txt', raw_text: 'hello world' },
      error: null,
    })
    const client = mockSupabaseClient({
      user: { id: 'u', email: 'a@b' },
      fromHandlers: {
        projects: () => projectsChain,
        project_documents: () => insertChain,
      },
    })
    mockedSupabase.mockResolvedValue(client as any)

    const file = new File(['hello world'], 'a.txt', { type: 'text/plain' })
    const res = await POST(makeFormDataRequest({ file, projectId: 'p' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.document.id).toBe('d1')
    expect(body.preview).toBe('hello world')
  })
})
```

- [ ] **Step 2: Run, expect failure**

```bash
npx vitest run src/app/api/upload/route.test.ts
```

- [ ] **Step 3: Implement the route**

`src/app/api/upload/route.ts`:

```ts
import { createClient } from '@/lib/supabase/server'
import { fileTypeFor, parseFile } from '@/lib/files/parse'

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB
const MAX_CHARS = 200_000

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const projectId = formData.get('projectId') as string | null

  if (!file || !projectId) {
    return Response.json({ error: 'Missing file or projectId' }, { status: 400 })
  }

  if (file.size > MAX_BYTES) {
    return Response.json({ error: 'File too large (max 10 MB)' }, { status: 413 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase()
  const allowed = ['pdf', 'docx', 'doc', 'txt', 'md']
  if (!ext || !allowed.includes(ext)) {
    return Response.json({ error: 'Unsupported file type' }, { status: 415 })
  }

  // Verify project belongs to user
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .maybeSingle()
  if (!project) return Response.json({ error: 'Project not found' }, { status: 404 })

  const buffer = Buffer.from(await file.arrayBuffer())

  let rawText: string
  try {
    rawText = await parseFile(file.name, buffer)
  } catch (err) {
    return Response.json({ error: "Couldn't parse the file" }, { status: 422 })
  }

  if (rawText.length > MAX_CHARS) {
    rawText = rawText.slice(0, MAX_CHARS)
  }

  const fileType = fileTypeFor(file.name)
  const { data, error } = await supabase
    .from('project_documents')
    .insert({
      project_id: projectId,
      filename: file.name,
      file_type: fileType,
      raw_text: rawText,
    })
    .select()
    .single()

  if (error || !data) {
    return Response.json({ error: 'Failed to save document' }, { status: 500 })
  }

  return Response.json({ document: data, preview: rawText.slice(0, 200) })
}
```

- [ ] **Step 4: Run, expect 6/6 pass**

```bash
npx vitest run src/app/api/upload/route.test.ts
```

No commit.

---

### Task 12: `ProjectHeader` component + tests

**Files:**
- Create: `prism/src/components/chat/ProjectHeader.tsx`
- Create: `prism/src/components/chat/ProjectHeader.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/components/chat/ProjectHeader.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@/test/render'
import { ProjectHeader } from './ProjectHeader'
import { makeProject } from '@/test/factories'

describe('ProjectHeader', () => {
  it('renders the project name and status badge', () => {
    const p = makeProject({ id: 'p1', name: 'Inventory dashboard', status: 'drafting' })
    render(<ProjectHeader project={p} />)
    expect(screen.getByRole('heading', { name: /inventory dashboard/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/status: drafting/i)).toBeInTheDocument()
  })

  it('renders the "Analyse Project" link pointing to /qa', () => {
    const p = makeProject({ id: 'p1', name: 'X' })
    render(<ProjectHeader project={p} />)
    const link = screen.getByRole('link', { name: /analyse project/i })
    expect(link).toHaveAttribute('href', '/project/p1/qa')
  })
})
```

- [ ] **Step 2: Run, expect failure**

```bash
npx vitest run src/components/chat/ProjectHeader.test.tsx
```

- [ ] **Step 3: Implement**

`src/components/chat/ProjectHeader.tsx`:

```tsx
import Link from 'next/link'
import { StatusDot } from '@/components/ui/StatusDot'
import type { Project } from '@/types/project'

export function ProjectHeader({ project }: { project: Project }) {
  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-surface-1">
      <div className="flex items-center gap-3 min-w-0">
        <h1 className="text-sm font-semibold text-text-0 truncate">{project.name}</h1>
        <div className="flex items-center gap-1.5 text-xs text-text-2">
          <StatusDot status={project.status} />
          <span className="capitalize">{project.status}</span>
        </div>
      </div>
      <Link
        href={`/project/${project.id}/qa`}
        className="inline-flex items-center gap-1.5 bg-primary text-primary-fg px-3 py-1.5 rounded-md text-xs font-semibold shadow-sm shadow-inset-pri"
      >
        Analyse Project →
      </Link>
    </header>
  )
}
```

- [ ] **Step 4: Run, expect 2/2 pass**

```bash
npx vitest run src/components/chat/ProjectHeader.test.tsx
```

No commit.

---

### Task 13: Add Chatscope CSS overrides to `globals.css`

**Files:**
- Modify: `prism/src/app/globals.css`

- [ ] **Step 1: Append theme overrides**

Open `prism/src/app/globals.css`. After the closing `}` of the `input:focus-visible` rule (the last block), append:

```css
/* Chatscope theme — match the monochrome system. */
:root {
  --cs-bg-message-incoming: #1a1a1a;
  --cs-bg-message-outgoing: #ffffff;
  --cs-color-message-outgoing: #0a0a0a;
  --cs-color-message-incoming: #ffffff;
  --cs-bg-input: #111111;
  --cs-color-input: #ffffff;
  --cs-bg-input-disabled: #0a0a0a;
  --cs-border-color: #232323;
}
.cs-message-input__content-editor-wrapper,
.cs-message-input__content-editor {
  background: var(--cs-bg-input) !important;
  color: var(--cs-color-input) !important;
}
.cs-main-container,
.cs-chat-container {
  background: var(--bg) !important;
  border-color: var(--cs-border-color) !important;
}
.cs-message-list {
  background: var(--bg) !important;
}
.cs-message__content {
  border-radius: 10px !important;
}
.cs-typing-indicator {
  background: transparent !important;
  color: var(--color-text-2) !important;
}
```

- [ ] **Step 2: Build to confirm no CSS errors**

```bash
cd /Users/user/Documents/AI-Projects/prism/prism
npm run build
```

Expected: clean build.

No commit.

---

### Task 14: `ChatWindow` component + tests

**Files:**
- Create: `prism/src/components/chat/ChatWindow.tsx`
- Create: `prism/src/components/chat/ChatWindow.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/components/chat/ChatWindow.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, userEvent, waitFor } from '@/test/render'
import { ChatWindow } from './ChatWindow'
import type { ProjectMessage } from '@/types/project'

function makeStreamResponse(chunks: string[]): Response {
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      for (const c of chunks) {
        controller.enqueue(enc.encode(c))
        await new Promise((r) => setTimeout(r, 0))
      }
      controller.close()
    },
  })
  return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/plain' } })
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('ChatWindow', () => {
  it('shows the welcome message when no initialMessages', () => {
    render(<ChatWindow projectId="p1" initialMessages={[]} />)
    expect(screen.getByText(/what project do you want to plan/i)).toBeInTheDocument()
  })

  it('shows initialMessages when provided', () => {
    const msgs: ProjectMessage[] = [
      { id: 'm1', project_id: 'p1', role: 'user', content: 'Existing question', created_at: '2026-05-12T00:00:00Z' },
    ]
    render(<ChatWindow projectId="p1" initialMessages={msgs} />)
    expect(screen.getByText(/existing question/i)).toBeInTheDocument()
  })

  it('sends a message and renders streamed chunks', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      makeStreamResponse(['Hi', ' there'])
    )
    render(<ChatWindow projectId="p1" initialMessages={[]} />)

    const input = screen.getByRole('textbox')
    await userEvent.type(input, 'Hello')
    await userEvent.keyboard('{Enter}')

    await waitFor(() => {
      expect(screen.getByText(/^Hello$/)).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(screen.getByText(/Hi there/i)).toBeInTheDocument()
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/chat',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('shows inline error on fetch failure', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'oops' }), { status: 500 })
    )
    render(<ChatWindow projectId="p1" initialMessages={[]} />)

    await userEvent.type(screen.getByRole('textbox'), 'X')
    await userEvent.keyboard('{Enter}')

    await waitFor(() => {
      expect(screen.getByText(/couldn't reach the assistant|connection lost|\[/i)).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Run, expect failure**

```bash
npx vitest run src/components/chat/ChatWindow.test.tsx
```

- [ ] **Step 3: Implement**

`src/components/chat/ChatWindow.tsx`:

```tsx
'use client'
import '@chatscope/chat-ui-kit-styles/dist/default/styles.min.css'

import {
  MainContainer,
  ChatContainer,
  MessageList,
  Message,
  MessageInput,
  TypingIndicator,
} from '@chatscope/chat-ui-kit-react'
import { useRef, useState } from 'react'
import type { ProjectMessage } from '@/types/project'

interface ChatWindowProps {
  projectId: string
  initialMessages: ProjectMessage[]
}

function makeWelcome(projectId: string): ProjectMessage {
  return {
    id: 'welcome',
    project_id: projectId,
    role: 'assistant',
    content:
      'What project do you want to plan? Tell me everything — what it does, what problem it solves, any tech ideas you have. You can also attach documents.',
    created_at: new Date().toISOString(),
  }
}

export function ChatWindow({ projectId, initialMessages }: ChatWindowProps) {
  const [messages, setMessages] = useState<ProjectMessage[]>(
    initialMessages.length > 0 ? initialMessages : [makeWelcome(projectId)]
  )
  const [typing, setTyping] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const idCounter = useRef(0)
  const nextId = () => `local-${++idCounter.current}`

  async function sendMessage(text: string) {
    if (!text.trim()) return
    const userMsg: ProjectMessage = {
      id: nextId(),
      project_id: projectId,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    }
    const assistantMsg: ProjectMessage = {
      id: nextId(),
      project_id: projectId,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
    }
    const baseline = [...messages, userMsg]
    setMessages([...baseline, assistantMsg])
    setTyping(true)

    const abort = new AbortController()
    const timeoutId = setTimeout(() => abort.abort(), 60_000)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        signal: abort.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          messages: baseline.map((m) => ({ role: m.role, content: m.content })),
        }),
      })

      if (!res.ok) {
        const errText = await res
          .json()
          .then((j) => j?.error ?? 'Couldn’t reach the assistant. Try again.')
          .catch(() => 'Couldn’t reach the assistant. Try again.')
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: `[${errText}]` } : m))
        )
        return
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let full = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += decoder.decode(value)
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: full } : m))
        )
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: '[Connection lost. Try again.]' }
            : m
        )
      )
    } finally {
      clearTimeout(timeoutId)
      setTyping(false)
    }
  }

  async function handleFileUpload(file: File) {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('projectId', projectId)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        const reason = body?.error ?? 'Upload failed'
        const errMsg: ProjectMessage = {
          id: nextId(),
          project_id: projectId,
          role: 'assistant',
          content: `[Couldn't upload ${file.name}: ${reason}]`,
          created_at: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, errMsg])
        return
      }
      await sendMessage(
        `[Uploaded: ${file.name}]\n\nDocument content preview: ${body.preview}...`
      )
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <MainContainer style={{ flex: 1, border: 'none' }}>
        <ChatContainer>
          <MessageList
            typingIndicator={typing ? <TypingIndicator content="Thinking..." /> : null}
          >
            {messages.map((m) => (
              <Message
                key={m.id}
                model={{
                  message: m.content,
                  direction: m.role === 'user' ? 'outgoing' : 'incoming',
                  position: 'normal',
                }}
              />
            ))}
          </MessageList>
          <MessageInput
            placeholder="Describe your project..."
            onSend={sendMessage}
            attachButton={true}
            onAttachClick={() => fileInputRef.current?.click()}
            disabled={typing || uploading}
          />
        </ChatContainer>
      </MainContainer>

      <input
        ref={fileInputRef}
        type="file"
        hidden
        accept=".pdf,.docx,.doc,.txt,.md"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFileUpload(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}
```

- [ ] **Step 4: Run, expect 4/4 pass**

```bash
npx vitest run src/components/chat/ChatWindow.test.tsx
```

No commit.

---

### Task 15: Replace `/project/[id]/page.tsx` + create `/qa` stub

**Files:**
- Modify: `prism/src/app/(app)/project/[id]/page.tsx` (replace M1 stub)
- Create: `prism/src/app/(app)/project/[id]/qa/page.tsx`

- [ ] **Step 1: Replace `src/app/(app)/project/[id]/page.tsx`**

Overwrite the file with:

```tsx
import Link from 'next/link'
import { getProjectById } from '@/lib/projects'
import { getProjectMessages } from '@/lib/messages'
import { ProjectHeader } from '@/components/chat/ProjectHeader'
import { ChatWindow } from '@/components/chat/ChatWindow'

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const project = await getProjectById(id)

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-full p-6 text-center">
        <div>
          <h2 className="text-base font-semibold text-text-0">Project not found</h2>
          <p className="text-xs text-text-2 mt-1.5">
            We couldn't find that project, or you don't have access.
          </p>
          <Link
            href="/dashboard"
            className="inline-block mt-4 text-sm text-text-0 underline underline-offset-2"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    )
  }

  const messages = await getProjectMessages(id)

  return (
    <div className="flex flex-col h-full">
      <ProjectHeader project={project} />
      <div className="flex-1 overflow-hidden">
        <ChatWindow projectId={id} initialMessages={messages} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `/project/[id]/qa` stub**

`src/app/(app)/project/[id]/qa/page.tsx`:

```tsx
import Link from 'next/link'

export default async function QaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <div className="flex items-center justify-center min-h-full p-8 text-center">
      <div>
        <h1 className="text-xl font-semibold text-text-0 tracking-tight">
          Q&amp;A wizard
        </h1>
        <p className="mt-2 text-sm text-text-2 max-w-md mx-auto">
          Coming in M3. Your chat history and uploaded documents are saved and will feed
          the analysis once we wire it up.
        </p>
        <Link
          href={`/project/${id}`}
          className="inline-block mt-6 text-sm text-text-0 underline underline-offset-2"
        >
          ← Back to chat
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Build + typecheck**

```bash
cd /Users/user/Documents/AI-Projects/prism/prism
npm run typecheck
npm run build
```

Expected: clean build with 9 routes (the new `/project/[id]/qa` listed alongside the existing 7).

- [ ] **Step 4: Manual smoke**

```bash
npm run dev
```

Open http://localhost:3000 in a browser:
1. Sign in with the M1 account
2. Pick or create a project
3. Confirm the chat page now shows: header with project name + status + "Analyse Project →", and the welcome message in the chat area
4. Send "Hello" and confirm a streamed Groq response appears
5. Click the paperclip → upload a small .txt file → confirm the "[Uploaded: …]" message appears
6. Click "Analyse Project →" → confirm the M3 stub page renders
7. Ctrl-C to stop the dev server

No commit.

---

### Task 16: E2E spec for chat flow + `sample.txt` fixture

**Files:**
- Create: `prism/src/test/fixtures/sample.txt`
- Create: `prism/tests/e2e/chat.spec.ts`

- [ ] **Step 1: Create the fixture**

`src/test/fixtures/sample.txt`:

```
Prism Test Document

This is a sample text file used by the E2E test for file uploads.
It contains a few sentences so the parsed preview has some content.
```

- [ ] **Step 2: Write the E2E spec**

`tests/e2e/chat.spec.ts`:

```ts
import path from 'path'
import { test, expect, signUpInUI } from './helpers'

test('full chat flow: signup → message → upload → analyse stub', async ({ page, testUser }) => {
  await signUpInUI(page, testUser)

  // Create a project from the welcome screen
  await page.getByRole('button', { name: /create your first project/i }).click()
  await page.getByLabel(/project name/i).fill('E2E chat project')
  await page.getByRole('button', { name: /create & start/i }).click()
  await page.waitForURL(/\/project\/[^/]+$/)

  // Header is visible
  await expect(page.getByRole('heading', { name: 'E2E chat project' })).toBeVisible()
  await expect(page.getByRole('link', { name: /analyse project/i })).toBeVisible()

  // Welcome message
  await expect(page.getByText(/what project do you want to plan/i)).toBeVisible()

  // Send a message
  await page.getByPlaceholder(/describe your project/i).fill('We are building a CRM tool.')
  await page.keyboard.press('Enter')

  // Wait for assistant response to appear (give Groq up to 30s)
  const messageList = page.locator('.cs-message-list')
  await expect(messageList).toContainText(/CRM/i, { timeout: 30_000 })

  // The conversation must have at least 2 user + assistant messages now
  // (the welcome + our user message + assistant reply = 3 total)
  await expect(messageList.locator('.cs-message')).toHaveCount(3, { timeout: 30_000 })

  // Reload — messages should persist
  await page.reload()
  await expect(messageList).toContainText(/CRM/i)

  // Upload a small text file
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles(
    path.resolve(__dirname, '..', '..', 'src', 'test', 'fixtures', 'sample.txt')
  )
  await expect(messageList).toContainText(/\[Uploaded: sample\.txt\]/i, { timeout: 30_000 })

  // Click "Analyse Project" → stub page
  await page.getByRole('link', { name: /analyse project/i }).click()
  await page.waitForURL(/\/project\/[^/]+\/qa$/)
  await expect(page.getByRole('heading', { name: /q&a wizard/i })).toBeVisible()
})
```

- [ ] **Step 3: Run, expect pass**

```bash
cd /Users/user/Documents/AI-Projects/prism/prism
npm run test:e2e -- chat
```

Expected: 1 test passes in ~30–60 seconds (depends on Groq response time). If Groq returns very quickly, the entire flow finishes in under 30s.

If the test fails because the Groq free-tier rate limit was hit, wait 60s and re-run.

No commit.

---

### Task 17: Extend `tests/e2e/a11y.spec.ts` with `/project/[id]` audit

**Files:**
- Modify: `prism/tests/e2e/a11y.spec.ts`

- [ ] **Step 1: Add one new test inside the existing describe block**

Open `prism/tests/e2e/a11y.spec.ts`. Inside the `test.describe('Accessibility — no serious/critical violations', () => { ... })`, add a 5th test at the end (after the existing `/project/[id]` test, which only renders an empty project page — replace that one with the seeded version):

Look for the existing test:

```ts
  test('/project/[id]', async ({ page, testUser }) => {
    await signUpInUI(page, testUser)
    await page.getByRole('button', { name: /create your first project/i }).click()
    await page.getByLabel(/project name/i).fill('A11y project')
    await page.getByRole('button', { name: /create & start/i }).click()
    await page.waitForURL(/\/project\//)
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })
```

Replace it with this version that also waits for the chat UI to be rendered and seeds a message:

```ts
  test('/project/[id] (with chat)', async ({ page, testUser }) => {
    await signUpInUI(page, testUser)
    await page.getByRole('button', { name: /create your first project/i }).click()
    await page.getByLabel(/project name/i).fill('A11y project')
    await page.getByRole('button', { name: /create & start/i }).click()
    await page.waitForURL(/\/project\/[^/]+$/)
    // Wait for the chat shell to render (header + welcome)
    await page.getByRole('heading', { name: 'A11y project' }).waitFor()
    await page.getByText(/what project do you want to plan/i).waitFor()
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })
```

- [ ] **Step 2: Run the a11y audit**

```bash
npm run test:e2e -- a11y
```

Expected: 4 tests pass (/login, /signup, /dashboard, /project/[id] with chat).

If Chatscope's CSS introduces serious/critical violations, fix them with targeted CSS overrides in `globals.css`. Don't suppress the rule globally.

No commit.

---

### Task 18: Update `Docs/02-tech-stack.md`

**Files:**
- Modify: `Docs/02-tech-stack.md` (at the repo root, NOT inside `prism/`)

The doc currently lists Anthropic + `claude-sonnet-4-6`. M2 uses OpenAI primary + Groq fallback. Update both the overview table and the rationale.

- [ ] **Step 1: Replace the AI line in the overview**

Find:

```
AI           Anthropic Claude API (claude-sonnet-4-6)
```

Replace with:

```
AI           OpenAI primary (gpt-4o-mini) / Groq fallback (llama-3.3-70b-versatile) — both via openai SDK
```

- [ ] **Step 2: Replace the "AI" install block**

Find:

```
### AI
```bash
npm install @anthropic-ai/sdk
```
```

Replace with:

```
### AI
```bash
npm install openai
```
The `openai` SDK is OpenAI-compatible at the wire level — pointing its `baseURL` at `https://api.groq.com/openai/v1` makes Groq accept the exact same requests. No Anthropic SDK is used in M2.
```

- [ ] **Step 3: Replace the "Claude API (Sonnet)" rationale paragraph**

Find:

```
### Claude API (Sonnet)
Used for all three AI tasks:
- Parsing pipeline (entity extraction, conflict detection)
- Q&A question generation
- Final spec compilation

Use `claude-sonnet-4-6` (Sonnet 4.6) for all calls. Structured JSON output via system prompts.
```

Replace with:

```
### OpenAI + Groq (multi-provider via `openai` SDK)
Used for all LLM tasks:
- M2: streaming chat in `/api/chat`
- M3 (planned): parsing pipeline
- M4 (planned): Q&A question generation
- M5 (planned): final spec compilation

Selection happens server-side in `src/lib/llm/client.ts`:
- If `OPENAI_API_KEY` is set → OpenAI client, default model `gpt-4o-mini` (override via `OPENAI_MODEL`)
- Else if `GROQ_API_KEY` is set → OpenAI client with `baseURL: 'https://api.groq.com/openai/v1'`, default model `llama-3.3-70b-versatile` (override via `GROQ_MODEL`)
- Else → 500 `"No LLM provider configured"`

Both providers speak the OpenAI Chat Completions API, so the same streaming code (`client.chat.completions.create({ stream: true, ... })`) covers both. M3+ will use structured-JSON outputs via system prompts; both providers support JSON-mode output.
```

- [ ] **Step 4: Update the env vars block**

Find:

```
# Anthropic
ANTHROPIC_API_KEY=your_anthropic_key
```

Replace with:

```
# LLM providers (OpenAI primary, Groq fallback)
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
GROQ_API_KEY=your_groq_key
GROQ_MODEL=llama-3.3-70b-versatile
```

- [ ] **Step 5: Verify**

```bash
grep -n 'Anthropic\|@anthropic-ai\|claude-sonnet' Docs/02-tech-stack.md
```

Expected: no matches (or only matches inside historical comments that you intentionally kept). If matches remain in the file body, fix them.

No commit.

---

### Task 19: Update `CLAUDE.md` to reflect M2 ship

**Files:**
- Modify: `CLAUDE.md` (at the repo root)

- [ ] **Step 1: Open `CLAUDE.md` and replace the "Repository State" section**

Find the section starting with `## Repository State` and replace its body (up to the next `##` heading) with:

```markdown
## Repository State

The product name is **Prism**. **M1 (Auth + Dashboard) and M2 (Chat Intake) are implemented and passing all tests** under `prism/`. The `Docs/` folder remains the planning source; `prism/` contains the actual Next.js codebase. Milestones M3–M5 are still spec-only and will be designed/planned/implemented one at a time.

For active design work, see `docs/superpowers/specs/` and `docs/superpowers/plans/`.

**Working in the codebase:** the Next.js app lives at `prism/`. From the repo root, `cd prism` first before running `npm` commands. Standard scripts: `npm run dev`, `npm run build`, `npm run lint`, `npm run typecheck`, `npm test` (Vitest unit/component), `npm run test:e2e` (Playwright against real dev Supabase + Groq).

**Stack realities (different from the original `Docs/02`):**
- **Next.js 16** (not 14) — `create-next-app@latest` ships 16; the docs/spec `Docs/02-tech-stack.md` still says 14 but the async-cookies and async-params patterns we use require ≥15. M3+ should treat 16 as the target.
- **Tailwind v4** (not v3) — no `tailwind.config.ts`; tokens live in `prism/src/app/globals.css` inside `@theme {}`. Tailwind utilities auto-generate from `--color-X` and `--shadow-X` names.
- **`proxy.ts`, not `middleware.ts`** — Next 16 renamed the convention. The file at `prism/src/proxy.ts` exports `async function proxy(request: NextRequest)`. Behavior is identical to old middleware.
- **OpenAI primary + Groq fallback** (not Anthropic) — `src/lib/llm/client.ts` returns an `openai` SDK client pointed at OpenAI (if `OPENAI_API_KEY` set) or Groq (`https://api.groq.com/openai/v1`). Default models: `gpt-4o-mini` / `llama-3.3-70b-versatile`. `Docs/02` reflects this.
- **No git yet** — repo is intentionally not a git repo (user deferred init). Most plan tasks skipped their commit step.
```

- [ ] **Step 2: Verify the rest of the file is unchanged**

The "What Prism Is", "Tech Stack (when implementing)", "Architecture: Non-Obvious Pieces", "Hard Rules from the Docs", and "Working with the Docs Themselves" sections should remain. Do not edit them.

No commit.

---

### Task 20: Final verification

This task runs the entire verification sweep before declaring M2 complete.

- [ ] **Step 1: Lint, typecheck, build**

```bash
cd /Users/user/Documents/AI-Projects/prism/prism
npm run lint
npm run typecheck
npm run build
```

Expected: all clean. Build summary should show 9 routes: `/`, `/_not-found`, `/auth/callback`, `/dashboard`, `/login`, `/project/[id]`, `/project/[id]/qa`, `/signup`, plus the two new API routes `/api/chat` and `/api/upload`.

- [ ] **Step 2: Unit + component tests**

```bash
npm test
```

Expected: all green. Counts (combined with M1): roughly 65 (M1) + 26 (M2 unit/component) = **~91 tests passing**.

Actual M2 additions to count: 5 (client) + 12 (parse) + 2 (messages) + 2 (documents) + 5 (chat route) + 6 (upload route) + 2 (ProjectHeader) + 4 (ChatWindow) = **38 new tests**. Total after M2: ~103.

- [ ] **Step 3: E2E**

```bash
npm run test:e2e
```

Expected: all green. M1 had 12 (4 a11y + 8 functional). M2 adds 1 chat spec + replaces the a11y `/project/[id]` test (no net change in a11y count) = **13 specs total**.

- [ ] **Step 4: Done-criteria checklist**

Walk this list manually against the running dev server (`npm run dev`):

- [ ] `npm run dev` boots cleanly with no warnings
- [ ] All four test commands above exit zero
- [ ] Existing M1 user can sign in → see EmptyState → click an existing project → land on the **new chat page** with header + welcome
- [ ] Sending a message produces a streamed reply from Groq
- [ ] Reloading the project page shows persisted messages
- [ ] Uploading `sample.txt` produces an `[Uploaded: sample.txt]` message in chat
- [ ] Clicking "Analyse Project →" navigates to `/project/[id]/qa` stub
- [ ] Unauth visit to `/project/[id]` redirects to `/login` (proxy.ts still guards)
- [ ] axe-core reports no serious/critical violations on `/login`, `/signup`, `/dashboard`, `/project/[id]` (with chat)

- [ ] **Step 5: Mark M2 shipped**

Print a summary to the user listing:
- Plan tasks completed (1–20)
- New tests count (~38)
- Routes added (`/api/chat`, `/api/upload`, `/project/[id]/qa`)
- Files modified (`Docs/02-tech-stack.md`, `CLAUDE.md`, `prism/src/app/(app)/project/[id]/page.tsx`, `prism/src/app/globals.css`)
- Any deferred items (per-user rate limiting, image uploads, "stop generating" button, etc.)

No commit (git deferred). Done.

---

## Self-Review

I checked the plan against the spec section by section.

**Spec coverage:**
- §2 Decisions: every one mapped to a task. Provider abstraction → Task 5; models default + env override → Task 5 + Task 2 (.env.local); Chatscope as-is → Task 14; system prompt → Task 4; 10 MB cap → Task 11; 200 K char truncation → Task 11; 200-char preview → Task 11; welcome message virtual-only → Task 14.
- §3 Architecture & routing: `/api/chat` → Task 10; `/api/upload` → Task 11; `/project/[id]` replace → Task 15; `/qa` stub → Task 15; schema → Task 1; env additions → Task 2; provider factory → Task 5.
- §4 File layout: every file in the spec's table has a task that creates it.
- §5 System prompt: exact constant in Task 4.
- §6 Data flow: streaming chat fully implemented in Task 10 (incl. mid-stream sentinel). File upload pipeline in Task 11. Welcome injection + abort controller in Task 14.
- §7 Errors: status codes covered in route tests (Tasks 10, 11); client error pattern in `ChatWindow` (Task 14); edge cases accepted in spec are not coded against (correct — they're "accepted").
- §7.5 Security: keys server-only (never `NEXT_PUBLIC_`) by construction; CSRF + RLS inherited from M1 with no override; rate limiting explicitly deferred.
- §7.6 A11y: axe-core extension in Task 17.
- §8 Testing strategy: matches tasks. 38 unit/component tests + 1 E2E + 1 a11y extension.
- §9 Implementation order: I expanded the spec's 19 steps into 20 tasks (split env vars + dep install into a single Task 2; doc updates each got their own task).
- §10 Deviations: each deviation has its implementation task (OpenAI/Groq → Task 5; ProjectHeader split → Task 12; monochrome tokens → Task 13 CSS + Task 12 + Task 14; mid-stream sentinel → Task 10; abort controller → Task 14; 200-char preview → Task 11).

**Placeholder scan:** No "TBD" / "TODO" / "appropriate X" / "similar to Task N" patterns. Every code block is complete.

**Type consistency:**
- `ProjectMessage` defined in Task 3 and used identically in Tasks 8, 10, 14, 15.
- `ProjectDocument` defined in Task 3 and used in Task 9 + Task 11 insert path.
- `getLLM()` return shape `{ client, model, provider }` consistent between Task 5 (definition) and Task 10 (consumption).
- `parseFile(filename, buffer)` signature consistent between Task 7 (definition) and Task 11 (consumption).
- `fileTypeFor(filename)` signature consistent between Task 7 (definition) and Task 11 (consumption).
- `mockLLMClient({ chunks?, failBeforeStream?, failAfterChunk? })` signature consistent between Task 6 (definition) and Task 10 (consumption).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-12-prism-m2-chat-intake.md`. Two execution options:

1. **Subagent-Driven (recommended)** — Dispatch a fresh subagent per task (or batched per Section "obviously-similar tasks" mode), with spec + code-quality review per task. Same approach we used for M1; gets quality + checkpoint visibility.
2. **Inline Execution** — Execute tasks in this session via `superpowers:executing-plans` with batch checkpoints.

Which approach?
