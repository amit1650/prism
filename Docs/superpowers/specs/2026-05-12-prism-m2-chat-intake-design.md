# Prism — M2 Design Spec: Chat Intake

**Date:** 2026-05-12
**Milestone:** 2 of 5
**Status:** Approved (awaiting review)
**Builds on:** M1 (`prism/` Next.js 16 app, monochrome design system, Supabase + RLS)

---

## 1. Goal

The user can chat with an LLM assistant about their project and upload reference documents (PDF, DOCX, TXT, MD). Chat history and uploaded documents persist in Supabase, scoped by RLS. The chat page replaces the M1 stub at `/project/[id]`. An "Analyse Project" header button takes the user to a stub for M3.

This spec supersedes `Docs/06-milestone-2-chat-intake.md` where they differ. Differences are explicit in §10.

---

## 2. Key decisions (resolved during brainstorming)

| Decision | Choice | Why |
|---|---|---|
| LLM provider | **OpenAI primary (empty key for now), Groq fallback (active)** | User has a Groq key; will add OpenAI later. Both speak the OpenAI-compatible API, so one SDK + `baseURL` switch covers both. |
| OpenAI SDK | `openai` npm package, pointed at provider-specific `baseURL` | One client; Groq endpoint is `https://api.groq.com/openai/v1`. |
| Default models | OpenAI `gpt-4o-mini`, Groq `llama-3.3-70b-versatile` | Cost-effective + capable. Override via `OPENAI_MODEL` / `GROQ_MODEL` env vars. |
| Streaming pattern | Raw `ReadableStream` returning plain-text chunks | Simplest; matches `Docs/06`; no Vercel AI SDK dep. |
| Chat UI | **Chatscope used as-is** (per `Docs/10`) | Hard project rule. Only configure + theme via CSS vars. |
| `Docs/02` Claude reference | Update to reflect multi-provider design (deferred to a doc-update task at end of M2) | The "claude-sonnet-4-6" pin is no longer used. |
| File size cap | 10 MB | Reasonable for PDFs, well under serverless body limits. |
| Parsed text cap | 200,000 chars | Prevents an over-long PDF from blowing the DB row or context window. |
| Allowed extensions | `pdf`, `docx`, `doc`, `txt`, `md` | Per `Docs/06`. Server-side validation by extension only (no MIME sniffing in M2). |
| Welcome message | Client-injected virtual assistant message when no messages exist | Never persisted; LLM still sees it in context on first user reply. |
| Document context for LLM | LLM sees the first 200 chars (preview) via a chat message; full text only available to M3+ | M2 limitation, accepted. Users can paste key sections into chat if needed. |
| Per-user rate limiting | None in M2 | Rely on provider rate limits + `max_tokens: 1024` cap. Kill switch is clearing both keys. |
| "Analyse Project" button | Always visible; links to M2 stub at `/project/[id]/qa` | Status flip to `clarifying` happens in M3, not M2. |

---

## 3. Architecture & routing

### 3.1 Routes added / modified

| Path | Type | Purpose |
|---|---|---|
| `/api/chat` | POST | Authenticate, save user message, stream LLM response, save assistant message |
| `/api/upload` | POST (multipart) | Authenticate, validate, parse PDF/DOCX/TXT/MD, store extracted text |
| `/project/[id]` | server page | **Replace M1 stub** with `<ProjectHeader>` + `<ChatWindow>` |
| `/project/[id]/qa` | server page | M2 stub — "Q&A wizard coming in M3 — your project is saved." |

### 3.2 Schema additions

Both tables created in M2's first implementation task (walkthrough modelled on M1's Task 1).

```sql
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

Both reuse the existing RLS pattern from the `projects` table — access is via the parent project's `user_id`.

### 3.3 Env additions

Add to `.env.local` and `.env.local.example`:

```
# Primary LLM provider (leave empty for now; Groq fallback will be used)
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini

# Fallback LLM provider (active in M2)
GROQ_API_KEY=gsk-...
GROQ_MODEL=llama-3.3-70b-versatile
```

### 3.4 Provider abstraction (`src/lib/llm/client.ts`)

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
  throw new Error('No LLM provider configured. Set OPENAI_API_KEY or GROQ_API_KEY in .env.local.')
}
```

