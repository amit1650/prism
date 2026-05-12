# 02 — Tech Stack

## Overview

```
Frontend     Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
Auth         Supabase Auth (Email/Password in M1; Google OAuth deferred)
Database     Supabase (PostgreSQL + Realtime — Realtime not used yet)
AI           OpenAI primary (gpt-4o-mini) / Groq fallback (llama-3.3-70b-versatile) — both via `openai` SDK
Chat UI      @chatscope/chat-ui-kit-react
File Parse   pdf-parse + mammoth + plain text reader
Export       Custom .md builder + file-saver (M5)
Hosting      Vercel (recommended)
```

---

## Package List

### Core
```bash
npx create-next-app@latest prism \
  --typescript \
  --tailwind \
  --app \
  --src-dir
```

> **Note:** `create-next-app@latest` ships Next.js 16. Our async patterns (`await cookies()`, `await params`) require Next ≥ 15. Don't pin to Next 14.

### Supabase
```bash
npm install @supabase/supabase-js @supabase/ssr
```

### Chat UI — Chatscope (PREBUILT — DO NOT REPLACE)
```bash
npm install @chatscope/chat-ui-kit-react
npm install @chatscope/chat-ui-kit-styles
```
> ⚠️ This is non-negotiable. We use Chatscope as-is.
> Do not build custom chat bubbles, message lists, or input components.
> Only configure and theme Chatscope.

### AI
```bash
npm install openai
```
The `openai` SDK is OpenAI-compatible at the wire level — pointing its `baseURL` at `https://api.groq.com/openai/v1` makes Groq accept the exact same requests. No Anthropic SDK is used in M2.

### File Parsing
```bash
npm install pdf-parse mammoth
npm install -D @types/pdf-parse
```

### Export (M5)
```bash
npm install file-saver
npm install -D @types/file-saver
```

### UI Utilities
```bash
npm install clsx tailwind-merge
npm install @radix-ui/react-dialog
```
(`lucide-react`, `@radix-ui/react-progress`, `@radix-ui/react-tooltip` are deferred to milestones that need them.)

---

## Environment Variables

```env
# .env.local

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# LLM providers (OpenAI primary, Groq fallback)
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
GROQ_API_KEY=your_groq_key
GROQ_MODEL=llama-3.3-70b-versatile

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Version Pins

| Package | Version |
|---------|---------|
| next | ^16 |
| typescript | 5.x |
| tailwindcss | ^4 |
| @supabase/supabase-js | ^2 |
| @supabase/ssr | ^0.5 |
| @chatscope/chat-ui-kit-react | ^2 |
| @chatscope/chat-ui-kit-styles | ^1 |
| openai | ^4 |
| pdf-parse | ^1 |
| mammoth | ^1 |

---

## Why These Choices

### Next.js App Router (Next 16)
Server components let us call LLM APIs and Supabase directly without exposing keys. Streaming responses are natively supported via `ReadableStream`. Next 16 renamed `middleware.ts` → `proxy.ts` and made several previously-sync APIs async (`cookies()`, `params`); we follow the new conventions.

### Tailwind v4
v4 uses CSS-first configuration via `@theme {}` in `globals.css` — no `tailwind.config.ts`. Tokens like `--color-X` and `--shadow-X` auto-generate utilities (`bg-X`, `shadow-X`). This keeps the design system in one file and reduces config churn.

### Supabase
Handles auth, database, and realtime in one service. Free tier is sufficient for development. Row Level Security (RLS) keeps project data isolated per user — every table policy gates by parent project's `user_id == auth.uid()`.

### Chatscope
Production-ready chat UI. Gives us message bubbles, typing indicators, file attachment UI, and scroll behavior for free. **Zero custom chat component work.** We theme via CSS variables in `globals.css` (e.g. `--cs-bg-message-incoming`).

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

### Tailwind CSS
Utility-first. Works well alongside Chatscope's own CSS. Override Chatscope styles via CSS variables in `globals.css`.
