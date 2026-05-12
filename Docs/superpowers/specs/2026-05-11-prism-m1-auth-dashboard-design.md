# Prism — M1 Design Spec: Auth + Dashboard

**Date:** 2026-05-11
**Milestone:** 1 of 5
**Status:** Approved (awaiting review)
**Implementation location:** `prism/` (Next.js 14 App Router project, created by `create-next-app`)

---

## 1. Goal

A user can sign up, sign in, see a first-run welcome screen, create a named project via a modal, and land on a project page with the new project visible in the sidebar. No AI features yet. Pure foundation that every later milestone (M2–M5) builds on.

This spec supersedes `Docs/05-milestone-1-auth-dashboard.md` where they differ. Differences are explicit in §11.

---

## 2. Key decisions (resolved during brainstorming)

| Decision | Choice | Why |
|---|---|---|
| Auth providers in M1 | Email/password only | Avoid Google OAuth setup overhead; ship faster. Google button rendered but disabled with "(soon)". |
| Email confirmation | Disabled in Supabase | Faster signup → session immediately; no inbox required for dev/test. Re-enable later. |
| Onboarding scope | `/signup` route + first-run welcome screen | Both added on top of original spec. |
| Welcome screen detection | Server-side count of `projects` for the user | No new schema; computed from facts. If a user re-zeros their projects, welcome reappears (acceptable). |
| New-project UX | Modal asking for name + optional description (Option B) | Named from row 1; pairs with the welcome CTA; uses Radix Dialog already in deps. |
| Color palette | Monochrome (black / dark gray / white) with multi-layer shadows | Replaces `Docs/10` blue accents. `Docs/10` will be rewritten to match before M2. |
| Project creation backend | Server Action (`createProjectAction`) | Keeps RLS + user_id server-side; one-step `revalidatePath` + `redirect`. |
| Sidebar data flow | Server `(app)/layout.tsx` fetches, passes to client `<ProjectSidebar>` as props | Simpler contract than the spec's `useEffect`+`onCreated` callback. |
| Test framework | Vitest + React Testing Library + Playwright (Chromium) | Modern, fast, good Next.js fit. |
| E2E backend | Same dev Supabase project, unique `e2e+${ts}@prism.test` users, service-role cleanup | Avoid Docker; lowest setup; acceptable cleanup story. |
| Supabase project | User will create one now; we walk them through it as task 1 of the implementation plan | — |

---

## 3. Architecture & routing

### 3.1 Routes (all under `prism/src/app/`)

| Path | Group | Auth | Purpose |
|---|---|---|---|
| `/` | — | redirect | Root → `/dashboard` if signed in, `/login` if not |
| `/login` | `(auth)` | no | Email + password sign in |
| `/signup` | `(auth)` | no | Name + email + password account creation |
| `/auth/callback` | (top) | n/a | OAuth callback — kept for later Google enable; excluded from middleware matcher |
| `/dashboard` | `(app)` | yes | Server component; branches `<WelcomeScreen />` (0 projects) vs `<EmptyState />` (≥1) |
| `/project/[id]` | `(app)` | yes | M1 stub: shows project name + "Chat coming in M2 — your project is saved." Returns "Project not found" + back link if id missing/RLS-filtered. |

### 3.2 Route groups

- **`(auth)/layout.tsx`** — full-screen centered card shell, dark background
- **`(app)/layout.tsx`** — server component; fetches the project list via `getProjects()` and renders `<aside><ProjectSidebar projects={projects} /></aside>` + `<main>{children}</main>`

### 3.3 Middleware (`src/middleware.ts`)

Single auth gate, matcher excludes `_next/static`, `_next/image`, `favicon.ico`, `auth/callback`.
- Calls `supabase.auth.getUser()` on every matched request (refreshes session cookies)
- Unauthenticated visitor to `(app)` route → redirect to `/login`
- Authenticated visitor to `/login` or `/signup` → redirect to `/dashboard`

### 3.4 Welcome screen detection

`(app)/dashboard/page.tsx` is a server component that calls `getProjectCount()`:
- `count === 0` → render `<WelcomeScreen />`
- `count >= 1` → render `<EmptyState />`
- On query failure → render `<EmptyState />` with an inline error banner (better than showing first-run UX to someone who has projects)

No DB column, no localStorage, no user_metadata flag.

---

## 4. File layout

Paths under `prism/src/`. **Bold** = new vs original spec.