One client, one streaming call. Switching providers is just an env-var change. The `openai` SDK's chunked-completions API is identical for both endpoints.

---

## 4. File layout

All paths under `prism/src/`. **Bold** = new in M2.

```
app/api/chat/route.ts                  POST handler with streaming response                    (NEW)
app/api/upload/route.ts                POST handler with multipart upload + parse              (NEW)
app/(app)/project/[id]/page.tsx        REPLACE M1 stub with ProjectHeader + ChatWindow
app/(app)/project/[id]/qa/page.tsx     M2 stub for M3 entry point                              (NEW)

components/chat/ChatWindow.tsx         Chatscope wrapper + streaming + upload                  (NEW)
components/chat/ProjectHeader.tsx      Name + StatusDot + Analyse Project CTA                  (NEW)

lib/llm/client.ts                      Provider factory (§3.4)                                  (NEW)
lib/llm/prompts.ts                     SYSTEM_PROMPT constant                                   (NEW)
lib/files/parse.ts                     Server-only parser: parsePdf/parseDocx/parsePlain        (NEW)
lib/messages.ts                        getProjectMessages(id) — RLS-scoped                      (NEW)
lib/documents.ts                       getProjectDocuments(id) — RLS-scoped                     (NEW)

types/project.ts                       ADD ProjectMessage, ProjectDocument

app/globals.css                        ADD Chatscope theme overrides + Chatscope CSS import

src/test/llm-mock.ts                   mockLLMClient factory                                    (NEW)
src/test/fixtures/sample.pdf           1-page PDF for parse tests                               (NEW)
src/test/fixtures/sample.docx          One-paragraph DOCX                                       (NEW)
src/test/fixtures/sample.txt           Plain text                                               (NEW)
src/test/fixtures/sample.md            Plain markdown                                           (NEW)

src/lib/llm/client.test.ts             4 tests
src/lib/files/parse.test.ts            5 tests
src/lib/messages.test.ts               2 tests
src/lib/documents.test.ts              2 tests
src/app/api/chat/route.test.ts         5 tests   (vitest-environment: node)
src/app/api/upload/route.test.ts       5 tests   (vitest-environment: node)
src/components/chat/ProjectHeader.test.tsx        2 tests
src/components/chat/ChatWindow.test.tsx           4 tests
tests/e2e/chat.spec.ts                 1 spec covering full chat flow + upload                  (NEW)
tests/e2e/a11y.spec.ts                 EXTEND with audit for /project/[id] after seeded chat
```

### 4.1 Two boundary decisions

1. **`ChatWindow` is the only chat component.** It handles Chatscope wiring + streaming fetch + file upload (~250 lines). If it grows past that during implementation, we'd extract `useStreamingChat()` and `useFileUpload()` hooks. Not splitting up front.
2. **No `ChatProvider` context.** Chat is consumed only on the project page (one consumer), so plain `useState` in `ChatWindow` is enough. M1's `NewProjectDialogProvider` exists because two triggers share one dialog; M2 doesn't have that pattern.

---

## 5. System prompt

Stored as a single exported constant in `src/lib/llm/prompts.ts`:

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

Same prompt for OpenAI and Groq — both providers support a `system` role.

---

## 6. Data flow

### 6.1 Initial page load (server-side)

```
GET /project/[id]                               (app)/project/[id]/page.tsx
   ├─ getProjectById(id)                → Project | null  (RLS)
   │      └─ if null → "Project not found"
   ├─ getProjectMessages(id)            → ProjectMessage[]  (ordered by created_at)
   └─ render <ProjectHeader project={...}/> + <ChatWindow projectId={id} initialMessages={messages} />
```

### 6.2 Welcome message (virtual, client-only)

When `initialMessages.length === 0`, `ChatWindow` seeds its state with a synthetic assistant message ("What project do you want to plan? …"). The welcome is never written to the DB. On first user reply, the welcome is included in the `messages` array sent to `/api/chat` (so the LLM has it in context), but the route only persists the latest *user* message and the streamed assistant response.

### 6.3 Send a message (streaming)

