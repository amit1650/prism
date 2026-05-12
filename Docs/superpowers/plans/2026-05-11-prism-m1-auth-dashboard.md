# Prism M1 — Auth + Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the M1 foundation for Prism — email/password auth (signup + login + signout), a sidebar-shell dashboard with first-run welcome detection, and modal-driven project creation, fully tested at unit/component/E2E layers.

**Architecture:** Next.js 14 App Router with two route groups (`(auth)` and `(app)`). Server components fetch via Supabase server client (with RLS). Mutations use Server Actions. UI is monochrome (black/dark-gray/white) with multi-layer shadows; Chatscope intentionally not yet in M1. TDD throughout: Vitest+RTL for unit/component, Playwright (Chromium) for E2E against the real dev Supabase project with unique test users.

**Tech Stack:** Next.js 14, TypeScript, Tailwind, Supabase (`@supabase/supabase-js` + `@supabase/ssr`), `@radix-ui/react-dialog`, Vitest, React Testing Library, Playwright, `@axe-core/playwright`.

---

## Spec Reference

This plan implements `docs/superpowers/specs/2026-05-11-prism-m1-auth-dashboard-design.md`. Read it first; it documents every decision, deviation from `Docs/05`, and design token.

## Prerequisites (engineer's machine)

- Node.js ≥ 20.x, npm ≥ 10.x
- A browser (Chrome/Edge/Safari)
- A Supabase account (free tier is enough)
- Ability to receive OAuth redirects on `localhost:3000`

## File Structure

All paths are **inside the `prism/` subdirectory** at the repo root, unless explicitly noted.

### Created — App routes

| File | Responsibility |
|---|---|
| `src/app/layout.tsx` | Root HTML layout, fonts, body bg, dialog context provider mount |
| `src/app/page.tsx` | Root redirector — `/dashboard` if authed, `/login` if not |
| `src/app/globals.css` | Tailwind directives + monochrome CSS-variable tokens |
| `src/app/(auth)/layout.tsx` | Full-screen centered-card shell for /login + /signup |
| `src/app/(auth)/login/page.tsx` | Login page server wrapper around `<SignInForm />` |
| `src/app/(auth)/signup/page.tsx` | Signup page server wrapper around `<SignUpForm />` |
| `src/app/auth/callback/route.ts` | OAuth callback handler (kept for later Google enable) |
| `src/app/(app)/layout.tsx` | Sidebar + main shell; fetches projects server-side |
| `src/app/(app)/dashboard/page.tsx` | Server component; branches WelcomeScreen vs EmptyState |
| `src/app/(app)/project/[id]/page.tsx` | M1 stub page |
| `src/middleware.ts` | Single auth gate |

### Created — Components

| File | Responsibility |
|---|---|
| `src/components/auth/AuthCard.tsx` | Shared card frame for login/signup (logo + wordmark + children slot) |
| `src/components/auth/SignInForm.tsx` | Client form: email + password |
| `src/components/auth/SignUpForm.tsx` | Client form: name + email + password |
| `src/components/dashboard/ProjectSidebar.tsx` | Client; receives projects as props, marks active via `usePathname` |
| `src/components/dashboard/ProjectRow.tsx` | Single row with `<StatusDot>` + truncated name |
| `src/components/dashboard/NewProjectButton.tsx` | Sidebar trigger that opens the dialog |
| `src/components/dashboard/NewProjectDialog.tsx` | Radix Dialog + name/description form |
| `src/components/dashboard/NewProjectDialogProvider.tsx` | Mounts a single dialog instance + context for `useNewProjectDialog()` |
| `src/components/dashboard/SignOutButton.tsx` | Bottom of sidebar |
| `src/components/dashboard/WelcomeScreen.tsx` | First-run hero with 3-step explainer + CTA |
| `src/components/dashboard/EmptyState.tsx` | "Select a project or create a new one" |
| `src/components/ui/Logo.tsx` | Monochrome geometric SVG mark |
| `src/components/ui/StatusDot.tsx` | Intensity-based dot with `aria-label` |
| `src/components/ui/Button.tsx` | Variants: primary, secondary, ghost |

### Created — Lib

| File | Responsibility |
|---|---|
| `src/lib/supabase/client.ts` | Browser client factory |
| `src/lib/supabase/server.ts` | Server client factory (uses `next/headers` cookies) |
| `src/lib/projects.ts` | Server helpers: `getProjects`, `getProjectCount`, `getProjectById` |
| `src/lib/actions/projects.ts` | Server Action `createProjectAction` |
| `src/lib/utils.ts` | `cn()` — `clsx` + `tailwind-merge` |
| `src/types/project.ts` | `Project`, `ProjectStatus`, `NewProjectInput` |

### Created — Tests

| File | Responsibility |
|---|---|
| `vitest.config.ts` | Vitest config: jsdom, path aliases, setup file |
| `playwright.config.ts` | Playwright config: webServer, baseURL, Chromium project |
| `src/test/setup.ts` | jest-dom matchers, afterEach cleanup, env stubs |
| `src/test/supabase-mock.ts` | Chainable Supabase mock factory |
| `src/test/factories.ts` | `makeProject`, `makeUser` |
| `src/test/render.tsx` | RTL render wrapper for provider-wrapped components |
| `tests/e2e/helpers.ts` | E2E signup/cleanup utilities (uses service-role key) |
| `tests/e2e/auth-guard.spec.ts` | Middleware redirect behavior |
| `tests/e2e/login.spec.ts` | Pre-seeded user signs in → dashboard EmptyState |
| `tests/e2e/signout.spec.ts` | Sign out clears session |
| `tests/e2e/auth-onboarding.spec.ts` | Signup → welcome → modal create → project page |

### Created — Config

| File | Responsibility |
|---|---|
| `package.json` | Created by `create-next-app`, augmented with scripts and deps |
| `tsconfig.json` | Created by `create-next-app`, augmented with path aliases |
| `tailwind.config.ts` | Token-driven Tailwind config referencing CSS vars |
| `postcss.config.mjs` | From `create-next-app` (unchanged) |
| `next.config.ts` | From `create-next-app` (unchanged) |
| `.env.local` | Real Supabase credentials (gitignored) |
| `.env.local.example` | Template committed to repo |
| `.gitignore` | Augmented with `.env.local`, `playwright-report/`, `test-results/`, `.supabase/`, `.superpowers/` |

### Modified

| File | Responsibility |
|---|---|
| `Docs/10-ui-ux-guidelines.md` | Rewritten to document the monochrome system (Task 41) |

---

## Tasks

### Task 1: Supabase Project Setup (manual, user-driven)

**Files:** Captures credentials into `prism/.env.local` later, no code yet.

This task is one the engineer walks the user through in the browser. The engineer should produce a checklist message in the chat for the user to follow, **NOT** automate or skip.

- [ ] **Step 1: Tell the user to create a new Supabase project**

Message to send to the user (paste verbatim):

> 1. Go to https://supabase.com/dashboard and sign in (or create an account)
> 2. Click **New project**
> 3. Name: `prism-dev`. Region: pick the closest to you. Set a strong DB password and save it in a password manager.
> 4. Wait ~1 minute for provisioning. Tell me when the project status shows "Project is ready".

- [ ] **Step 2: Run the database schema (only the M1-relevant tables for now)**

Once the user reports the project is ready, message:

> Open the SQL Editor in the Supabase dashboard, paste the following, and click **Run**. This creates only the `projects` table — we'll add the other tables (messages, documents, knowledge, qa_sessions, exports) in their respective milestones.

```sql
-- Auto-update trigger function (reused by other tables in later milestones)
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Projects table
create table projects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text,
  status text not null default 'drafting'
    check (status in ('drafting', 'clarifying', 'compiling', 'ready', 'exported')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create trigger projects_updated_at
  before update on projects
  for each row execute function update_updated_at();

-- RLS
alter table projects enable row level security;

create policy "Users can only access their own projects"
  on projects for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

- [ ] **Step 3: Disable email confirmation**

Message to user:

> In the Supabase dashboard → **Authentication** → **Providers** → **Email**:
> - Set **Confirm email** to **off**
> - Click **Save**
>
> This lets new signups sign in immediately without clicking a confirmation link. You can re-enable later.

- [ ] **Step 4: Collect credentials**

Message to user:

> Go to **Project Settings → API**. Copy and paste these three values to me (treat them as secrets — never put them in chat with anyone else):
>
> 1. **Project URL** (`https://xxxx.supabase.co`)
> 2. **anon public** key
> 3. **service_role secret** key

Once received, hold them — they'll go into `.env.local` in Task 2.

- [ ] **Step 5: Verify**

After receiving the three values, message the user to confirm:

> Got it. I'll wire these into `.env.local` and `.env.local.example` shortly. Moving on to scaffolding the Next.js project.

No commit in this task — there is no repo yet.

---

### Task 2: Scaffold Next.js + install dependencies

**Files:**
- Create: `prism/` (entire subdirectory)
- Create: `prism/.env.local`, `prism/.env.local.example`
- Create: `prism/.gitignore` (augmented)
- Create: `prism/package.json` (with custom scripts)

- [ ] **Step 1: Run create-next-app**

Run from the repo root (`/Users/user/Documents/AI-Projects/prism`):

```bash
npx create-next-app@latest prism \
  --typescript \
  --tailwind \
  --app \
  --src-dir \
  --eslint \
  --import-alias "@/*" \
  --no-turbopack \
  --use-npm
```

Expected: project scaffolded under `prism/`. No prompts (all flags supplied).

- [ ] **Step 2: Change directory and install runtime deps**

```bash
cd prism
npm install \
  @supabase/supabase-js@^2 \
  @supabase/ssr@^0.5 \
  @radix-ui/react-dialog@^1 \
  clsx@^2 \
  tailwind-merge@^2
```

Expected: dependencies installed without errors. Verify `package.json` has them under `dependencies`.

- [ ] **Step 3: Install test dependencies**

```bash
npm install -D \
  vitest@^2 \
  @vitejs/plugin-react@^4 \
  @testing-library/react@^16 \
  @testing-library/jest-dom@^6 \
  @testing-library/user-event@^14 \
  jsdom@^25 \
  @playwright/test@^1 \
  @axe-core/playwright@^4
```

Then install the Playwright browsers:

```bash
npx playwright install chromium --with-deps
```

Expected: dev dependencies installed; Chromium downloaded.

- [ ] **Step 4: Write `.env.local` and `.env.local.example`**

Create `prism/.env.local` with the values collected in Task 1:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Create `prism/.env.local.example` (committed) with placeholders:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Step 5: Augment `.gitignore`**

Open `prism/.gitignore` (created by Next.js) and append:

```

# Test
/coverage
/playwright-report
/test-results
/blob-report
/playwright/.cache

# Brainstorm scratch
/.superpowers
```

The default `.gitignore` already excludes `.env*` and `node_modules`. Verify `.env.local` is excluded.

- [ ] **Step 6: Add scripts to `package.json`**

Open `prism/package.json`. Replace the `"scripts"` block with:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui"
}
```

- [ ] **Step 7: Verify the scaffold boots**

```bash
npm run dev
```

Expected: server starts on http://localhost:3000 without errors. Open the URL — you should see the Next.js welcome page. Press Ctrl-C to stop.

- [ ] **Step 8: First commit**

The repo at `/Users/user/Documents/AI-Projects/prism` does not yet have a `.git` directory (per the env). Initialize and commit:

```bash
cd /Users/user/Documents/AI-Projects/prism
git init
git add -A
git commit -m "chore: scaffold Next.js + Supabase + test deps for Prism M1"
```

Expected: initial commit on `main`. Verify `prism/.env.local` is NOT in the commit (`git show --stat HEAD | grep env.local` should only show `.env.local.example`).

---

### Task 3: Configure TypeScript, Tailwind tokens, and globals.css

**Files:**
- Modify: `prism/tsconfig.json`
- Modify: `prism/tailwind.config.ts`
- Replace: `prism/src/app/globals.css`

- [ ] **Step 1: Verify tsconfig path alias**

Open `prism/tsconfig.json`. It should already have:

```json
"paths": {
  "@/*": ["./src/*"]
}
```

If missing (older create-next-app), add it under `compilerOptions`. Also set:

```json
"baseUrl": "."
```

- [ ] **Step 2: Rewrite `tailwind.config.ts` with monochrome tokens**

Replace the entire file contents with:

```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        'surface-0': 'var(--surface-0)',
        'surface-1': 'var(--surface-1)',
        'surface-2': 'var(--surface-2)',
        border: 'var(--border)',
        'border-2': 'var(--border-2)',
        'text-0': 'var(--text-0)',
        'text-1': 'var(--text-1)',
        'text-2': 'var(--text-2)',
        'text-3': 'var(--text-3)',
        primary: 'var(--primary)',
        'primary-fg': 'var(--primary-fg)',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(0,0,0,.6)',
        md: '0 4px 12px rgba(0,0,0,.55), 0 1px 2px rgba(0,0,0,.6)',
        lg: '0 16px 48px rgba(0,0,0,.65), 0 4px 12px rgba(0,0,0,.4)',
        inset: 'inset 0 1px 0 rgba(255,255,255,.04)',
        'inset-pri': 'inset 0 1px 0 rgba(255,255,255,.4)',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Text', 'Inter', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
