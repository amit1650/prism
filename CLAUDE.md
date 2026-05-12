# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository State

The product name is **Prism**. **M1 (Auth + Dashboard) and M2 (Chat Intake) are implemented and passing all tests** under `prism/`. The `Docs/` folder remains the planning source; `prism/` contains the actual Next.js codebase. Milestones M3–M5 are still spec-only and will be designed/planned/implemented one at a time.

For active design work, see `docs/superpowers/specs/` and `docs/superpowers/plans/`.

**Working in the codebase:** the Next.js app lives at `prism/`. From the repo root, `cd prism` first before running `npm` commands. Standard scripts: `npm run dev`, `npm run build`, `npm run lint`, `npm run typecheck`, `npm test` (Vitest unit/component), `npm run test:e2e` (Playwright against real dev Supabase + Groq).

**Stack realities (different from the original `Docs/02`; the doc has been updated to reflect these):**
- **Next.js 16** (not 14) — `create-next-app@latest` ships 16; async-cookies and async-params patterns require ≥15. M3+ should treat 16 as the target.
- **Tailwind v4** (not v3) — no `tailwind.config.ts`; tokens live in `prism/src/app/globals.css` inside `@theme {}`. Tailwind utilities auto-generate from `--color-X` and `--shadow-X` names. Chatscope is themed via `--cs-*` CSS variables in the same file.
- **`proxy.ts`, not `middleware.ts`** — Next 16 renamed the convention. The file at `prism/src/proxy.ts` exports `async function proxy(request: NextRequest)`. Behavior is identical to old middleware.
- **OpenAI primary + Groq fallback** (not Anthropic) — `src/lib/llm/client.ts` exports `getLLM()` which returns an `openai` SDK client pointed at OpenAI (if `OPENAI_API_KEY` set) or Groq (`baseURL: https://api.groq.com/openai/v1`). Default models: `gpt-4o-mini` / `llama-3.3-70b-versatile`, env-overridable via `OPENAI_MODEL` / `GROQ_MODEL`. Used in `/api/chat` (streaming).
- **Chatscope a11y workaround** — `ChatWindow` patches `aria-label` on Chatscope's send + attach buttons via a `useEffect` (Chatscope itself doesn't set them). Pattern: query `.cs-button--attachment` / `.cs-button--send` from a `rootRef` and set the attribute. Apply the same pattern if more Chatscope a11y gaps surface.
- **No git yet** — repo is intentionally not a git repo (user deferred init). Most plan tasks skipped their commit step.

## M2 — Chat Intake (shipped)

- `/api/chat` (POST) — streaming chat. Validates auth + project ownership, saves user message, calls `getLLM().client.chat.completions.create({ stream: true, ... })`, streams text chunks back, saves assistant message after stream completes. Mid-stream errors emit a `[Connection lost. Try again.]` sentinel and don't persist a partial assistant row.
- `/api/upload` (POST multipart) — accepts `file` + `projectId`. Validates 10 MB cap, allow-list `{pdf,docx,doc,txt,md}`, RLS-scoped project ownership, parses via `lib/files/parse.ts`, truncates to 200_000 chars, inserts into `project_documents`.
- **Tables added in M2** (run the SQL from `docs/superpowers/specs/2026-05-12-prism-m2-chat-intake-design.md` §3.2 against the dev Supabase project): `project_messages` and `project_documents`. Both reuse the M1 RLS pattern via the parent project's `user_id`.
- **Welcome message is client-only** — `ChatWindow` injects a synthetic `assistant` message when `initialMessages.length === 0`. Never persisted. The LLM sees it on first user reply.
- **Documents are NOT in chat context beyond the 200-char preview** — uploaded text is stored in full in `project_documents.raw_text` for M3's parsing pipeline, but the LLM in /api/chat only sees the preview snippet that gets injected as a chat message. Accepted M2 limitation.

Before touching code, read the docs **in order** — they are numbered and each milestone is self-contained but references the earlier ones:

- `Docs/01-project-overview.md` — what is being built and why (read first)
- `Docs/02-tech-stack.md` — pinned versions, env vars, install commands
- `Docs/03-architecture.md` — folder structure, data flow, API route pattern
- `Docs/04-database-schema.md` — Supabase tables, RLS policies, TypeScript types
- `Docs/05-` through `09-` — milestone build plans (auth → chat → parsing → Q&A → export)
- `Docs/10-ui-ux-guidelines.md` — color tokens, Chatscope theming, page layouts