```
[Client]
   ChatWindow.sendMessage(text):
     1. Optimistic push: user message → state
     2. Optimistic push: empty assistant message → state (streaming target)
     3. setTyping(true)
     4. fetch POST /api/chat with { projectId, messages } (60s AbortController)
     5. read response.body stream:
          for await chunk:
              decode text → append to assistant message via setState (live update)
     6. setTyping(false)

[POST /api/chat]                                 src/app/api/chat/route.ts
   1. supabase.auth.getUser()                    → 401 if no user
   2. Validate body { projectId: string, messages: Array<{role, content}> }
   3. Verify project belongs to user             → 404 if not (RLS-scoped select)
   4. Insert last user message into project_messages (role='user')
   5. const { client, model } = getLLM()
   6. const stream = client.chat.completions.create({
        model, stream: true, max_tokens: 1024,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      })
   7. Return new Response(readableStream, { 'Content-Type': 'text/plain; charset=utf-8' })
   8. ReadableStream.start(controller):
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content ?? ''
            if (text) {
              full += text
              controller.enqueue(encoder.encode(text))
            }
          }
          await supabase.from('project_messages').insert({ project_id, role: 'assistant', content: full })
        } catch (err) {
          controller.enqueue(encoder.encode('\n\n[Connection lost. Try again.]'))
          // do NOT persist partial assistant message
        } finally {
          controller.close()
        }
```

### 6.4 File upload

```
[Client]
   ChatWindow.handleFileUpload(file):
     1. setUploading(true)
     2. POST /api/upload (multipart: file + projectId)
     3. on 2xx: sendMessage(`[Uploaded: ${file.name}]\n\nDocument content preview: ${preview}...`)
     4. on non-2xx: append inline assistant-side error message
     5. setUploading(false)

[POST /api/upload]                              src/app/api/upload/route.ts
   1. supabase.auth.getUser()                    → 401
   2. formData.get('file') + 'projectId'         → 400 if missing
   3. Verify project belongs to user             → 404
   4. Validate file.size ≤ 10 MB                  → 413
   5. Validate extension in {pdf,docx,doc,txt,md}  → 415
   6. Read file → Buffer
   7. Parse via lib/files/parse.ts                → 422 on failure
   8. Truncate rawText to 200_000 chars
   9. Insert into project_documents
   10. Return JSON { document, preview: rawText.slice(0, 200) }
```

### 6.5 Dialog hoisting / sidebar refresh

Not applicable to M2 — no dialogs, no status changes, no sidebar list changes during chat.

### 6.6 RLS trust boundary (unchanged from M1)

- Every read goes through the anon-key server client; RLS filters to `auth.uid()`.
- Every insert/update goes through the same authenticated server client.
- The service-role key is **not used** in `/api/chat` or `/api/upload` — only the helpers in `tests/e2e/helpers.ts` use it for E2E teardown.

---

## 7. Errors & edge cases

### 7.1 `/api/chat` status codes

| Trigger | Status |
|---|---|
| No session | 401 |
| Project not owned by user / doesn't exist | 404 |
| Missing or malformed body | 400 |
| Neither `OPENAI_API_KEY` nor `GROQ_API_KEY` set | 500 `LLM not configured` |
| LLM 4xx/5xx before any chunk streams | 502 `Couldn't reach the assistant. Try again.` |
| LLM error mid-stream | enqueue `"\n\n[Connection lost. Try again.]"`; close stream; do NOT persist partial assistant message |
| DB insert (user message) fails | 500 returned *before* the LLM call (no cost incurred) |
| DB insert (assistant message) fails | log warn; user already saw the stream — refresh will miss that message |

### 7.2 `/api/upload` status codes

| Trigger | Status |
|---|---|
| Unauthenticated | 401 |
| Project not found / RLS-denied | 404 |
| Missing file or projectId | 400 |
| File size > 10 MB | 413 `File too large (max 10 MB)` |
| Extension not in allow-list | 415 `Unsupported file type` |
| Parse failure (corrupt PDF etc.) | 422 `Couldn't parse the file` |
| DB insert fails | 500 |

### 7.3 Client behavior in `ChatWindow`