### 4.1 App routes
```
app/layout.tsx                   root layout: fonts, html lang, body bg
app/page.tsx                     root redirector
app/globals.css                  Tailwind + monochrome design tokens (CSS vars)
app/(auth)/layout.tsx
app/(auth)/login/page.tsx
app/(auth)/signup/page.tsx       NEW
app/auth/callback/route.ts
app/(app)/layout.tsx             fetches projects (server), renders sidebar + main
app/(app)/dashboard/page.tsx     server component; Welcome vs EmptyState
app/(app)/project/[id]/page.tsx  M1 stub
middleware.ts
```

### 4.2 Components
```
components/auth/
  AuthCard.tsx                   shared shell (logo, wordmark, slot)
  SignInForm.tsx                 client form
  SignUpForm.tsx                 client form (NEW)
components/dashboard/
  ProjectSidebar.tsx             client; receives projects as props; usePathname for active
  ProjectRow.tsx                 link + StatusDot + truncated name
  NewProjectButton.tsx           opens dialog
  NewProjectDialog.tsx           Radix Dialog + form (NEW)
  SignOutButton.tsx
  WelcomeScreen.tsx              first-run hero + 3 step explainer + CTA (NEW)
  EmptyState.tsx                 "Select a project or create a new one"
components/ui/
  Logo.tsx                       monochrome geometric SVG mark (NEW)
  StatusDot.tsx                  intensity-based dot with aria-label (NEW)
  Button.tsx                     primary | secondary | ghost variants (NEW)
```

### 4.3 Lib & types
```
lib/supabase/client.ts           browser client
lib/supabase/server.ts           server client (next/headers cookies)
lib/projects.ts                  getProjects, getProjectCount, getProjectById
lib/actions/projects.ts          createProjectAction (server action)
lib/utils.ts                     cn() — clsx + tailwind-merge
types/project.ts                 Project, ProjectStatus
```

### 4.4 Tests
```
vitest.config.ts
playwright.config.ts
src/test/setup.ts                jest-dom matchers, afterEach cleanup
src/test/supabase-mock.ts        chainable mock factory
src/test/factories.ts            makeProject, makeUser
src/test/render.tsx              RTL render wrapper
**/<Component>.test.tsx          colocated unit tests
tests/e2e/helpers.ts             signup/login/cleanup utilities
tests/e2e/auth-onboarding.spec.ts
tests/e2e/login.spec.ts
tests/e2e/auth-guard.spec.ts
tests/e2e/signout.spec.ts
```

---

## 5. Design system (monochrome)

These tokens are defined in `globals.css` and replace the blue palette in `Docs/10`. Tailwind references them via CSS variables.

```
--bg:          #000000   page background
--surface-0:   #0a0a0a   modal / highest surface
--surface-1:   #111111   card / sidebar
--surface-2:   #1a1a1a   inputs / nested rows
--border:      #232323   hairline
--border-2:    #2e2e2e   stronger hairline
--text-0:      #ffffff   primary text
--text-1:      #d4d4d4   secondary text
--text-2:      #8a8a8a   tertiary text
--text-3:      #5a5a5a   muted — decorative/non-text only (e.g. dots, dividers).
                          For muted text use --text-2 to keep AA Normal contrast.
--primary:     #ffffff   primary CTA bg
--primary-fg:  #0a0a0a   primary CTA fg

shadow-sm:  0 1px 2px rgba(0,0,0,.6)
shadow-md:  0 4px 12px rgba(0,0,0,.55), 0 1px 2px rgba(0,0,0,.6)
shadow-lg:  0 16px 48px rgba(0,0,0,.65), 0 4px 12px rgba(0,0,0,.4)
shadow-inset: inset 0 1px 0 rgba(255,255,255,.04)
```

**Status dot semantics (intensity, not hue):**
- `drafting` → `--text-3` (muted gray)
- `clarifying` → `--text-1` (light gray)
- `compiling` → `--text-1` (light gray, pulsing later)
- `ready` → `--text-0` with soft white glow
- `exported` → `--text-0` with a small ring outline

Every dot has `aria-label="Status: <name>"`.

---

## 6. Data flow

### 6.1 Authentication (client-side, Supabase JS in browser)

```
Signup    form submit → supabase.auth.signUp({ email, password,
                          options: { data: { display_name } } })
                     → session cookie set immediately (confirm-email = off)
                     → router.push('/dashboard')

Login     form submit → supabase.auth.signInWithPassword({ email, password })
                     → router.push('/dashboard')

Signout   button → supabase.auth.signOut() → router.push('/login')
```