```

- [ ] **Step 3: Replace `src/app/globals.css` with monochrome design tokens**

Replace the entire file contents with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg:         #000000;
  --surface-0: #0a0a0a;
  --surface-1: #111111;
  --surface-2: #1a1a1a;
  --border:    #232323;
  --border-2:  #2e2e2e;
  --text-0:    #ffffff;
  --text-1:    #d4d4d4;
  --text-2:    #8a8a8a;
  --text-3:    #5a5a5a;
  --primary:   #ffffff;
  --primary-fg:#0a0a0a;
}

html, body {
  background: var(--bg);
  color: var(--text-0);
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif;
  -webkit-font-smoothing: antialiased;
}

* { box-sizing: border-box; }

/* Hide the Next.js dev overlay's outline when focusing buttons via mouse */
button:focus:not(:focus-visible) { outline: none; }
button:focus-visible {
  outline: 2px solid rgba(255,255,255,0.4);
  outline-offset: 2px;
  border-radius: 4px;
}

input:focus-visible {
  outline: none;
  border-color: rgba(255,255,255,0.25);
}
```

- [ ] **Step 4: Smoke-test the build**

```bash
cd prism
npm run typecheck
npm run build
```

Expected: both succeed without errors. (Build may complain that pages haven't been replaced yet — that's fine; we'll replace them in later tasks.)

- [ ] **Step 5: Commit**

```bash
cd /Users/user/Documents/AI-Projects/prism
git add -A
git commit -m "chore(prism): set up Tailwind tokens and globals.css for monochrome palette"
```

---

### Task 4: Configure Vitest + test infrastructure

**Files:**
- Create: `prism/vitest.config.ts`
- Create: `prism/src/test/setup.ts`
- Create: `prism/src/test/supabase-mock.ts`
- Create: `prism/src/test/factories.ts`
- Create: `prism/src/test/render.tsx`
- Create: `prism/src/test/__smoke__.test.ts` (one-off, removed after verification)

- [ ] **Step 1: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'tests/e2e/**'],
  },
})
```

- [ ] **Step 2: Create `src/test/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// Stub the env vars the supabase clients read at module load
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
```

- [ ] **Step 3: Create `src/test/factories.ts`**

```ts
import type { Project, ProjectStatus } from '@/types/project'

let counter = 0
function nextId() {
  counter += 1
  return `proj-${counter}`
}

export function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: nextId(),
    user_id: 'user-1',
    name: 'Test project',
    description: null,
    status: 'drafting' satisfies ProjectStatus,
    created_at: '2026-05-11T00:00:00.000Z',
    updated_at: '2026-05-11T00:00:00.000Z',
    ...overrides,
  }
}

export function makeUser(overrides: Partial<{ id: string; email: string }> = {}) {
  return {
    id: 'user-1',
    email: 'test@example.com',
    ...overrides,
  }
}
```

(`types/project.ts` is created in Task 10. Until then this file has a broken import — defer creating it until Task 10, or write it now with the import commented out. We'll create it in Step 6 below as a placeholder and uncomment after Task 10.)

- [ ] **Step 4: Create `src/test/supabase-mock.ts`**

Chainable mock factory — supports the methods we'll need in M1: `auth.getUser`, `auth.signUp`, `auth.signInWithPassword`, `auth.signOut`, and `from(table).select/insert/eq/single/maybeSingle/order/count`.

```ts
import { vi } from 'vitest'

type Result<T = unknown> = { data: T | null; error: { message: string } | null; count?: number }

export type SupabaseMock = ReturnType<typeof mockSupabaseClient>

export function mockSupabaseClient(opts: {
  user?: { id: string; email: string } | null
  fromHandlers?: Record<string, FromHandler>
  authHandlers?: Partial<AuthHandlers>
} = {}) {
  const auth: AuthHandlers = {
    getUser: vi.fn(async () => ({
      data: { user: opts.user ?? null },
      error: opts.user ? null : { message: 'Not authenticated' },
    })),
    signUp: vi.fn(async () => ({ data: { user: opts.user ?? null, session: {} }, error: null })),
    signInWithPassword: vi.fn(async () => ({ data: { user: opts.user ?? null, session: {} }, error: null })),
    signOut: vi.fn(async () => ({ error: null })),
    ...opts.authHandlers,
  }

  function from(table: string) {
    const handler = opts.fromHandlers?.[table]
    if (!handler) {
      // default: empty result
      return makeChain<unknown[]>({ data: [], error: null, count: 0 })
    }
    return handler()
  }

  return {
    auth,
    from: vi.fn(from),
  }
}

type AuthHandlers = {
  getUser: ReturnType<typeof vi.fn>
  signUp: ReturnType<typeof vi.fn>
  signInWithPassword: ReturnType<typeof vi.fn>
  signOut: ReturnType<typeof vi.fn>
}

type FromHandler = () => ChainStub

type ChainStub = {
  select: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  maybeSingle: ReturnType<typeof vi.fn>
  then: (resolve: (r: Result) => unknown) => Promise<unknown>
}

export function makeChain<T = unknown>(result: Result<T>): ChainStub {
  const self = {} as ChainStub
  const methods: (keyof ChainStub)[] = ['select', 'insert', 'update', 'delete', 'eq', 'order', 'limit']
  for (const m of methods) {
    self[m] = vi.fn(() => self) as ChainStub[typeof m]
  }
  self.single = vi.fn(async () => result) as ChainStub['single']
  self.maybeSingle = vi.fn(async () => result) as ChainStub['maybeSingle']
  self.then = (resolve) => Promise.resolve(result).then(resolve)
  return self
}
```

- [ ] **Step 5: Create `src/test/render.tsx`**

```tsx
import { render as rtlRender, type RenderOptions } from '@testing-library/react'
import { type ReactElement } from 'react'

export function render(ui: ReactElement, options?: RenderOptions) {
  return rtlRender(ui, options)
}

export * from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'
```

(Currently no providers — kept as a wrapper so when we add ones like dialog context, every test file gets them.)

- [ ] **Step 6: Stub `src/types/project.ts` so the factories compile**

Create `src/types/project.ts`:

```ts
export type ProjectStatus =
  | 'drafting'
  | 'clarifying'
  | 'compiling'
  | 'ready'
  | 'exported'

export interface Project {
  id: string
  user_id: string
  name: string
  description: string | null
  status: ProjectStatus
  created_at: string
  updated_at: string
}

export interface NewProjectInput {
  name: string
  description?: string
}
```

(This satisfies the import in `factories.ts`. The full file will not change in Task 10 — it's already complete. Task 10 just acknowledges this exists.)

- [ ] **Step 7: Write a smoke test to verify the harness**

Create `src/test/__smoke__.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { makeProject } from './factories'
import { mockSupabaseClient, makeChain } from './supabase-mock'

describe('test harness smoke', () => {
  it('factory produces a Project with sensible defaults', () => {
    const p = makeProject({ name: 'Custom' })
    expect(p.name).toBe('Custom')
    expect(p.status).toBe('drafting')
    expect(p.id).toMatch(/^proj-\d+$/)
  })

  it('supabase mock returns the seeded user', async () => {
    const client = mockSupabaseClient({ user: { id: 'u', email: 'a@b' } })
    const { data, error } = await client.auth.getUser()
    expect(error).toBeNull()
    expect(data.user).toEqual({ id: 'u', email: 'a@b' })
  })

  it('chain stub returns the seeded result', async () => {
    const chain = makeChain({ data: [{ id: 'p1' }], error: null, count: 1 })
    const result = await chain.select('*').eq('user_id', 'u').order('created_at')
    expect(result.data).toEqual([{ id: 'p1' }])
  })
})
```

- [ ] **Step 8: Run the smoke test**

```bash
cd prism
npm test
```

Expected: 3 tests pass.

- [ ] **Step 9: Delete the smoke test (it was a harness check, not a permanent test)**

```bash
rm src/test/__smoke__.test.ts
```

- [ ] **Step 10: Commit**

```bash
cd /Users/user/Documents/AI-Projects/prism
git add -A
git commit -m "test(prism): set up Vitest harness, Supabase mock factory, and test helpers"
```

---

### Task 5: Configure Playwright + E2E helpers

**Files:**
- Create: `prism/playwright.config.ts`
- Create: `prism/tests/e2e/helpers.ts`
- Create: `prism/tests/e2e/__smoke__.spec.ts` (one-off, removed after)

- [ ] **Step 1: Create `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // We touch shared Supabase auth state
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    actionTimeout: 10_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
```

- [ ] **Step 2: Create `tests/e2e/helpers.ts`**

Helpers that create unique test users via the public `auth.signUp` and clean them up via the service-role admin API in teardown.

```ts
import { createClient } from '@supabase/supabase-js'
import { test as base, expect, type Page } from '@playwright/test'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SERVICE_ROLE) {
  throw new Error('E2E helpers require NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env')
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
})

export type TestUser = {
  email: string
  password: string
  name: string
  id?: string
}

export function makeTestUser(prefix = 'e2e'): TestUser {
  const ts = Date.now()
  const rnd = Math.random().toString(36).slice(2, 8)
  return {
    email: `${prefix}+${ts}+${rnd}@prism.test`,
    password: 'TestPass123!',
    name: 'E2E Tester',
  }
}

export async function signUpInUI(page: Page, user: TestUser) {
  await page.goto('/signup')
  await page.getByLabel(/your name/i).fill(user.name)
  await page.getByLabel(/email/i).fill(user.email)
  await page.getByLabel(/password/i).fill(user.password)
  await page.getByRole('button', { name: /create account/i }).click()
  await page.waitForURL(/\/dashboard$/)
}

export async function signInInUI(page: Page, user: TestUser) {
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(user.email)
  await page.getByLabel(/password/i).fill(user.password)
  await page.getByRole('button', { name: /^sign in$/i }).click()
  await page.waitForURL(/\/dashboard$/)
}

export async function deleteTestUser(email: string) {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 })
  const found = list?.users.find((u) => u.email === email)
  if (found) {
    await admin.auth.admin.deleteUser(found.id)
  }
}

export const test = base.extend<{ testUser: TestUser }>({
  testUser: async ({}, use) => {
    const user = makeTestUser()
    await use(user)
    // Teardown — best-effort
    try { await deleteTestUser(user.email) } catch {}
  },
})

export { expect }
```

- [ ] **Step 3: Add a smoke E2E spec**

`tests/e2e/__smoke__.spec.ts`:

```ts
import { test, expect } from './helpers'

test('homepage redirects (smoke)', async ({ page }) => {
  const response = await page.goto('/')
  // Without auth, root should redirect to /login (after Task 30); for now,
  // we just verify the dev server responds with HTML.
  expect(response).not.toBeNull()
  await expect(page).toHaveURL(/(login|^\/$)/)
})
```

- [ ] **Step 4: Run Playwright smoke**

```bash
cd prism
npm run test:e2e
```

Expected: the smoke test passes (the home page may show Next.js boilerplate, that's OK — the assertion just checks the page loaded). If it fails because port 3000 is busy, kill the dev process and retry.

- [ ] **Step 5: Delete the smoke spec**

```bash
rm tests/e2e/__smoke__.spec.ts
```

- [ ] **Step 6: Commit**

```bash
cd /Users/user/Documents/AI-Projects/prism
git add -A
git commit -m "test(prism): set up Playwright config and E2E helpers with service-role cleanup"
```

---

### Task 6: `lib/utils.ts` (cn helper)

**Files:**
- Create: `prism/src/lib/utils.ts`
- Create: `prism/src/lib/utils.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/utils.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('joins truthy class names', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('skips falsy values', () => {
    expect(cn('a', false, undefined, null, '', 'b')).toBe('a b')
  })

  it('merges conflicting tailwind classes (last wins)', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })

  it('handles conditional objects', () => {
    expect(cn('base', { active: true, hidden: false })).toBe('base active')
  })
})
```

- [ ] **Step 2: Run the test, expect failure**

```bash
npx vitest run src/lib/utils.test.ts
```

Expected: FAIL — `./utils` not found.

- [ ] **Step 3: Implement `cn`**

`src/lib/utils.ts`:

```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 4: Run the test, expect pass**

