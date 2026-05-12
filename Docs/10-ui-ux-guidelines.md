# 10 — UI/UX Guidelines

## Core Design Principles

- **Monochrome.** Black surfaces, dark-gray cards, white text. No color accents except for explicit semantic uses (none in M1).
- **Shadows do the work.** Three layers — inset highlight, ambient drop, far drop — replace color for depth and hierarchy.
- **Minimal.** Every element earns its place. No decorative gradients, no glow effects except `status: ready`.
- **Status is always visible** via the `<StatusDot>` component (intensity-based — see below).
- **Confidence is always shown** via `<Badge>` components in later milestones (M3+).

---

## Color Tokens (CSS variables, Tailwind v4 `@theme`)

Defined in `prism/src/app/globals.css`. Tailwind v4 automatically registers utilities from these tokens (e.g. `--color-bg` → `bg-bg`, `--shadow-md` → `shadow-md`). No `tailwind.config.ts` file is needed.

```
--color-bg:          #000000  page background
--color-surface-0:  #0a0a0a  modal / highest surface
--color-surface-1:  #111111  card / sidebar
--color-surface-2:  #1a1a1a  inputs / nested rows / active row bg
--color-border:     #232323  hairline
--color-border-2:   #2e2e2e  stronger hairline (focus rings, inputs)
--color-text-0:     #ffffff  primary text
--color-text-1:     #d4d4d4  secondary text (form errors, paragraph body)
--color-text-2:     #8a8a8a  tertiary text (subtitles, hints, body muted)
--color-text-3:     #5a5a5a  DECORATIVE only — dots, dividers, numerals.
                              Do NOT use for body text — fails AA on #000.
--color-primary:    #ffffff  primary CTA background
--color-primary-fg: #0a0a0a  primary CTA foreground
```

**Verified contrast (WCAG):**
- `--color-text-0` on `--color-bg` = 21:1 (AAA)
- `--color-text-1` on `--color-surface-1` = 11.4:1 (AAA)
- `--color-text-2` on `--color-surface-1` = 5.4:1 (AA Normal)
- `--color-text-3` on `--color-bg` = 3.06:1 — **decorative only**

The axe-core audit (`tests/e2e/a11y.spec.ts`) fails the build if any text uses `text-text-3`. `placeholder:text-text-3` on inputs is exempt (axe doesn't audit placeholders).

---

## Shadow Tokens

```css
--shadow-sm:        0 1px 2px rgba(0,0,0,.6);
--shadow-md:        0 4px 12px rgba(0,0,0,.55), 0 1px 2px rgba(0,0,0,.6);
--shadow-lg:        0 16px 48px rgba(0,0,0,.65), 0 4px 12px rgba(0,0,0,.4);
--shadow-inset:      inset 0 1px 0 rgba(255,255,255,.04);
--shadow-inset-pri:  inset 0 1px 0 rgba(255,255,255,.4);
```

**Usage:**
- Buttons (primary): `shadow-md` + `shadow-inset-pri`
- Cards: `shadow-md` + `shadow-inset`
- Inputs (inset shadow inward): inline `shadow-inner`
- Modals: `shadow-lg` + `shadow-inset` over a `backdrop-blur-sm` overlay

---

## Status Dot Semantics (intensity, not hue)

The `<StatusDot>` component (`src/components/ui/StatusDot.tsx`) renders a tiny circle whose fill encodes status. Always paired with `aria-label="Status: <name>"`.

| Status | Fill | Extra |
|---|---|---|
| drafting | `bg-text-3` | — |
| clarifying | `bg-text-1` | — |
| compiling | `bg-text-1` | (will pulse later) |
| ready | `bg-text-0` | `box-shadow: 0 0 8px rgba(255,255,255,.4)` |
| exported | `bg-text-0` | `ring-2 ring-text-3` |

`text-text-3`/`bg-text-3` is fine on a dot — it's not text content, it's a 6×6px decorative shape.

---

## Component Library Overview (M1 components — extended in later milestones)

- `<Button variant="primary | secondary | ghost">` — `src/components/ui/Button.tsx`. Primary is white-on-black; secondary is dark-gray on slightly darker bg; ghost is text-only hover.
- `<AuthCard title subtitle>` — centered card frame with logo + wordmark for `/login` and `/signup`.
- `<StatusDot status>` — see above.
- `<Logo size={n}>` — monochrome geometric SVG mark (`src/components/ui/Logo.tsx`). Default size 18.
- `<ProjectSidebar projects={...}>` — sidebar shell; receives projects as a prop (server-fetched).
- `<NewProjectDialogProvider>` / `<NewProjectDialog>` — hoisted dialog instance. Use `useNewProjectDialog()` to open from any descendant.
- `<WelcomeScreen>` — first-run hero. Uses `useNewProjectDialog()` context to open the create-project dialog.
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
- **`--color-text-3` is reserved for non-text decoration.** Body text uses `--color-text-2` or lighter; the a11y audit enforces this.