- Non-2xx `/api/chat` response → read JSON `{ error }`, append assistant-side message `"[${error}]"` so the failure is visible inline.
- Network failure or AbortController timeout (60s) → same inline error pattern.
- Upload failure → append assistant-side message `"[Couldn't upload <filename>: <reason>]"`.
- `MessageInput` is `disabled={typing || uploading}` to prevent double-submits.

### 7.4 Edge cases (accepted for M2)

- Page refresh mid-stream: partial assistant response not saved; reload shows only complete messages.
- Two tabs, two sends: each persists independently; tabs sync on reload.
- Empty file: parses to empty string, inserts a row with empty `raw_text`; benign.
- Very large PDF on Vercel Hobby: 10s function timeout may hit. Local dev unaffected. Out of M2 scope.
- Long message history (~100 messages): both default models support 128K context; no truncation logic added.

### 7.5 Security

- **API keys server-only** — no `NEXT_PUBLIC_` prefix. Client never sees them.
- **Prompt injection from documents** — accepted M2 risk. LLM only sees a 200-char preview via a chat message; full doc isn't in chat context. Revisit when M3 introduces structured parsing.
- **Filename safety** — stored as a text column, never used as a filesystem path or in HTML markup.
- **Message content XSS** — Chatscope renders `Message.model.message` as text. We do not enable any raw-HTML mode.
- **CSRF** — Supabase cookies are `SameSite=Lax`; foreign POSTs blocked.
- **Rate limiting** — none in M2. Rely on provider limits + `max_tokens: 1024`. Kill switch = clear both API keys from `.env.local`.

### 7.6 Accessibility

- Chatscope baseline + extend axe-core audit to `/project/[id]`.
- Assistant message containers get `aria-live="polite"` if Chatscope doesn't provide it natively (verify in implementation).
- "Analyse Project" is a `<Link>` with visible text.
- File input is native `<input type="file">`.
- Status badge in `ProjectHeader` reuses `<StatusDot>` (already accessible per M1).

### 7.7 Explicitly out of scope for M2

- Message edit/delete
- "Stop generating" mid-stream button
- Per-user / per-IP rate limiting
- Image uploads or non-text formats (xlsx, pptx)
- Multiple files in one upload
- Conversation export (M5)
- Markdown rendering inside messages (Chatscope renders plain text — fine)
- Token usage display
- Realtime cross-tab sync

---

## 8. Testing strategy

### 8.1 Layers

| Layer | Tool | Scope |
|---|---|---|
| Unit | Vitest | `lib/llm/client`, `lib/files/parse`, `lib/messages`, `lib/documents` |
| API route | Vitest, `@vitest-environment node` | `/api/chat`, `/api/upload` handlers with mocked LLM + Supabase |
| Component | Vitest + RTL + jsdom | `ProjectHeader`, `ChatWindow` (with mocked streaming fetch) |
| E2E | Playwright | Full chat flow against real Groq + real Supabase |

### 8.2 Mocking

- `src/test/llm-mock.ts` exports `mockLLMClient({ chunks?, failBeforeStream?, failAfterChunk? })` returning an `OpenAI`-shaped object whose `chat.completions.create` returns an async-iterable that yields `{ choices: [{ delta: { content } }] }` chunks.
- API route tests `vi.mock('@/lib/llm/client', () => ({ getLLM: () => ({ client, model: 'test', provider: 'test' }) }))`.
- Supabase mocks reuse `mockSupabaseClient` from M1, extended with handlers for `project_messages` and `project_documents` tables.
- `ChatWindow` streaming tests mock `global.fetch` to return a `Response` whose body is a custom-controllable `ReadableStream`.

### 8.3 Real fixtures for parse tests

`src/test/fixtures/` contains real (tiny) `sample.pdf`, `sample.docx`, `sample.txt`, `sample.md`. Test loads them with `fs.readFileSync` and passes the buffer to `parsePdf` / `parseDocx` / `parsePlain`. Catches integration issues with the `pdf-parse` and `mammoth` deps that pure mocks would miss.

### 8.4 E2E spec

`tests/e2e/chat.spec.ts`:

1. Signup → create project → land on chat page → see welcome message
2. Send "Hello" → streaming Groq response appears progressively → reload → both messages persist
3. Upload `sample.txt` → see `[Uploaded: sample.txt]` message + assistant acknowledgement
4. Click "Analyse Project" → land on `/project/[id]/qa` stub

Plus extend `tests/e2e/a11y.spec.ts` with one audit for `/project/[id]` (after seeding a chat message).

### 8.5 TDD loop (per task)

Same as M1: red → green → refactor → edge cases. Each task's tests must be green before commit-equivalent point.

### 8.6 Coverage policy

No percentage target. Test what could realistically break. Trivial JSX-only sub-components get smoke tests at most.

---

## 9. Implementation order (becomes the plan in the next step)

1. Walk user through Supabase schema additions (`project_messages` + `project_documents`)
2. Add env vars (`OPENAI_API_KEY` empty, `GROQ_API_KEY` from user)
3. Update `src/types/project.ts` with `ProjectMessage`, `ProjectDocument`
4. `lib/llm/client.ts` + `lib/llm/prompts.ts` + tests
5. Test infrastructure: `src/test/llm-mock.ts` + `src/test/fixtures/sample.{pdf,docx,txt,md}`
6. `lib/files/parse.ts` + tests
7. `lib/messages.ts` + `lib/documents.ts` + tests
8. `api/chat/route.ts` + tests
9. `api/upload/route.ts` + tests
10. `components/chat/ProjectHeader.tsx` + tests
11. Chatscope CSS overrides in `app/globals.css`
12. `components/chat/ChatWindow.tsx` + tests
13. Replace `app/(app)/project/[id]/page.tsx` with chat-enabled version
14. Create `app/(app)/project/[id]/qa/page.tsx` stub
15. E2E `tests/e2e/chat.spec.ts`
16. Extend `tests/e2e/a11y.spec.ts` with `/project/[id]` audit
17. Update `Docs/02-tech-stack.md` to reflect multi-provider design
18. Update top-level `CLAUDE.md` with M2 ship + provider info
19. Final verification sweep (typecheck, build, all tests, axe)

---

## 10. Deviations from `Docs/06-milestone-2-chat-intake.md`

| Doc says | Spec says | Reason |
|---|---|---|
| `anthropic.messages.stream` (Anthropic SDK + `claude-sonnet-4-6`) | `openai.chat.completions.create({ stream: true })` with provider-switched `baseURL` | User has Groq key, no Anthropic. OpenAI primary, Groq fallback. One SDK works for both. |
| `ANTHROPIC_API_KEY` env | `OPENAI_API_KEY` + `GROQ_API_KEY` + `OPENAI_MODEL` + `GROQ_MODEL` | Same as above. |
| Project page imports `ChatWindow` directly | Project page renders `<ProjectHeader>` + `<ChatWindow>`; header extracted for testability | Cleaner split; M1 already established this pattern with `ProjectSidebar`. |
| Hardcoded `bg-gray-950 / bg-blue-600` styles in header | Uses monochrome tokens (`bg-surface-1`, white primary CTA) | Aligns with M1's design system from `Docs/10`. |
| No tests specified | Comprehensive Vitest + RTL + Playwright coverage (~22 unit/component tests + 1 E2E + a11y extension) | Match M1's TDD discipline. |
| No upload size or extension validation | 10 MB cap, allow-list of 5 extensions, 200K-char text truncation | Defense-in-depth + serverless body-size protection. |
| No file fixtures | Real `.pdf`, `.docx`, `.txt`, `.md` test fixtures | Pure mocks would miss `pdf-parse` / `mammoth` integration issues. |
| 200-char preview into chat as the "file's content" | Same behavior, explicitly documented as a known M2 limitation — LLM does NOT see full doc text in chat | Honest accounting of what works and what's deferred to M3. |
| No mid-stream error handling | LLM mid-stream errors enqueue a sentinel string + close; partial response not persisted | Real production concern; can't ship without it. |
| No request timeout client-side | 60s `AbortController` wraps the chat fetch | Prevents hung fetches if the provider stalls. |

---

## 11. Open questions

None outstanding. All decisions resolved during brainstorming.