```bash
npx vitest run src/lib/utils.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/user/Documents/AI-Projects/prism
git add -A
git commit -m "feat(prism): add cn() helper (clsx + tailwind-merge)"
```

---

### Task 7: Supabase browser + server clients

**Files:**
- Create: `prism/src/lib/supabase/client.ts`
- Create: `prism/src/lib/supabase/server.ts`
- Create: `prism/src/lib/supabase/client.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/supabase/client.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

vi.mock('@supabase/ssr', async () => {
  return {
    createBrowserClient: vi.fn(() => ({ __kind: 'browser-client' })),
    createServerClient: vi.fn(() => ({ __kind: 'server-client' })),
  }
})

// Mock next/headers; if not mocked, importing the server client throws in jsdom.
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    getAll: () => [],
    set: vi.fn(),
  })),
}))

describe('supabase clients', () => {
  it('createClient (browser) calls createBrowserClient with env vars', async () => {
    const { createBrowserClient } = await import('@supabase/ssr')
    const { createClient } = await import('./client')
    const client = createClient()
    expect((client as any).__kind).toBe('browser-client')
    expect(createBrowserClient).toHaveBeenCalledWith(
      'http://localhost:54321',
      'test-anon-key'
    )
  })

  it('createClient (server) calls createServerClient with env vars and cookies', async () => {
    const { createServerClient } = await import('@supabase/ssr')
    const { createClient } = await import('./server')
    const client = await createClient()
    expect((client as any).__kind).toBe('server-client')
    expect(createServerClient).toHaveBeenCalled()
    const [url, key, opts] = (createServerClient as any).mock.calls[0]
    expect(url).toBe('http://localhost:54321')
    expect(key).toBe('test-anon-key')
    expect(opts.cookies).toBeDefined()
  })
})
```

- [ ] **Step 2: Run, expect failure**

```bash
npx vitest run src/lib/supabase/client.test.ts
```

Expected: FAIL — files not yet created.

- [ ] **Step 3: Implement the browser client**

`src/lib/supabase/client.ts`:

```ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 4: Implement the server client**

`src/lib/supabase/server.ts`:

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a server component; can be ignored if middleware refreshes sessions.
          }
        },
      },
    }
  )
}
```

- [ ] **Step 5: Run tests, expect pass**

```bash
npx vitest run src/lib/supabase/client.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/user/Documents/AI-Projects/prism
git add -A
git commit -m "feat(prism): add Supabase browser and server client factories"
```

---

### Task 8: Middleware

**Files:**
- Create: `prism/src/middleware.ts`

(No unit test — the middleware imports `next/server` which is non-trivial to mock; E2E covers it in Task 33.)

- [ ] **Step 1: Implement the middleware**

`src/middleware.ts`:

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const AUTH_ROUTES = ['/login', '/signup']
const APP_ROUTES = ['/dashboard', '/project']

function isAuthRoute(path: string) {
  return AUTH_ROUTES.some((r) => path === r || path.startsWith(`${r}/`))
}

function isAppRoute(path: string) {
  return APP_ROUTES.some((r) => path === r || path.startsWith(`${r}/`))
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  if (!user && isAppRoute(path)) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (user && isAuthRoute(path)) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico
     * - auth/callback (OAuth)
     * - public assets (.svg, .png, .jpg etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

- [ ] **Step 2: Typecheck**

```bash
cd prism
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/user/Documents/AI-Projects/prism
git add -A
git commit -m "feat(prism): add auth middleware redirecting (auth) and (app) routes"
```

---

### Task 9: `lib/projects.ts` server helpers

**Files:**
- Create: `prism/src/lib/projects.ts`
- Create: `prism/src/lib/projects.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/projects.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mockSupabaseClient, makeChain } from '@/test/supabase-mock'
import { makeProject } from '@/test/factories'

vi.mock('@/lib/supabase/server')

import { createClient } from '@/lib/supabase/server'
import { getProjects, getProjectCount, getProjectById } from './projects'

const mocked = vi.mocked(createClient)

beforeEach(() => {
  mocked.mockReset()
})

describe('getProjects', () => {
  it('returns rows scoped by RLS (no explicit user_id filter)', async () => {
    const projects = [makeProject({ name: 'A' }), makeProject({ name: 'B' })]
    const client = mockSupabaseClient({
      user: { id: 'u', email: 'a@b' },
      fromHandlers: {
        projects: () => makeChain({ data: projects, error: null }),
      },
    })
    mocked.mockResolvedValue(client as any)

    const result = await getProjects()
    expect(result).toEqual(projects)
    expect(client.from).toHaveBeenCalledWith('projects')
  })

  it('throws when no user', async () => {
    const client = mockSupabaseClient({ user: null })
    mocked.mockResolvedValue(client as any)
    await expect(getProjects()).rejects.toThrow(/not authenticated/i)
  })

  it('throws when query errors', async () => {
    const client = mockSupabaseClient({
      user: { id: 'u', email: 'a@b' },
      fromHandlers: {
        projects: () => makeChain({ data: null, error: { message: 'boom' } }),
      },
    })
    mocked.mockResolvedValue(client as any)
    await expect(getProjects()).rejects.toThrow(/boom/)
  })
})

describe('getProjectCount', () => {
  it('returns the count', async () => {
    const client = mockSupabaseClient({
      user: { id: 'u', email: 'a@b' },
      fromHandlers: {
        projects: () => makeChain({ data: null, error: null, count: 3 }),
      },
    })
    mocked.mockResolvedValue(client as any)

    const count = await getProjectCount()
    expect(count).toBe(3)
  })

  it('returns 0 when count is null', async () => {
    const client = mockSupabaseClient({
      user: { id: 'u', email: 'a@b' },
      fromHandlers: {
        projects: () => makeChain({ data: null, error: null }),
      },
    })
    mocked.mockResolvedValue(client as any)
    expect(await getProjectCount()).toBe(0)
  })
})

describe('getProjectById', () => {
  it('returns project when found', async () => {
    const p = makeProject({ id: 'abc', name: 'X' })
    const client = mockSupabaseClient({
      user: { id: 'u', email: 'a@b' },
      fromHandlers: {
        projects: () => makeChain({ data: p, error: null }),
      },
    })
    mocked.mockResolvedValue(client as any)

    expect(await getProjectById('abc')).toEqual(p)
  })

  it('returns null when not found (PGRST116)', async () => {
    const client = mockSupabaseClient({
      user: { id: 'u', email: 'a@b' },
      fromHandlers: {
        projects: () => makeChain({ data: null, error: null }),
      },
    })
    mocked.mockResolvedValue(client as any)

    expect(await getProjectById('missing')).toBeNull()
  })
})
```

- [ ] **Step 2: Run, expect failure**

```bash
npx vitest run src/lib/projects.test.ts
```

Expected: FAIL — `./projects` not found.

- [ ] **Step 3: Implement the helpers**

`src/lib/projects.ts`:

```ts
import { createClient } from '@/lib/supabase/server'
import type { Project } from '@/types/project'

async function clientWithUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    throw new Error('Not authenticated')
  }
  return { supabase, user }
}

export async function getProjects(): Promise<Project[]> {
  const { supabase } = await clientWithUser()
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Project[]
}

export async function getProjectCount(): Promise<number> {
  const { supabase } = await clientWithUser()
  const { count, error } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true })
  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function getProjectById(id: string): Promise<Project | null> {
  const { supabase } = await clientWithUser()
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as Project) ?? null
}
```

- [ ] **Step 4: Run tests, expect pass**

```bash
npx vitest run src/lib/projects.test.ts
```

Expected: all tests pass. If `getProjectCount` test fails, it's likely because the chain stub doesn't pass through `count` — verify `makeChain` includes count in the returned result (it does per Task 4).

- [ ] **Step 5: Commit**

```bash
cd /Users/user/Documents/AI-Projects/prism
git add -A
git commit -m "feat(prism): add server-side project read helpers with RLS-scoped access"
```

---

### Task 10: `lib/actions/projects.ts` — `createProjectAction`

**Files:**
- Create: `prism/src/lib/actions/projects.ts`
- Create: `prism/src/lib/actions/projects.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/actions/projects.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mockSupabaseClient, makeChain } from '@/test/supabase-mock'
import { makeProject } from '@/test/factories'

vi.mock('@/lib/supabase/server')
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => { throw new Error(`NEXT_REDIRECT:${url}`) }),
  revalidatePath: vi.fn(),
}))
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createProjectAction } from './projects'

const mocked = vi.mocked(createClient)
const mockedRedirect = vi.mocked(redirect)
const mockedRevalidate = vi.mocked(revalidatePath)

beforeEach(() => {
  mocked.mockReset()
  mockedRedirect.mockClear()
  mockedRevalidate.mockClear()
})

describe('createProjectAction', () => {
  it('inserts a project then revalidates and redirects', async () => {
    const created = makeProject({ id: 'new-id', name: 'My project' })
    const insertChain = makeChain({ data: created, error: null })
    const client = mockSupabaseClient({
      user: { id: 'u', email: 'a@b' },
      fromHandlers: { projects: () => insertChain },
    })
    mocked.mockResolvedValue(client as any)

    await expect(createProjectAction({ name: 'My project' })).rejects.toThrow(/NEXT_REDIRECT:\/project\/new-id/)
    expect(insertChain.insert).toHaveBeenCalledWith({
      name: 'My project',
      description: null,
      user_id: 'u',
    })
    expect(mockedRevalidate).toHaveBeenCalledWith('/', 'layout')
  })

  it('rejects empty name', async () => {
    await expect(createProjectAction({ name: '   ' })).rejects.toThrow(/name is required/i)
  })

  it('rejects name longer than 100 chars', async () => {
    const long = 'x'.repeat(101)
    await expect(createProjectAction({ name: long })).rejects.toThrow(/100/)
  })

  it('passes description when provided', async () => {
    const created = makeProject({ id: 'p2' })
    const insertChain = makeChain({ data: created, error: null })
    const client = mockSupabaseClient({
      user: { id: 'u', email: 'a@b' },
      fromHandlers: { projects: () => insertChain },
    })
    mocked.mockResolvedValue(client as any)

    await expect(createProjectAction({ name: 'X', description: 'desc' })).rejects.toThrow(/NEXT_REDIRECT/)
    expect(insertChain.insert).toHaveBeenCalledWith({
      name: 'X',
      description: 'desc',
      user_id: 'u',
    })
  })

  it('throws Not authenticated when no user', async () => {
    const client = mockSupabaseClient({ user: null })
    mocked.mockResolvedValue(client as any)
    await expect(createProjectAction({ name: 'X' })).rejects.toThrow(/not authenticated/i)
  })

  it('surfaces Supabase insert error', async () => {
    const insertChain = makeChain({ data: null, error: { message: 'permission denied' } })
    const client = mockSupabaseClient({
      user: { id: 'u', email: 'a@b' },
      fromHandlers: { projects: () => insertChain },
    })
    mocked.mockResolvedValue(client as any)

    await expect(createProjectAction({ name: 'X' })).rejects.toThrow(/permission denied/)
  })
})
```

- [ ] **Step 2: Run, expect failure**

```bash
npx vitest run src/lib/actions/projects.test.ts
```

Expected: FAIL — `./projects` not found.

- [ ] **Step 3: Implement the action**

`src/lib/actions/projects.ts`:

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { NewProjectInput } from '@/types/project'

const MAX_NAME = 100

export async function createProjectAction(input: NewProjectInput): Promise<never> {
  const name = (input.name ?? '').trim()
  const description = (input.description ?? '').trim() || null

  if (!name) {
    throw new Error('Project name is required')
  }
  if (name.length > MAX_NAME) {
    throw new Error(`Project name must be at most ${MAX_NAME} characters`)
  }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new Error('Not authenticated')
  }

  const { data, error } = await supabase
    .from('projects')
    .insert({ name, description, user_id: user.id })
    .select()
    .single()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Project creation returned no row')

  revalidatePath('/', 'layout')
  redirect(`/project/${data.id}`)
}
```

- [ ] **Step 4: Run tests, expect pass**

```bash
npx vitest run src/lib/actions/projects.test.ts
```

Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/user/Documents/AI-Projects/prism
git add -A
git commit -m "feat(prism): add createProjectAction server action with validation and RLS-scoped insert"
```

---

### Task 11: UI primitive — `Logo`

**Files:**
- Create: `prism/src/components/ui/Logo.tsx`
- Create: `prism/src/components/ui/Logo.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/components/ui/Logo.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render } from '@/test/render'
import { Logo } from './Logo'

describe('Logo', () => {
  it('renders an svg with a role of img and accessible label', () => {
    render(<Logo />)
    const img = document.querySelector('svg[role="img"]')
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('aria-label', 'Prism')
  })

  it('respects the size prop', () => {
    const { container } = render(<Logo size={40} />)
    const svg = container.querySelector('svg')!
    expect(svg).toHaveAttribute('width', '40')
    expect(svg).toHaveAttribute('height', '40')
  })
})
```

- [ ] **Step 2: Run, expect failure**

```bash
npx vitest run src/components/ui/Logo.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement Logo**

`src/components/ui/Logo.tsx`:

```tsx
type LogoProps = {
  size?: number
  className?: string
}

export function Logo({ size = 18, className }: LogoProps) {
  return (
    <svg
      role="img"
      aria-label="Prism"
      width={size}
      height={size}
      viewBox="0 0 18 18"
      className={className}
    >
      <defs>
        <clipPath id="prism-clip">
          <rect width="18" height="18" rx="5" />
        </clipPath>
      </defs>
      <g clipPath="url(#prism-clip)">
        <rect width="18" height="18" fill="#ffffff" />
        <polygon points="18,0 18,18 0,18" fill="#2a2a2a" />
      </g>
      <rect
        x="0.5"
        y="0.5"
        width="17"
        height="17"
        rx="4.5"
        fill="none"
        stroke="rgba(255,255,255,0.1)"
      />
    </svg>
  )
}
```

- [ ] **Step 4: Run, expect pass**

```bash
npx vitest run src/components/ui/Logo.test.tsx
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/user/Documents/AI-Projects/prism
git add -A
git commit -m "feat(prism): add Logo SVG component"
```

---

### Task 12: UI primitive — `StatusDot`

**Files:**
- Create: `prism/src/components/ui/StatusDot.tsx`
- Create: `prism/src/components/ui/StatusDot.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/components/ui/StatusDot.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@/test/render'
import { StatusDot } from './StatusDot'
import type { ProjectStatus } from '@/types/project'

const STATUSES: ProjectStatus[] = ['drafting', 'clarifying', 'compiling', 'ready', 'exported']

describe('StatusDot', () => {
  it.each(STATUSES)('renders %s with accessible label', (status) => {
    render(<StatusDot status={status} />)
    expect(screen.getByLabelText(new RegExp(`status: ${status}`, 'i'))).toBeInTheDocument()
  })

  it('applies ready glow class', () => {
    const { container } = render(<StatusDot status="ready" />)
    const dot = container.firstChild as HTMLElement
    expect(dot.className).toContain('shadow')
  })
})
```

- [ ] **Step 2: Run, expect failure**

```bash
npx vitest run src/components/ui/StatusDot.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement StatusDot**

`src/components/ui/StatusDot.tsx`:

```tsx
import { cn } from '@/lib/utils'
import type { ProjectStatus } from '@/types/project'

const styles: Record<ProjectStatus, string> = {
  drafting: 'bg-text-3',
  clarifying: 'bg-text-1',
  compiling: 'bg-text-1',
  ready: 'bg-text-0 shadow-[0_0_8px_rgba(255,255,255,0.4)]',
  exported: 'bg-text-0 ring-2 ring-text-3',
}

const LABELS: Record<ProjectStatus, string> = {
  drafting: 'Status: drafting',
  clarifying: 'Status: clarifying',
  compiling: 'Status: compiling',
  ready: 'Status: ready',
  exported: 'Status: exported',
}

export function StatusDot({ status, className }: { status: ProjectStatus; className?: string }) {
  return (
    <span
      role="img"
      aria-label={LABELS[status]}
      className={cn(
        'inline-block w-1.5 h-1.5 rounded-full flex-shrink-0',
        styles[status],
        className
      )}
    />
  )
}
```

- [ ] **Step 4: Run, expect pass**

```bash
npx vitest run src/components/ui/StatusDot.test.tsx
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/user/Documents/AI-Projects/prism
git add -A
git commit -m "feat(prism): add StatusDot with intensity-based monochrome states"
```

---

### Task 13: UI primitive — `Button`

**Files:**
- Create: `prism/src/components/ui/Button.tsx`
- Create: `prism/src/components/ui/Button.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/components/ui/Button.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen, userEvent } from '@/test/render'
import { Button } from './Button'

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument()
  })

  it('applies primary variant by default', () => {
    render(<Button>X</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-primary')
  })

  it('applies secondary variant when requested', () => {
    render(<Button variant="secondary">X</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-surface-2')
  })

  it('applies ghost variant when requested', () => {
    render(<Button variant="ghost">X</Button>)
    const btn = screen.getByRole('button')
    expect(btn).toHaveClass('bg-transparent')
  })

  it('forwards onClick', async () => {
    const handler = vi.fn()
    render(<Button onClick={handler}>X</Button>)
    await userEvent.click(screen.getByRole('button'))
    expect(handler).toHaveBeenCalledOnce()
  })

  it('disables when disabled prop set', () => {
    render(<Button disabled>X</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('forwards type prop (default button)', () => {
    render(<Button>X</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })

  it('honors explicit type=submit', () => {
    render(<Button type="submit">X</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit')
  })
})
```

- [ ] **Step 2: Run, expect failure**

```bash
npx vitest run src/components/ui/Button.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement Button**

`src/components/ui/Button.tsx`:

```tsx
'use client'
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost'

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-primary-fg shadow-md hover:opacity-95 active:opacity-90 shadow-inset-pri',
  secondary:
    'bg-surface-2 text-text-1 border border-border-2 shadow-sm hover:bg-surface-1',
  ghost:
    'bg-transparent text-text-2 hover:text-text-0 hover:bg-surface-2',
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', type = 'button', children, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        variantStyles[variant],
        className
      )}
      {...rest}
    >
      {children}
    </button>
  )
})
```

- [ ] **Step 4: Run, expect pass**

```bash
npx vitest run src/components/ui/Button.test.tsx
```

Expected: 8 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/user/Documents/AI-Projects/prism
git add -A
git commit -m "feat(prism): add Button primitive with primary/secondary/ghost variants"
```