Errors surface inline below the form. No global toasts.

### 6.2 Dashboard render (server-side)

```
(app)/layout.tsx
  server client → getProjects(userId)   → Project[]   (RLS-scoped)
  <ProjectSidebar projects={...} />

(app)/dashboard/page.tsx
  server client → getProjectCount(userId)
  if count === 0  → <WelcomeScreen />
  if count >= 1   → <EmptyState />
```

`getProjects` and `getProjectCount` do not filter by `user_id` in code — RLS enforces it.

### 6.3 Create project (Server Action)

```
NewProjectDialog (client) ── submit ──▶ createProjectAction(name, description?)
                                          ├─ const { user } = await supabase.auth.getUser()
                                          ├─ if (!user) throw  →  caller redirects /login
                                          ├─ insert into projects → row { id, ... }
                                          ├─ revalidatePath('/(app)')
                                          └─ redirect(`/project/${row.id}`)
```

The dialog catches errors thrown by the action and keeps itself open with the error rendered inline.

### 6.4 Dialog hoisting

A single `<NewProjectDialog />` instance lives in `(app)/layout.tsx`. Two triggers — the sidebar `+ New Project` button and the welcome screen CTA — both open it via a small client-side context (`useNewProjectDialog()`). One DOM node, one form state, one form-reset path.

### 6.5 Sidebar refresh

After `createProjectAction` calls `revalidatePath('/(app)')`, the server layout re-renders and passes a fresh `projects` array to `ProjectSidebar`. No client refetch needed.

---

## 7. Errors & edge cases

### 7.1 Form errors (inline, no toasts)

| Trigger | Copy |
|---|---|
| Signup w/ existing email | "An account with this email already exists. Sign in instead." |
| Signup w/ weak password | "Password must be at least 8 characters." |
| Login w/ wrong password | "Email or password is incorrect." |
| Network failure | "Couldn't connect. Check your network and try again." |
| Supabase rate limit | "Too many attempts. Wait a minute and try again." |
| Empty project name | submit disabled (no error string) |
| Insert fails on create | "Couldn't create project. Try again." |

### 7.2 Validation rules
- Email: HTML5 `type="email"` + non-empty
- Password: ≥8 chars
- Display name: non-empty after trim, ≤80 chars
- Project name: non-empty after trim, ≤100 chars

### 7.3 Routing edges
- `/project/[id]` with missing or RLS-filtered id → renders "Project not found" + link to `/dashboard`
- Authed user visits `/login` or `/signup` → middleware → `/dashboard`
- Unauthed user visits `/dashboard` or `/project/...` → middleware → `/login`
- Sign-out from another tab → next nav in this tab caught by middleware

### 7.4 Concurrency
- Multi-tab create: each tab's `revalidatePath` only refreshes itself. Other tabs see the change on next navigation. Accepted for M1.