## What Prism Is

A "Project Intelligence Platform": user describes a project via chat + uploaded docs, the app builds a structured **knowledge graph**, runs an adaptive Q&A wizard to fill gaps, and exports a `.md` context file optimized for feeding to LLMs (Claude / ChatGPT / Cursor / raw).

The exported `.md` file is the product. Everything else serves it.

## Tech Stack (when implementing)

- Next.js 14 (App Router) + TypeScript + Tailwind, `--src-dir` layout
- Supabase (auth + Postgres + RLS) via `@supabase/supabase-js` and `@supabase/ssr`
- Anthropic Claude API via `@anthropic-ai/sdk` — model `claude-sonnet-4-6` (Sonnet 4.6) per `Docs/02-tech-stack.md`
- `@chatscope/chat-ui-kit-react` for all chat UI
- `pdf-parse` + `mammoth` for document parsing (server-side)
- `file-saver` for client-side `.md` download

Project bootstrap and full install command are in `Docs/05-milestone-1-auth-dashboard.md` (Task 1). Env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_APP_URL`) are in `Docs/02-tech-stack.md`.

Once the Next.js app is scaffolded, standard commands apply: `npm run dev`, `npm run build`, `npm run lint`. There are no test commands or CI scripts defined in the docs — do not invent them.

## Architecture: Non-Obvious Pieces

### The parsing pipeline is six separate Claude calls — never combine them

`Docs/07-milestone-3-parsing-pipeline.md` defines six sequential stages: entity extraction → reference resolution → conflict detection → assumption surfacing → gap analysis → graph assembly. Each is a focused prompt in `src/lib/claude/prompts/parser.ts` and a function in `src/lib/claude/pipeline/`. Do not merge them into one mega-prompt — the separation is intentional for quality and debuggability.

### Knowledge graph is the source of truth, not chat history

Chat messages and uploaded documents are raw inputs stored in `project_messages` and `project_documents`. The actual structured state lives in `project_knowledge` (one row per project, versioned via the `version` column). Every fact carries a confidence level: `confirmed` | `inferred` | `tentative`. Q&A answers re-run the parse and update this graph — they do not get stored as transcripts.

### Q&A is adaptive and bounded

Max 25 questions per session. Each `Question` has `skip_if` rules so answering one question can eliminate others. Option `d` is always "Custom answer..." with free-text input. See types in `Docs/04-database-schema.md`.

### API route pattern

All routes under `src/app/api/*` follow the same shape: authenticate via `supabase.auth.getUser()`, validate body, do work, return JSON. Template is in `Docs/03-architecture.md` (API Route Patterns section). No middleware-level auth for API routes — each route authenticates itself. Page routes are protected by `src/middleware.ts`.

### State management is deliberately minimal

No Redux/Zustand. URL state for current project id, Supabase for server state, `useState` for chat/wizard UI. Knowledge graph is always fetched fresh from Supabase, not cached in memory long-term.

## Hard Rules from the Docs

These are stated as non-negotiable in the planning docs — respect them when implementing:

1. **Do not build custom chat components.** Use Chatscope's `MainContainer` / `ChatContainer` / `MessageList` / `Message` / `MessageInput` / `TypingIndicator` as-is. Theme only via CSS variables (`--cs-bg-message-incoming` etc.) in `globals.css`. Components using Chatscope must be `'use client'` — it does not SSR. See `Docs/10-ui-ux-guidelines.md`.
2. **Do not save Q&A transcripts.** Answers update the knowledge graph, then are discarded as a chat log.
3. **Do not store knowledge graph rows per fact.** It's one JSONB-heavy row per project; mutations happen by reading, transforming, and writing back the whole row (incrementing `version`).
4. **All Supabase tables have RLS keyed on `auth.uid()`.** When adding tables, follow the same pattern shown in `Docs/04-database-schema.md` — never expose data via the anon key without a policy.
5. **Server-only secrets stay server-only.** `SUPABASE_SERVICE_ROLE_KEY` and `ANTHROPIC_API_KEY` are only used in `src/app/api/*` and server components. Anything `NEXT_PUBLIC_*` is fine on the client.

## Working with the Docs Themselves

If the user asks to update the spec, edit the relevant numbered file in `Docs/`. Keep the structure: each doc is independently readable and references siblings by filename. Do not introduce a new doc unless asked — extend the existing ones.