---

### Task 14: Component — `AuthCard`

**Files:**
- Create: `prism/src/components/auth/AuthCard.tsx`
- Create: `prism/src/components/auth/AuthCard.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/components/auth/AuthCard.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@/test/render'
import { AuthCard } from './AuthCard'

describe('AuthCard', () => {
  it('renders the logo, wordmark, title, subtitle, and children', () => {
    render(
      <AuthCard title="Welcome back" subtitle="Sign in to your workspace">
        <div data-testid="form">form contents</div>
      </AuthCard>
    )
    expect(screen.getByLabelText('Prism')).toBeInTheDocument()
    expect(screen.getByText('Prism')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
    expect(screen.getByText(/sign in to your workspace/i)).toBeInTheDocument()
    expect(screen.getByTestId('form')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run, expect failure**

```bash
npx vitest run src/components/auth/AuthCard.test.tsx
```

- [ ] **Step 3: Implement AuthCard**

`src/components/auth/AuthCard.tsx`:

```tsx
import { Logo } from '@/components/ui/Logo'
import type { ReactNode } from 'react'

export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-6">
      <div className="w-full max-w-sm p-7 bg-surface-1 rounded-2xl border border-border shadow-lg">
        <div className="flex items-center gap-2.5 mb-4">
          <Logo size={18} />
          <span className="font-semibold text-text-0">Prism</span>
        </div>
        <h1 className="text-lg font-semibold text-text-0 tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-text-2 mt-1">{subtitle}</p>}
        <div className="mt-5">{children}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run, expect pass**

```bash
npx vitest run src/components/auth/AuthCard.test.tsx
```

- [ ] **Step 5: Commit**

```bash
cd /Users/user/Documents/AI-Projects/prism
git add -A
git commit -m "feat(prism): add AuthCard shell for login/signup pages"
```

---

### Task 15: Component — `SignInForm`

**Files:**
- Create: `prism/src/components/auth/SignInForm.tsx`
- Create: `prism/src/components/auth/SignInForm.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/components/auth/SignInForm.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, userEvent } from '@/test/render'
import { mockSupabaseClient } from '@/test/supabase-mock'

vi.mock('@/lib/supabase/client')

const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
}))

import { createClient } from '@/lib/supabase/client'
import { SignInForm } from './SignInForm'

const mocked = vi.mocked(createClient)

beforeEach(() => {
  mocked.mockReset()
  pushMock.mockReset()
})

describe('SignInForm', () => {
  it('renders email + password inputs and a sign-in button', () => {
    mocked.mockReturnValue(mockSupabaseClient() as any)
    render(<SignInForm />)
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument()
  })

  it('signs in and navigates to /dashboard on success', async () => {
    const client = mockSupabaseClient({ user: { id: 'u', email: 'a@b' } })
    mocked.mockReturnValue(client as any)
    render(<SignInForm />)
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /^sign in$/i }))
    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'password123',
    })
    expect(pushMock).toHaveBeenCalledWith('/dashboard')
  })

  it('shows inline error on bad credentials', async () => {
    const client = mockSupabaseClient({
      authHandlers: {
        signInWithPassword: vi.fn(async () => ({
          data: { user: null, session: null },
          error: { message: 'Invalid login credentials' },
        })),
      },
    })
    mocked.mockReturnValue(client as any)
    render(<SignInForm />)
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: /^sign in$/i }))
    expect(await screen.findByText(/email or password is incorrect/i)).toBeInTheDocument()
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('disables button while submitting', async () => {
    let resolveFn!: (v: any) => void
    const client = mockSupabaseClient({
      authHandlers: {
        signInWithPassword: vi.fn(() => new Promise((res) => { resolveFn = res })),
      },
    })
    mocked.mockReturnValue(client as any)
    render(<SignInForm />)
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'password123')
    const btn = screen.getByRole('button', { name: /^sign in$/i })
    await userEvent.click(btn)
    expect(btn).toBeDisabled()
    resolveFn({ data: { user: { id: 'u' } }, error: null })
  })

  it('links to /signup', () => {
    mocked.mockReturnValue(mockSupabaseClient() as any)
    render(<SignInForm />)
    expect(screen.getByRole('link', { name: /create one/i })).toHaveAttribute('href', '/signup')
  })
})
```

- [ ] **Step 2: Run, expect failure**

```bash
npx vitest run src/components/auth/SignInForm.test.tsx
```

- [ ] **Step 3: Implement SignInForm**

`src/components/auth/SignInForm.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'

function friendlyAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'Email or password is incorrect.'
  if (/rate limit/i.test(message)) return 'Too many attempts. Wait a minute and try again.'
  if (/network/i.test(message)) return "Couldn't connect. Check your network and try again."
  return message
}

export function SignInForm() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) {
        setError(friendlyAuthError(err.message))
        return
      }
      router.push('/dashboard')
    } catch (err) {
      setError(friendlyAuthError((err as Error).message))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate>
      <div>
        <label htmlFor="email" className="sr-only">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-describedby={error ? 'signin-error' : undefined}
          className="w-full px-3 py-2.5 bg-surface-2 border border-border-2 rounded-lg text-text-0 placeholder:text-text-3 text-sm shadow-inner"
        />
      </div>
      <div>
        <label htmlFor="password" className="sr-only">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-describedby={error ? 'signin-error' : undefined}
          className="w-full px-3 py-2.5 bg-surface-2 border border-border-2 rounded-lg text-text-0 placeholder:text-text-3 text-sm shadow-inner"
        />
      </div>
      {error && (
        <p id="signin-error" role="alert" className="text-xs text-text-1">
          {error}
        </p>
      )}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Signing in…' : 'Sign in'}
      </Button>
      <div className="flex items-center gap-2 py-2">
        <span className="flex-1 h-px bg-border" />
        <span className="text-[10px] tracking-widest text-text-3 uppercase">or</span>
        <span className="flex-1 h-px bg-border" />
      </div>
      <Button variant="secondary" disabled className="w-full">
        Continue with Google <span className="text-text-3 font-normal">(soon)</span>
      </Button>
      <p className="text-xs text-text-2 text-center mt-3">
        No account?{' '}
        <Link href="/signup" className="text-text-0 underline underline-offset-2">
          Create one
        </Link>
      </p>
    </form>
  )
}
```

- [ ] **Step 4: Run, expect pass**

```bash
npx vitest run src/components/auth/SignInForm.test.tsx
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/user/Documents/AI-Projects/prism
git add -A
git commit -m "feat(prism): add SignInForm with inline error handling and submit loading state"
```

---

### Task 16: Component — `SignUpForm`