### 7.5 Accessibility minimums
- All inputs have `<label>` (visible or `aria-label`)
- Errors associated via `aria-describedby`
- `NewProjectDialog` — Radix handles focus trap, ESC, return focus
- `<StatusDot>` has `aria-label="Status: ..."`
- `<nav aria-label="Projects">` on sidebar; active row has `aria-current="page"`
- Color contrast (verified):
  - `--text-0` (#fff) on `--bg` (#000) = 21:1 — passes AAA
  - `--text-1` (#d4d4d4) on `--surface-1` (#111) = 11.4:1 — passes AAA
  - `--text-2` (#8a8a8a) on `--surface-1` (#111) = 5.4:1 — passes AA Normal
  - `--text-3` (#5a5a5a) on `--bg` (#000) = 3.06:1 — **fails AA Normal**, so it must not be used for body text. Permitted uses: status dot fills, divider lines, decorative numerals. Skip/secondary-link copy from the mockups uses `--text-2` instead.

### 7.6 Explicitly out of scope for M1
- Password reset / forgot password
- Account deletion, email change
- Profile edit UI (display_name stored but not surfaced)
- Project rename or delete
- Realtime sync across tabs
- Google OAuth (button visible but disabled)
- Visual regression tests

---

## 8. Testing strategy

### 8.1 Layers

| Layer | Tool | Scope |
|---|---|---|
| Unit | Vitest | `lib/projects.ts`, `createProjectAction`, `cn()` |
| Component | Vitest + RTL (jsdom) | Forms, dialog, sidebar, rows, welcome, empty state |
| E2E | Playwright (Chromium) | 4 specs covering signup, login, auth guard, signout |

### 8.2 Mocking
- Unit/component: `vi.mock('@/lib/supabase/{client,server}')` returning a chainable mock factory from `src/test/supabase-mock.ts`.
- Server action: also mock `next/navigation` (`redirect`, `revalidatePath`).
- E2E: real Supabase. Unique users per test (`e2e+${ts}+${rnd}@prism.test`); teardown deletes via `auth.admin.deleteUser` using the service-role key.

### 8.3 E2E specs
1. `auth-onboarding.spec.ts` — full signup → welcome → modal create → land on /project/[id] with sidebar row active
2. `login.spec.ts` — pre-seeded user signs in → sees EmptyState (not Welcome) → can create project
3. `auth-guard.spec.ts` — guard behavior both directions
4. `signout.spec.ts` — sign out clears session; can't navigate back

### 8.4 TDD loop (per task)
1. Red — failing test
2. Green — minimal pass
3. Refactor — keep tests green
4. Edge cases — append as additional tests in same file

### 8.5 Coverage policy
No coverage % target. We test what could realistically break. Trivial JSX-only components get smoke tests at most.

---

## 9. Implementation order (becomes the plan in the next step)

1. Walk through Supabase project creation + run SQL from `Docs/04` + disable email confirmation + collect env vars
2. Scaffold Next.js + install deps + configure Vitest, Playwright, Tailwind, design tokens
3. Test infrastructure: `src/test/setup.ts`, `supabase-mock.ts`, `factories.ts`, playwright config + helpers
4. Supabase client wrappers + middleware + middleware tests
5. `lib/projects.ts` helpers + tests
6. `lib/actions/projects.ts` `createProjectAction` + tests
7. UI primitives: `Logo`, `StatusDot`, `Button`, `AuthCard` + smoke tests
8. `SignInForm` + tests → `/login` page
9. `SignUpForm` + tests → `/signup` page
10. `ProjectSidebar` + `ProjectRow` + tests
11. `WelcomeScreen` + `EmptyState` + tests
12. `NewProjectDialog` (with hoisted instance + context) + tests
13. Root layout + `(app)/layout.tsx` wiring
14. `/project/[id]` M1 stub
15. E2E specs in order: auth-guard → signout → login → auth-onboarding
16. Accessibility audit pass (axe-core via Playwright)
17. Rewrite `Docs/10-ui-ux-guidelines.md` to match the monochrome system

---

## 10. Done criteria

- [ ] `npm run dev` boots cleanly with no warnings
- [ ] `npm run typecheck`, `npm run lint`, `npm run test`, `npm run test:e2e` all pass
- [ ] A new user can: visit `/signup` → create account → see Welcome → click CTA → fill modal → land on `/project/[id]` with sidebar showing the new row, active
- [ ] An existing user with ≥1 projects sees `EmptyState`, not Welcome
- [ ] Unauth → `/dashboard` redirects to `/login`; auth → `/login` redirects to `/dashboard`
- [ ] Sign out lands on `/login`; protected routes inaccessible after
- [ ] All forms have inline errors for: existing email, wrong password, weak password, empty fields
- [ ] axe-core reports no serious/critical violations on `/login`, `/signup`, `/dashboard`, `/project/[id]`
- [ ] `Docs/10-ui-ux-guidelines.md` is rewritten to match the monochrome system

---

## 11. Deviations from `Docs/05-milestone-1-auth-dashboard.md`

| Doc says | Spec says | Reason |
|---|---|---|
| Google + Email auth from day 1 | Email only; Google button disabled "(soon)" | Avoid Google Cloud Console setup in M1 |
| Single `/login` page | `/login` + `/signup` | User requested onboarding scope |
| No welcome screen | First-run welcome at `/dashboard` (count===0) | User requested onboarding scope |
| Instant create on `+ New Project` click | Modal asking for name + optional description | User picked Option B in design review |
| Client-side `useEffect` fetch in sidebar | Server-side fetch in layout, passed as props | Simpler contract, no `onCreated` callback |
| Client-side insert in `NewProjectButton` | Server Action `createProjectAction` | RLS + user_id stays server-side |
| Blue accents (`bg-blue-600`, etc.) | Monochrome palette (`Docs/10` will be rewritten) | User requested visual change |
| No tests specified | Vitest + RTL + Playwright | User picked TDD via superpowers |

---

## 12. Open questions

None outstanding. All decisions resolved during brainstorming.