**Files:**
- Create: `prism/src/components/auth/SignUpForm.tsx`
- Create: `prism/src/components/auth/SignUpForm.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/components/auth/SignUpForm.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, userEvent } from '@/test/render'
import { mockSupabaseClient } from '@/test/supabase-mock'

vi.mock('@/lib/supabase/client')

const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
}))

import { createClient } from '@/lib/supabase/client'
import { SignUpForm } from './SignUpForm'

const mocked = vi.mocked(createClient)

beforeEach(() => {
  mocked.mockReset()
  pushMock.mockReset()
})

describe('SignUpForm', () => {
  it('renders name, email, password inputs and create-account button', () => {
    mocked.mockReturnValue(mockSupabaseClient() as any)
    render(<SignUpForm />)
    expect(screen.getByLabelText(/your name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
  })

  it('passes display_name in signUp metadata and navigates on success', async () => {
    const client = mockSupabaseClient({ user: { id: 'u', email: 'a@b' } })
    mocked.mockReturnValue(client as any)
    render(<SignUpForm />)
    await userEvent.type(screen.getByLabelText(/your name/i), 'Amit')
    await userEvent.type(screen.getByLabelText(/email/i), 'amit@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'StrongPass1')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(client.auth.signUp).toHaveBeenCalledWith({
      email: 'amit@example.com',
      password: 'StrongPass1',
      options: { data: { display_name: 'Amit' } },
    })
    expect(pushMock).toHaveBeenCalledWith('/dashboard')
  })

  it('shows existing-email error', async () => {
    const client = mockSupabaseClient({
      authHandlers: {
        signUp: vi.fn(async () => ({
          data: { user: null, session: null },
          error: { message: 'User already registered' },
        })),
      },
    })
    mocked.mockReturnValue(client as any)
    render(<SignUpForm />)
    await userEvent.type(screen.getByLabelText(/your name/i), 'Amit')
    await userEvent.type(screen.getByLabelText(/email/i), 'taken@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'StrongPass1')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByText(/account with this email already exists/i)).toBeInTheDocument()
  })

  it('shows weak-password error', async () => {
    const client = mockSupabaseClient({
      authHandlers: {
        signUp: vi.fn(async () => ({
          data: { user: null, session: null },
          error: { message: 'Password should be at least 8 characters' },
        })),
      },
    })
    mocked.mockReturnValue(client as any)
    render(<SignUpForm />)
    await userEvent.type(screen.getByLabelText(/your name/i), 'Amit')
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'short')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument()
  })

  it('links to /login', () => {
    mocked.mockReturnValue(mockSupabaseClient() as any)
    render(<SignUpForm />)
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login')
  })
})
```

- [ ] **Step 2: Run, expect failure**

```bash
npx vitest run src/components/auth/SignUpForm.test.tsx
```

- [ ] **Step 3: Implement SignUpForm**

`src/components/auth/SignUpForm.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'

function friendlySignupError(message: string): string {
  if (/already registered/i.test(message)) return 'An account with this email already exists. Sign in instead.'
  if (/at least 8/i.test(message)) return 'Password must be at least 8 characters.'
  if (/rate limit/i.test(message)) return 'Too many attempts. Wait a minute and try again.'
  if (/network/i.test(message)) return "Couldn't connect. Check your network and try again."
  return message
}

export function SignUpForm() {
  const router = useRouter()
  const supabase = createClient()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: name.trim() } },
      })
      if (err) {
        setError(friendlySignupError(err.message))
        return
      }
      router.push('/dashboard')
    } catch (err) {
      setError(friendlySignupError((err as Error).message))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate>
      <div>
        <label htmlFor="name" className="sr-only">Your name</label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          required
          maxLength={80}
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2.5 bg-surface-2 border border-border-2 rounded-lg text-text-0 placeholder:text-text-3 text-sm shadow-inner"
        />
      </div>
      <div>
        <label htmlFor="email" className="sr-only">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-describedby={error ? 'signup-error' : undefined}
          className="w-full px-3 py-2.5 bg-surface-2 border border-border-2 rounded-lg text-text-0 placeholder:text-text-3 text-sm shadow-inner"
        />
      </div>
      <div>
        <label htmlFor="password" className="sr-only">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="Password (min 8 chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-describedby={error ? 'signup-error' : undefined}
          className="w-full px-3 py-2.5 bg-surface-2 border border-border-2 rounded-lg text-text-0 placeholder:text-text-3 text-sm shadow-inner"
        />
      </div>
      {error && (
        <p id="signup-error" role="alert" className="text-xs text-text-1">
          {error}
        </p>
      )}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Creating account…' : 'Create account'}
      </Button>
      <div className="flex items-center gap-2 py-2">
        <span className="flex-1 h-px bg-border" />
        <span className="text-[10px] tracking-widest text-text-3 uppercase">or</span>
        <span className="flex-1 h-px bg-border" />
      </div>
      <Button variant="secondary" disabled className="w-full">
        Continue with Google <span className="text-text-3 font-normal">(soon)</span>
      </Button>
      <p className="text-xs text-text-2 text-center mt-3">
        Already have an account?{' '}
        <Link href="/login" className="text-text-0 underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </form>
  )
}
```

- [ ] **Step 4: Run, expect pass**

```bash
npx vitest run src/components/auth/SignUpForm.test.tsx
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/user/Documents/AI-Projects/prism
git add -A
git commit -m "feat(prism): add SignUpForm with display_name metadata and friendly errors"
```

---

### Task 17: Component — `ProjectRow`

**Files:**
- Create: `prism/src/components/dashboard/ProjectRow.tsx`
- Create: `prism/src/components/dashboard/ProjectRow.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/components/dashboard/ProjectRow.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@/test/render'
import { ProjectRow } from './ProjectRow'
import { makeProject } from '@/test/factories'

vi.mock('next/navigation', () => ({
  usePathname: () => '/project/proj-1',
}))

describe('ProjectRow', () => {
  it('renders project name, status, and link to its page', () => {
    const p = makeProject({ id: 'proj-1', name: 'Inventory', status: 'clarifying' })
    render(<ProjectRow project={p} />)
    expect(screen.getByRole('link', { name: /inventory/i })).toHaveAttribute('href', '/project/proj-1')
    expect(screen.getByLabelText(/status: clarifying/i)).toBeInTheDocument()
  })

  it('marks itself current when pathname matches', () => {
    const p = makeProject({ id: 'proj-1', name: 'Inventory' })
    render(<ProjectRow project={p} />)
    expect(screen.getByRole('link')).toHaveAttribute('aria-current', 'page')
  })

  it('does not mark current when pathname does not match', () => {
    const p = makeProject({ id: 'proj-2', name: 'Other' })
    render(<ProjectRow project={p} />)
    expect(screen.getByRole('link')).not.toHaveAttribute('aria-current')
  })

  it('truncates long names visually (class present)', () => {
    const p = makeProject({ id: 'proj-2', name: 'A'.repeat(80) })
    render(<ProjectRow project={p} />)
    expect(screen.getByText('A'.repeat(80))).toHaveClass('truncate')
  })
})
```

- [ ] **Step 2: Run, expect failure**

```bash
npx vitest run src/components/dashboard/ProjectRow.test.tsx
```

- [ ] **Step 3: Implement ProjectRow**

`src/components/dashboard/ProjectRow.tsx`:

```tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { StatusDot } from '@/components/ui/StatusDot'
import { cn } from '@/lib/utils'
import type { Project } from '@/types/project'

export function ProjectRow({ project }: { project: Project }) {
  const pathname = usePathname()
  const active = pathname?.includes(project.id) ?? false

  return (
    <Link
      href={`/project/${project.id}`}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors',
        active
          ? 'bg-surface-2 text-text-0 shadow-sm'
          : 'text-text-1 hover:bg-surface-2 hover:text-text-0'
      )}
    >
      <StatusDot status={project.status} />
      <span className="truncate">{project.name}</span>
    </Link>
  )
}
```

- [ ] **Step 4: Run, expect pass**

```bash
npx vitest run src/components/dashboard/ProjectRow.test.tsx
```

- [ ] **Step 5: Commit**

```bash
cd /Users/user/Documents/AI-Projects/prism
git add -A
git commit -m "feat(prism): add ProjectRow with active state and truncated name"
```

---

### Task 18: Component — `NewProjectDialog` + provider/context

**Files:**
- Create: `prism/src/components/dashboard/NewProjectDialogProvider.tsx`
- Create: `prism/src/components/dashboard/NewProjectDialog.tsx`
- Create: `prism/src/components/dashboard/NewProjectButton.tsx`
- Create: `prism/src/components/dashboard/NewProjectDialog.test.tsx`

This task combines the three files because they form one unit.

- [ ] **Step 1: Write the failing test**

`src/components/dashboard/NewProjectDialog.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, userEvent } from '@/test/render'

vi.mock('@/lib/actions/projects', () => ({
  createProjectAction: vi.fn(),
}))

import { createProjectAction } from '@/lib/actions/projects'
import { NewProjectDialogProvider } from './NewProjectDialogProvider'
import { NewProjectButton } from './NewProjectButton'

const mocked = vi.mocked(createProjectAction)

beforeEach(() => {
  mocked.mockReset()
})

function setup() {
  return render(
    <NewProjectDialogProvider>
      <NewProjectButton />
    </NewProjectDialogProvider>
  )
}

describe('NewProjectDialog', () => {
  it('opens when the trigger button is clicked', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /new project/i }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText(/project name/i)).toHaveFocus()
  })

  it('disables submit when name is empty', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /new project/i }))
    const submit = screen.getByRole('button', { name: /create & start/i })
    expect(submit).toBeDisabled()
    await userEvent.type(screen.getByLabelText(/project name/i), 'X')
    expect(submit).toBeEnabled()
  })

  it('calls createProjectAction with name and optional description', async () => {
    mocked.mockImplementation(() => { throw new Error('NEXT_REDIRECT:/project/abc') })
    setup()
    await userEvent.click(screen.getByRole('button', { name: /new project/i }))
    await userEvent.type(screen.getByLabelText(/project name/i), 'Inventory')
    await userEvent.type(screen.getByLabelText(/description/i), 'tracking stuff')
    await userEvent.click(screen.getByRole('button', { name: /create & start/i }))
    // The action threw a redirect — that's expected; we just verify the call args
    expect(mocked).toHaveBeenCalledWith({
      name: 'Inventory',
      description: 'tracking stuff',
    })
  })

  it('shows inline error when action throws non-redirect', async () => {
    mocked.mockRejectedValue(new Error('permission denied'))
    setup()
    await userEvent.click(screen.getByRole('button', { name: /new project/i }))
    await userEvent.type(screen.getByLabelText(/project name/i), 'X')
    await userEvent.click(screen.getByRole('button', { name: /create & start/i }))
    expect(await screen.findByText(/couldn't create project/i)).toBeInTheDocument()
    // dialog should still be open
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('closes on cancel', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /new project/i }))
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run, expect failure**

```bash
npx vitest run src/components/dashboard/NewProjectDialog.test.tsx
```

- [ ] **Step 3: Implement the provider**

`src/components/dashboard/NewProjectDialogProvider.tsx`:

```tsx
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
```

- [ ] **Step 4: Implement the dialog**

`src/components/dashboard/NewProjectDialog.tsx`:

```tsx
'use client'
import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useNewProjectDialog } from './NewProjectDialogProvider'
import { createProjectAction } from '@/lib/actions/projects'
import { Button } from '@/components/ui/Button'

export function NewProjectDialog() {
  const { isOpen, close } = useNewProjectDialog()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const trimmedName = name.trim()
  const canSubmit = trimmedName.length > 0 && trimmedName.length <= 100 && !submitting

  function reset() {
    setName('')
    setDescription('')
    setError(null)
    setSubmitting(false)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      await createProjectAction({
        name: trimmedName,
        description: description.trim() || undefined,
      })
      // redirect() throws — code below this line only runs if it didn't
      reset()
      close()
    } catch (err) {
      const msg = (err as Error).message ?? ''
      // Next.js redirect throws with the digest "NEXT_REDIRECT" — let it bubble up
      if (msg.includes('NEXT_REDIRECT')) {
        throw err
      }
      setError("Couldn't create project. Try again.")
      setSubmitting(false)
    }
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={(v) => (v ? null : (reset(), close()))}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] max-w-[90vw] bg-surface-0 border border-border-2 rounded-xl p-5 shadow-lg"
          onOpenAutoFocus={(e) => {
            // Focus the name input rather than the close button
            e.preventDefault()
            requestAnimationFrame(() => {
              document.getElementById('new-project-name')?.focus()
            })
          }}
        >
          <Dialog.Title className="text-sm font-semibold text-text-0 mb-3">
            New project
          </Dialog.Title>
          <Dialog.Description className="sr-only">
            Enter a name and optional description for your new project.
          </Dialog.Description>
          <form onSubmit={onSubmit} className="space-y-2">
            <div>
              <label htmlFor="new-project-name" className="sr-only">Project name</label>
              <input
                id="new-project-name"
                name="name"
                type="text"
                required
                maxLength={100}
                placeholder="Project name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-describedby={error ? 'new-project-error' : undefined}
                className="w-full px-3 py-2 bg-surface-2 border border-border-2 rounded-md text-sm text-text-0 placeholder:text-text-3 shadow-inner"
              />
            </div>
            <div>
              <label htmlFor="new-project-description" className="sr-only">Description (optional)</label>
              <input
                id="new-project-description"
                name="description"
                type="text"
                placeholder="One-line description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 bg-surface-2 border border-border-2 rounded-md text-sm text-text-0 placeholder:text-text-3 shadow-inner"
              />
            </div>
            {error && (
              <p id="new-project-error" role="alert" className="text-xs text-text-1">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => { reset(); close() }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {submitting ? 'Creating…' : 'Create & start'}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
```

- [ ] **Step 5: Implement the trigger button**

`src/components/dashboard/NewProjectButton.tsx`:

```tsx
'use client'
import { useNewProjectDialog } from './NewProjectDialogProvider'
import { Button } from '@/components/ui/Button'

export function NewProjectButton() {
  const { open } = useNewProjectDialog()
  return (
    <Button onClick={open} className="w-full">
      <span aria-hidden>+</span> New Project
    </Button>
  )
}
```

- [ ] **Step 6: Run tests, expect pass**

```bash
npx vitest run src/components/dashboard/NewProjectDialog.test.tsx
```

Expected: 5 tests pass.

- [ ] **Step 7: Commit**

```bash
cd /Users/user/Documents/AI-Projects/prism
git add -A
git commit -m "feat(prism): add NewProjectDialog with provider/context and trigger button"
```

---

### Task 19: Component — `SignOutButton`

**Files:**
- Create: `prism/src/components/dashboard/SignOutButton.tsx`
- Create: `prism/src/components/dashboard/SignOutButton.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/components/dashboard/SignOutButton.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, userEvent } from '@/test/render'
import { mockSupabaseClient } from '@/test/supabase-mock'

vi.mock('@/lib/supabase/client')

const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
}))

import { createClient } from '@/lib/supabase/client'
import { SignOutButton } from './SignOutButton'

const mocked = vi.mocked(createClient)

beforeEach(() => {
  mocked.mockReset()
  pushMock.mockReset()
})

describe('SignOutButton', () => {
  it('signs out and navigates to /login', async () => {
    const client = mockSupabaseClient()
    mocked.mockReturnValue(client as any)
    render(<SignOutButton />)
    await userEvent.click(screen.getByRole('button', { name: /sign out/i }))
    expect(client.auth.signOut).toHaveBeenCalled()
    expect(pushMock).toHaveBeenCalledWith('/login')
  })

  it('still navigates even if signOut errors', async () => {
    const client = mockSupabaseClient({
      authHandlers: {
        signOut: vi.fn(async () => ({ error: { message: 'boom' } })),
      },
    })
    mocked.mockReturnValue(client as any)
    render(<SignOutButton />)
    await userEvent.click(screen.getByRole('button', { name: /sign out/i }))
    expect(pushMock).toHaveBeenCalledWith('/login')
  })
})
```

- [ ] **Step 2: Run, expect failure**

```bash
npx vitest run src/components/dashboard/SignOutButton.test.tsx
```

- [ ] **Step 3: Implement SignOutButton**

`src/components/dashboard/SignOutButton.tsx`:

```tsx
'use client'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function SignOutButton() {
  const router = useRouter()
  const supabase = createClient()

  async function onClick() {
    try {
      await supabase.auth.signOut()
    } finally {
      router.push('/login')
    }
  }

  return (
    <button
      onClick={onClick}
      className="w-full text-left text-text-2 hover:text-text-0 text-xs px-3 py-2 rounded-md hover:bg-surface-2 transition-colors"
    >
      Sign out
    </button>
  )
}
```

- [ ] **Step 4: Run, expect pass**

```bash
npx vitest run src/components/dashboard/SignOutButton.test.tsx
```

- [ ] **Step 5: Commit**

```bash
cd /Users/user/Documents/AI-Projects/prism
git add -A
git commit -m "feat(prism): add SignOutButton that survives signOut errors"
```

---

### Task 20: Component — `ProjectSidebar`

**Files:**
- Create: `prism/src/components/dashboard/ProjectSidebar.tsx`
- Create: `prism/src/components/dashboard/ProjectSidebar.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/components/dashboard/ProjectSidebar.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@/test/render'
import { makeProject } from '@/test/factories'
import { ProjectSidebar } from './ProjectSidebar'
import { NewProjectDialogProvider } from './NewProjectDialogProvider'

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signOut: vi.fn(async () => ({ error: null })) } }),
}))

function renderWithProvider(ui: React.ReactElement) {
  return render(<NewProjectDialogProvider>{ui}</NewProjectDialogProvider>)
}

describe('ProjectSidebar', () => {
  it('renders the logo, wordmark, New Project button, and sign out', () => {
    renderWithProvider(<ProjectSidebar projects={[]} />)
    expect(screen.getByLabelText('Prism')).toBeInTheDocument()
    expect(screen.getByText('Prism')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /new project/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
  })

  it('shows empty message when no projects', () => {
    renderWithProvider(<ProjectSidebar projects={[]} />)
    expect(screen.getByText(/no projects yet/i)).toBeInTheDocument()
  })

  it('renders one ProjectRow per project', () => {
    const projects = [
      makeProject({ id: 'a', name: 'Alpha' }),
      makeProject({ id: 'b', name: 'Beta' }),
    ]
    renderWithProvider(<ProjectSidebar projects={projects} />)
    expect(screen.getByRole('link', { name: /alpha/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /beta/i })).toBeInTheDocument()
  })

  it('has a nav landmark labeled "Projects"', () => {
    renderWithProvider(<ProjectSidebar projects={[]} />)
    expect(screen.getByRole('navigation', { name: /projects/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run, expect failure**

```bash
npx vitest run src/components/dashboard/ProjectSidebar.test.tsx
```

- [ ] **Step 3: Implement ProjectSidebar**

`src/components/dashboard/ProjectSidebar.tsx`:

```tsx
'use client'
import { Logo } from '@/components/ui/Logo'
import { ProjectRow } from './ProjectRow'
import { NewProjectButton } from './NewProjectButton'
import { SignOutButton } from './SignOutButton'
import type { Project } from '@/types/project'

export function ProjectSidebar({ projects }: { projects: Project[] }) {
  return (
    <aside className="w-64 h-full bg-surface-1 border-r border-border flex flex-col">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2.5">
        <Logo size={18} />
        <span className="font-semibold text-text-0 text-sm">Prism</span>
      </div>

      <div className="p-3">
        <NewProjectButton />
      </div>

      <nav aria-label="Projects" className="flex-1 overflow-y-auto px-2.5 pb-2 space-y-0.5">
        {projects.length === 0 ? (
          <p className="text-text-3 text-xs text-center py-6 leading-relaxed">
            No projects yet.
            <br />
            Create one to start.
          </p>
        ) : (
          projects.map((p) => <ProjectRow key={p.id} project={p} />)
        )}
      </nav>

      <div className="p-2 border-t border-border">
        <SignOutButton />
      </div>
    </aside>
  )
}
```

- [ ] **Step 4: Run, expect pass**

```bash
npx vitest run src/components/dashboard/ProjectSidebar.test.tsx
```

- [ ] **Step 5: Commit**

```bash
cd /Users/user/Documents/AI-Projects/prism
git add -A
git commit -m "feat(prism): add ProjectSidebar with nav landmark and empty state"
```

---

### Task 21: Components — `WelcomeScreen` and `EmptyState`

**Files:**
- Create: `prism/src/components/dashboard/WelcomeScreen.tsx`
- Create: `prism/src/components/dashboard/WelcomeScreen.test.tsx`
- Create: `prism/src/components/dashboard/EmptyState.tsx`
- Create: `prism/src/components/dashboard/EmptyState.test.tsx`

- [ ] **Step 1: Write the failing test for WelcomeScreen**

`src/components/dashboard/WelcomeScreen.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen, userEvent } from '@/test/render'
import { WelcomeScreen } from './WelcomeScreen'
import { NewProjectDialogProvider } from './NewProjectDialogProvider'

vi.mock('@/lib/actions/projects', () => ({ createProjectAction: vi.fn() }))

function setup() {
  return render(
    <NewProjectDialogProvider>
      <WelcomeScreen />
    </NewProjectDialogProvider>
  )
}

describe('WelcomeScreen', () => {
  it('renders heading, three step cards, and CTA', () => {
    setup()
    expect(screen.getByRole('heading', { name: /welcome to prism/i })).toBeInTheDocument()
    expect(screen.getByText(/01 \/ describe/i)).toBeInTheDocument()
    expect(screen.getByText(/02 \/ refine/i)).toBeInTheDocument()
    expect(screen.getByText(/03 \/ export/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create your first project/i })).toBeInTheDocument()
  })

  it('opens the new-project dialog when CTA is clicked', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /create your first project/i }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run, expect failure**

```bash
npx vitest run src/components/dashboard/WelcomeScreen.test.tsx
```

- [ ] **Step 3: Implement WelcomeScreen**

`src/components/dashboard/WelcomeScreen.tsx`:

```tsx
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
              <div className="font-mono text-[10px] font-semibold text-text-3 tracking-wider">
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
```

- [ ] **Step 4: Run, expect pass**

```bash
npx vitest run src/components/dashboard/WelcomeScreen.test.tsx
```

- [ ] **Step 5: Write the failing test for EmptyState**

`src/components/dashboard/EmptyState.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@/test/render'
import { EmptyState } from './EmptyState'

describe('EmptyState', () => {
  it('renders the headline and helper text', () => {
    render(<EmptyState />)
    expect(screen.getByText(/select a project/i)).toBeInTheDocument()
    expect(screen.getByText(/export to any llm/i)).toBeInTheDocument()
  })

  it('renders the optional error banner when prop is set', () => {
    render(<EmptyState error="Couldn't load" />)
    expect(screen.getByText(/couldn't load/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Run, expect failure**

```bash
npx vitest run src/components/dashboard/EmptyState.test.tsx
```

- [ ] **Step 7: Implement EmptyState**

`src/components/dashboard/EmptyState.tsx`:

```tsx
export function EmptyState({ error }: { error?: string }) {
  return (
    <div className="flex items-center justify-center min-h-full p-6 text-center">
      <div>
        <h2 className="text-base font-semibold text-text-0">
          Select a project or create a new one
        </h2>
        <p className="text-xs text-text-2 mt-1.5">
          Define your project once. Export to any LLM.
        </p>
        {error && (
          <p role="alert" className="mt-4 text-xs text-text-1 bg-surface-1 border border-border-2 rounded-md px-3 py-2">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Run, expect pass**

```bash
npx vitest run src/components/dashboard/EmptyState.test.tsx
```

- [ ] **Step 9: Commit**

```bash
cd /Users/user/Documents/AI-Projects/prism
git add -A
git commit -m "feat(prism): add WelcomeScreen with first-run hero and EmptyState"
```

---

### Task 22: Root layout + redirector + auth callback

**Files:**
- Replace: `prism/src/app/layout.tsx`
- Replace: `prism/src/app/page.tsx`
- Create: `prism/src/app/auth/callback/route.ts`

- [ ] **Step 1: Replace `src/app/layout.tsx`**

```tsx
import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Prism',
  description: 'Define your project once. Export context to any LLM.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-bg text-text-0">{children}</body>
    </html>
  )
}
```

- [ ] **Step 2: Replace `src/app/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  redirect(user ? '/dashboard' : '/login')
}
```

- [ ] **Step 3: Create the OAuth callback route**

`src/app/auth/callback/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }
  return NextResponse.redirect(`${origin}/dashboard`)
}
```

- [ ] **Step 4: Delete any leftover create-next-app boilerplate**

Specifically remove `src/app/page.module.css` if it exists (we wrote a new page.tsx that doesn't import it).

```bash
cd prism
rm -f src/app/page.module.css
```

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/user/Documents/AI-Projects/prism
git add -A
git commit -m "feat(prism): replace boilerplate with auth-aware root redirector + OAuth callback route"
```

---

### Task 23: `(auth)` layout, `/login` page, `/signup` page

**Files:**
- Create: `prism/src/app/(auth)/layout.tsx`
- Create: `prism/src/app/(auth)/login/page.tsx`
- Create: `prism/src/app/(auth)/signup/page.tsx`

- [ ] **Step 1: Create the auth layout**

`src/app/(auth)/layout.tsx`:

```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
```

(The `AuthCard` component already provides centering; the layout is a passthrough.)

- [ ] **Step 2: Create `/login` page**

`src/app/(auth)/login/page.tsx`:

```tsx
import { AuthCard } from '@/components/auth/AuthCard'
import { SignInForm } from '@/components/auth/SignInForm'

export default function LoginPage() {
  return (
    <AuthCard title="Welcome back" subtitle="Sign in to your workspace">
      <SignInForm />
    </AuthCard>
  )
}
```

- [ ] **Step 3: Create `/signup` page**

`src/app/(auth)/signup/page.tsx`:

```tsx
import { AuthCard } from '@/components/auth/AuthCard'
import { SignUpForm } from '@/components/auth/SignUpForm'

export default function SignupPage() {
  return (
    <AuthCard title="Create your account" subtitle="Start building with Prism">
      <SignUpForm />
    </AuthCard>
  )
}
```

- [ ] **Step 4: Manual smoke test**

```bash
cd prism
npm run dev
```

Open http://localhost:3000/login and http://localhost:3000/signup in the browser. Verify:
- Both render the monochrome card with logo, title, form
- "Continue with Google (soon)" button is rendered and disabled
- Link at the bottom navigates between login and signup

Press Ctrl-C to stop the dev server.

- [ ] **Step 5: Commit**

```bash
cd /Users/user/Documents/AI-Projects/prism
git add -A
git commit -m "feat(prism): wire up /login and /signup pages using AuthCard + forms"
```

---

### Task 24: `(app)` layout — sidebar shell + dialog provider

**Files:**
- Create: `prism/src/app/(app)/layout.tsx`

- [ ] **Step 1: Create the (app) layout**

`src/app/(app)/layout.tsx`:

```tsx
import { ProjectSidebar } from '@/components/dashboard/ProjectSidebar'
import { NewProjectDialogProvider } from '@/components/dashboard/NewProjectDialogProvider'
import { getProjects } from '@/lib/projects'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let projects = [] as Awaited<ReturnType<typeof getProjects>>
  try {
    projects = await getProjects()
  } catch {
    // If RLS or auth fails here, middleware will redirect to /login on next nav;
    // for now render with empty list so the shell still draws.
    projects = []
  }

  return (
    <NewProjectDialogProvider>
      <div className="flex h-screen bg-bg">
        <ProjectSidebar projects={projects} />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </NewProjectDialogProvider>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
cd prism
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
cd /Users/user/Documents/AI-Projects/prism
git add -A
git commit -m "feat(prism): add (app) layout fetching projects server-side and mounting dialog provider"
```

---

### Task 25: `/dashboard` server component

**Files:**
- Create: `prism/src/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Create the dashboard page**

`src/app/(app)/dashboard/page.tsx`:

```tsx
import { WelcomeScreen } from '@/components/dashboard/WelcomeScreen'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { getProjectCount } from '@/lib/projects'

export default async function DashboardPage() {
  try {
    const count = await getProjectCount()
    return count === 0 ? <WelcomeScreen /> : <EmptyState />
  } catch {
    // Avoid showing first-run UX to someone who already has projects
    return <EmptyState error="Couldn't load your projects. Please refresh." />
  }
}
```

- [ ] **Step 2: Manual smoke test**

```bash
cd prism
npm run dev
```

Manually:
1. Sign up at http://localhost:3000/signup with a test account
2. Verify redirect to `/dashboard` shows the WelcomeScreen
3. Click "Create your first project" → modal opens
4. Enter a name → submit → page navigates to `/project/<id>` (will 404 until Task 26 wires the stub)
5. Press Ctrl-C

- [ ] **Step 3: Commit**

```bash
cd /Users/user/Documents/AI-Projects/prism
git add -A
git commit -m "feat(prism): add dashboard page with Welcome vs EmptyState branching"
```

---

### Task 26: `/project/[id]` M1 stub

**Files:**
- Create: `prism/src/app/(app)/project/[id]/page.tsx`

- [ ] **Step 1: Create the stub**

`src/app/(app)/project/[id]/page.tsx`:

```tsx
import Link from 'next/link'
import { getProjectById } from '@/lib/projects'

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

  return (
    <div className="flex items-center justify-center min-h-full p-8 text-center">
      <div>
        <h1 className="text-xl font-semibold text-text-0 tracking-tight">{project.name}</h1>
        {project.description && (
          <p className="text-sm text-text-2 mt-1.5 max-w-md mx-auto">{project.description}</p>
        )}
        <p className="mt-6 text-xs text-text-3 max-w-sm mx-auto leading-relaxed">
          Chat coming in M2. Your project is saved and will pick up here once we wire the
          intake screen.
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck and smoke**

```bash
cd prism
npm run typecheck
npm run build
```

Expected: clean build.

- [ ] **Step 3: Commit**

```bash
cd /Users/user/Documents/AI-Projects/prism
git add -A
git commit -m "feat(prism): add /project/[id] M1 stub page with Not-Found fallback"
```

---

### Task 27: E2E — `auth-guard.spec.ts`

**Files:**
- Create: `prism/tests/e2e/auth-guard.spec.ts`

- [ ] **Step 1: Write the E2E spec**

`tests/e2e/auth-guard.spec.ts`:

```ts
import { test, expect, signUpInUI } from './helpers'

test.describe('Auth guard', () => {
  test('unauthenticated /dashboard redirects to /login', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('unauthenticated /project/anything redirects to /login', async ({ page }) => {
    await page.goto('/project/some-id')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('authenticated /login redirects to /dashboard', async ({ page, testUser }) => {
    await signUpInUI(page, testUser)
    await page.goto('/login')
    await expect(page).toHaveURL(/\/dashboard$/)
  })

  test('authenticated /signup redirects to /dashboard', async ({ page, testUser }) => {
    await signUpInUI(page, testUser)
    await page.goto('/signup')
    await expect(page).toHaveURL(/\/dashboard$/)
  })
})
```

- [ ] **Step 2: Run the spec**

```bash
cd prism
npm run test:e2e -- auth-guard
```

Expected: 4 tests pass. (The dev server starts automatically via `webServer` in playwright.config.ts.)

- [ ] **Step 3: Commit**

```bash
cd /Users/user/Documents/AI-Projects/prism
git add -A
git commit -m "test(prism): add E2E auth-guard spec"
```

---

### Task 28: E2E — `signout.spec.ts`

**Files:**
- Create: `prism/tests/e2e/signout.spec.ts`

- [ ] **Step 1: Write the spec**

`tests/e2e/signout.spec.ts`:

```ts
import { test, expect, signUpInUI } from './helpers'

test('signs out and prevents back-navigation to dashboard', async ({ page, testUser }) => {
  await signUpInUI(page, testUser)
  await expect(page).toHaveURL(/\/dashboard$/)

  await page.getByRole('button', { name: /sign out/i }).click()
  await expect(page).toHaveURL(/\/login$/)

  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login$/)
})
```

- [ ] **Step 2: Run**

```bash
cd prism
npm run test:e2e -- signout
```

- [ ] **Step 3: Commit**

```bash
cd /Users/user/Documents/AI-Projects/prism
git add -A
git commit -m "test(prism): add E2E signout spec"
```

---

### Task 29: E2E — `login.spec.ts`

**Files:**
- Create: `prism/tests/e2e/login.spec.ts`

- [ ] **Step 1: Write the spec**

`tests/e2e/login.spec.ts`:

```ts
import { test, expect, signUpInUI, signInInUI } from './helpers'

test('existing user signs in and sees EmptyState (not Welcome) after creating a project', async ({ page, testUser }) => {
  // Seed: signup, create a project, sign out
  await signUpInUI(page, testUser)
  await page.getByRole('button', { name: /create your first project/i }).click()
  await page.getByLabel(/project name/i).fill('Seeded project')
  await page.getByRole('button', { name: /create & start/i }).click()
  await page.waitForURL(/\/project\//)
  await page.getByRole('button', { name: /sign out/i }).click()

  // Sign back in
  await signInInUI(page, testUser)
  // EmptyState should show, not Welcome
  await expect(page.getByText(/select a project/i)).toBeVisible()
  await expect(page.getByRole('heading', { name: /welcome to prism/i })).toHaveCount(0)
  // Project should be in sidebar
  await expect(page.getByRole('link', { name: /seeded project/i })).toBeVisible()
})

test('login form shows inline error on wrong password', async ({ page, testUser }) => {
  await signUpInUI(page, testUser)
  await page.getByRole('button', { name: /sign out/i }).click()

  await page.goto('/login')
  await page.getByLabel(/email/i).fill(testUser.email)
  await page.getByLabel(/password/i).fill('wrongpassword!!')
  await page.getByRole('button', { name: /^sign in$/i }).click()
  await expect(page.getByText(/email or password is incorrect/i)).toBeVisible()
})
```

- [ ] **Step 2: Run**

```bash
cd prism
npm run test:e2e -- login
```

- [ ] **Step 3: Commit**

```bash
cd /Users/user/Documents/AI-Projects/prism
git add -A
git commit -m "test(prism): add E2E login spec"
```

---

### Task 30: E2E — `auth-onboarding.spec.ts`

**Files:**
- Create: `prism/tests/e2e/auth-onboarding.spec.ts`

- [ ] **Step 1: Write the spec**

`tests/e2e/auth-onboarding.spec.ts`:

```ts
import { test, expect } from './helpers'
import { makeTestUser, deleteTestUser } from './helpers'

test('full signup → welcome → modal create → project page', async ({ page }) => {
  const user = makeTestUser('e2e-onboarding')

  try {
    // Signup
    await page.goto('/signup')
    await page.getByLabel(/your name/i).fill(user.name)
    await page.getByLabel(/email/i).fill(user.email)
    await page.getByLabel(/password/i).fill(user.password)
    await page.getByRole('button', { name: /create account/i }).click()

    // Welcome screen
    await expect(page.getByRole('heading', { name: /welcome to prism/i })).toBeVisible()
    await expect(page.getByText(/01 \/ describe/i)).toBeVisible()
    await expect(page.getByText(/02 \/ refine/i)).toBeVisible()
    await expect(page.getByText(/03 \/ export/i)).toBeVisible()

    // CTA → dialog
    await page.getByRole('button', { name: /create your first project/i }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel(/project name/i)).toBeFocused()

    // Fill and submit
    await dialog.getByLabel(/project name/i).fill('My first project')
    await dialog.getByLabel(/one-line description/i).fill('Just trying it out')
    await dialog.getByRole('button', { name: /create & start/i }).click()

    // Lands on project page
    await page.waitForURL(/\/project\/[^/]+$/)
    await expect(page.getByRole('heading', { name: 'My first project' })).toBeVisible()
    await expect(page.getByText(/just trying it out/i)).toBeVisible()

    // Sidebar shows the new row, marked active
    const row = page.getByRole('link', { name: /my first project/i })
    await expect(row).toBeVisible()
    await expect(row).toHaveAttribute('aria-current', 'page')
  } finally {
    await deleteTestUser(user.email).catch(() => {})
  }
})
```

- [ ] **Step 2: Run**

```bash
cd prism
npm run test:e2e -- auth-onboarding
```

- [ ] **Step 3: Run the full E2E suite to make sure nothing regressed**

```bash
npm run test:e2e
```

Expected: all 4 specs pass.

- [ ] **Step 4: Commit**

```bash
cd /Users/user/Documents/AI-Projects/prism
git add -A
git commit -m "test(prism): add E2E auth-onboarding spec covering signup → welcome → create project"
```

---

### Task 31: Accessibility audit via `@axe-core/playwright`

**Files:**
- Create: `prism/tests/e2e/a11y.spec.ts`

- [ ] **Step 1: Write the audit spec**

`tests/e2e/a11y.spec.ts`:

```ts
import AxeBuilder from '@axe-core/playwright'
import { test, expect, signUpInUI } from './helpers'

test.describe('Accessibility — no serious/critical violations', () => {
  test('/login', async ({ page }) => {
    await page.goto('/login')
    const results = await new AxeBuilder({ page })
      .disableRules(['region']) // landmark "region" rule is overly noisy for full-page cards
      .analyze()
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('/signup', async ({ page }) => {
    await page.goto('/signup')
    const results = await new AxeBuilder({ page }).disableRules(['region']).analyze()
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('/dashboard (welcome)', async ({ page, testUser }) => {
    await signUpInUI(page, testUser)
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('/project/[id]', async ({ page, testUser }) => {
    await signUpInUI(page, testUser)
    await page.getByRole('button', { name: /create your first project/i }).click()
    await page.getByLabel(/project name/i).fill('A11y project')
    await page.getByRole('button', { name: /create & start/i }).click()
    await page.waitForURL(/\/project\//)
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })
})
```

- [ ] **Step 2: Run**

```bash
cd prism
npm run test:e2e -- a11y
```

Expected: all four specs pass. If a real serious/critical violation is reported, fix the underlying component before continuing. The test output will name the rule and selector.

- [ ] **Step 3: Commit**

```bash
cd /Users/user/Documents/AI-Projects/prism
git add -A
git commit -m "test(prism): add axe-core a11y audit specs for all M1 routes"
```

---

### Task 32: Rewrite `Docs/10-ui-ux-guidelines.md` to match the monochrome system

**Files:**
- Replace: `Docs/10-ui-ux-guidelines.md` (at the repo root, NOT inside `prism/`)

The current `Docs/10` mandates a blue-accent palette and color-coded status dots. The M1 build uses a different system; the doc must be updated so M2–M5 don't re-introduce blue.

- [ ] **Step 1: Replace `Docs/10-ui-ux-guidelines.md`**

Replace the **entire** file contents with the following:

````markdown
# 10 — UI/UX Guidelines

## Core Design Principles

- **Monochrome.** Black surfaces, dark-gray cards, white text. No color accents except for explicit semantic uses (none in M1).
- **Shadows do the work.** Three layers — inset highlight, ambient drop, far drop — replace color for depth and hierarchy.
- **Minimal.** Every element earns its place. No decorative gradients, no glow effects except `status: ready`.
- **Status is always visible** via the `<StatusDot>` component (intensity-based — see below).
- **Confidence is always shown** via `<Badge>` components in later milestones (M3+).

---

## Color Tokens (CSS variables)

Defined in `src/app/globals.css`. Tailwind references these via `tailwind.config.ts`.

```
--bg:         #000000  page background
--surface-0: #0a0a0a  modal / highest surface
--surface-1: #111111  card / sidebar
--surface-2: #1a1a1a  inputs / nested rows / active row bg
--border:    #232323  hairline
--border-2:  #2e2e2e  stronger hairline (focus rings, inputs)
--text-0:    #ffffff  primary text
--text-1:    #d4d4d4  secondary text (form errors, paragraph body)
--text-2:    #8a8a8a  tertiary text (subtitles, hints)
--text-3:    #5a5a5a  decorative — dots, dividers, numerals.
                      Do NOT use for body text — fails AA on #000.
--primary:   #ffffff  primary CTA background
--primary-fg:#0a0a0a  primary CTA foreground
```

**Verified contrast (WCAG):**
- `--text-0` on `--bg` = 21:1 (AAA)
- `--text-1` on `--surface-1` = 11.4:1 (AAA)
- `--text-2` on `--surface-1` = 5.4:1 (AA Normal)
- `--text-3` on `--bg` = 3.06:1 — **decorative only**

---

## Shadow Tokens

```css
--shadow-sm:   0 1px 2px rgba(0,0,0,.6);
--shadow-md:   0 4px 12px rgba(0,0,0,.55), 0 1px 2px rgba(0,0,0,.6);
--shadow-lg:   0 16px 48px rgba(0,0,0,.65), 0 4px 12px rgba(0,0,0,.4);
--shadow-inset:     inset 0 1px 0 rgba(255,255,255,.04);
--shadow-inset-pri: inset 0 1px 0 rgba(255,255,255,.4);
```

**Usage:**
- Buttons (primary): `shadow-md + shadow-inset-pri`
- Cards: `shadow-md + shadow-inset`
- Inputs (inset shadow inward): inline `shadow-inner`
- Modals: `shadow-lg + shadow-inset` over a `backdrop-blur-sm` overlay

---

## Status Dot Semantics (intensity, not hue)

The `<StatusDot>` component (`src/components/ui/StatusDot.tsx`) renders a tiny circle whose fill encodes status. Always paired with `aria-label="Status: <name>"`.

| Status | Fill | Extra |
|---|---|---|
| drafting | `--text-3` | — |
| clarifying | `--text-1` | — |
| compiling | `--text-1` | (will pulse later) |
| ready | `--text-0` | `box-shadow: 0 0 8px rgba(255,255,255,.4)` |
| exported | `--text-0` | `ring-2 ring-text-3` |

---

## Component Library Overview (M1 components — extended in later milestones)

- `<Button variant="primary | secondary | ghost">` — variants in `src/components/ui/Button.tsx`. Primary is white-on-black; secondary is dark-gray on slightly darker bg; ghost is text-only hover.
- `<AuthCard title subtitle>` — centered card frame with logo + wordmark for `/login` and `/signup`.
- `<StatusDot status>` — see above.
- `<Logo size={n}>` — monochrome SVG mark (`src/components/ui/Logo.tsx`). Default size 18.
- `<ProjectSidebar projects={...}>` — sidebar shell; receives projects as a prop.
- `<NewProjectDialogProvider>` / `<NewProjectDialog>` — hoisted dialog instance. Use `useNewProjectDialog()` to open from any descendant.
- `<WelcomeScreen>` — first-run hero. Uses `<NewProjectDialogProvider>` context to open the create-project dialog.
- `<EmptyState error?>` — main-area placeholder for users with projects but none selected.

---

## Chat UI: Chatscope

Chatscope is **not** in M1. From M2 onward, all chat UI uses Chatscope as-is.

When Chatscope is introduced:
- Theme via CSS variables ONLY in `globals.css`:
  ```css
  :root {
    --cs-bg-message-incoming: #1a1a1a;
    --cs-bg-message-outgoing: #ffffff;
    --cs-color-message-outgoing: #0a0a0a;
    --cs-bg-input: #111111;
    --cs-border-color: #232323;
  }
  ```
- Components using Chatscope must include `'use client'` (does not SSR).
- Do NOT replace `<Message>`, `<MessageList>`, `<MessageInput>`, `<TypingIndicator>` with custom equivalents.

---

## Page Layouts

### `(auth)` pages (`/login`, `/signup`)

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                                                             │
│                  ┌────────────────────────┐                 │
│                  │ ◾ Prism                 │                 │
│                  │                        │                 │
│                  │ Welcome back           │                 │
│                  │ Sign in to your...     │                 │
│                  │                        │                 │
│                  │ [ Email           ]    │                 │
│                  │ [ Password        ]    │                 │
│                  │ [    Sign in       ]   │                 │
│                  │   — or —               │                 │
│                  │ [ Continue with G  ]   │  (disabled)     │
│                  │ No account? Create one │                 │
│                  └────────────────────────┘                 │
│                                                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### `(app)` shell

```
┌─ Sidebar (264px) ─┬─ Main ────────────────────────────────┐
│  ◾ Prism           │                                        │
│  ───────           │                                        │
│  [+ New Project]   │  WelcomeScreen, EmptyState, or         │
│                    │  Project page                          │
│  Projects:         │                                        │
│   ▸ Alpha   ●      │                                        │
│   ▸ Beta    ●      │                                        │
│  ───────           │                                        │
│  Sign out          │                                        │
└────────────────────┴────────────────────────────────────────┘
```

### Dashboard — Welcome (count=0)

Centered hero with logo, title, three step cards, and white CTA pill.

### Dashboard — EmptyState (count≥1)

Centered "Select a project or create a new one" + helper line.

---

## Loading / Error / Empty States

**Loading buttons** — submit buttons disable + change label to `…` suffix (e.g. "Signing in…").

**Inline errors** — appear directly below the form, NOT toasts.

```tsx
<p role="alert" className="text-xs text-text-1">{error}</p>
```

**Empty states** — small heading + helper line + (when actionable) a button.

---

## Accessibility Baseline

- Every form input has a `<label>` (or `aria-label`/`sr-only`)
- Errors associated via `aria-describedby` → input announces on focus
- Dialogs (Radix) handle focus trap + ESC + return-focus
- `<StatusDot>` carries `aria-label="Status: ..."`
- `<nav aria-label="Projects">` on sidebar; active row gets `aria-current="page"`
- Color is never the sole carrier of information (status uses intensity + label)
- All M1 routes audited via `@axe-core/playwright` against the `serious` and `critical` levels — zero violations allowed.
````

- [ ] **Step 2: Verify nothing else references the old palette**

```bash
grep -rn 'blue-600\|blue-500\|gray-900\|gray-950' Docs/ 2>/dev/null
```

Expected: only matches inside `Docs/05–09` example code blocks (the milestone docs include outdated `className=`s). Those will be refreshed when their respective milestones are implemented. Do NOT mass-edit them now — that's M2–M5 work.

- [ ] **Step 3: Commit**

```bash
cd /Users/user/Documents/AI-Projects/prism
git add -A
git commit -m "docs: rewrite UI/UX guidelines to match monochrome system shipped in M1"
```

---

### Task 33: Final verification + done-criteria checklist

This task does no new coding — it runs the entire verification sweep before declaring M1 complete.

- [ ] **Step 1: Lint and typecheck**

```bash
cd prism
npm run lint
npm run typecheck
```

Expected: both clean.

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: clean production build.

- [ ] **Step 3: Run unit/component tests**

```bash
npm test
```

Expected: all suites pass.

- [ ] **Step 4: Run E2E**

```bash
npm run test:e2e
```

Expected: all 5 specs pass (auth-guard, signout, login, auth-onboarding, a11y).

- [ ] **Step 5: Done-criteria checklist**

Walk this list manually against the running dev server (`npm run dev`):

- [ ] `npm run dev` boots cleanly with no warnings
- [ ] `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e` all pass
- [ ] A new user can: visit `/signup` → create account → see Welcome → click CTA → fill modal → land on `/project/[id]` with sidebar showing the new row, active
- [ ] An existing user with ≥1 projects sees `EmptyState`, not Welcome
- [ ] Unauth → `/dashboard` redirects to `/login`; auth → `/login` redirects to `/dashboard`
- [ ] Sign out lands on `/login`; protected routes inaccessible after
- [ ] All forms have inline errors for: existing email, wrong password, weak password, empty fields
- [ ] axe-core reports no serious/critical violations on `/login`, `/signup`, `/dashboard`, `/project/[id]`
- [ ] `Docs/10-ui-ux-guidelines.md` is rewritten to match the monochrome system

- [ ] **Step 6: Tag the M1 release commit**

```bash
cd /Users/user/Documents/AI-Projects/prism
git tag -a m1 -m "Prism M1 — Auth + Dashboard complete"
git log --oneline | head -20
```

Expected: a list of granular commits from M1, with the `m1` tag on the latest.

- [ ] **Step 7: Update top-level CLAUDE.md to reflect that M1 ships actual code**

Open `/Users/user/Documents/AI-Projects/prism/CLAUDE.md` and replace the first section ("Repository State") with:

```markdown
## Repository State

The product name is **Prism**. M1 (Auth + Dashboard) is implemented under `prism/`. The `Docs/` folder remains the planning source; `prism/` contains the actual Next.js codebase. Milestones M2–M5 are still spec-only and will be designed/planned/implemented one at a time.

See `prism/README.md` for dev commands and `docs/superpowers/specs/` + `docs/superpowers/plans/` for active specs and plans.
```

Commit:

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md to reflect that M1 has shipped"
```

---

## Self-Review

The plan was checked against the spec section by section:

**Spec coverage:**
- §2 Decisions: every decision has an implementation task or config step. Email confirm disabled → Task 1; Server Action → Task 10; Modal flow → Task 18; Monochrome palette → Task 3 + Task 32.
- §3 Architecture & routing: middleware Task 8; route groups Tasks 23, 24; welcome detection Task 25.
- §4 File layout: every file in the file-structure tables is created in a numbered task.
- §5 Design system: tokens in Task 3 (Tailwind + globals.css); component-level usage in Tasks 11–21.
- §6 Data flow: auth Tasks 15, 16, 19; sidebar/welcome Tasks 20, 21, 24, 25; create action + dialog Tasks 10 + 18; dialog hoisting Task 18 (provider).
- §7 Errors: covered in form tests (Tasks 15, 16) and dialog tests (Task 18); validation rules embedded in implementation code.
- §7.5 Accessibility: Task 31 axe-core audit gates M1 completion.
- §8 Testing strategy: unit/component throughout, E2E specs Tasks 27–30, axe-core Task 31.
- §9 Implementation order: all 17 spec-listed steps map to tasks; expanded into 33 fine-grained tasks.
- §10 Done criteria: explicit checklist in Task 33.
- §11 Deviations: each deviation has its implementation task (signup form 16, welcome 21, monochrome 3+32, server action 10, modal 18).

**Placeholder scan:** No "TBD" / "TODO" / "implement appropriate X" remain. Every code block is complete and the engineer can copy-paste each one.

**Type consistency:** `Project`, `ProjectStatus`, and `NewProjectInput` defined in Task 4 (Step 6) and used identically across Tasks 9, 10, 17, 18, 20. `createProjectAction` signature `({ name, description? }) → Promise<never>` consistent in Tasks 10 and 18. `useNewProjectDialog()` shape `{ open, close, isOpen }` consistent across Tasks 18, 20, 21.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-11-prism-m1-auth-dashboard.md`. Two execution options:

1. **Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

Which approach?
