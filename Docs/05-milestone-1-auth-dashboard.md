# 05 — Milestone 1: Auth + Dashboard

## Goal
User can sign in and see their project threads. Nothing AI yet. Pure foundation.

## Deliverables
- [ ] Login page with Google + Email auth
- [ ] Dashboard with project thread sidebar
- [ ] Create new project flow
- [ ] Project stored in Supabase
- [ ] Auth guard on all app routes

---

## Task 1 — Project Setup

```bash
npx create-next-app@latest prism --typescript --tailwind --app --src-dir
cd prism

# Install all dependencies at once
npm install \
  @supabase/supabase-js \
  @supabase/ssr \
  @chatscope/chat-ui-kit-react \
  @anthropic-ai/sdk \
  pdf-parse \
  mammoth \
  file-saver \
  clsx \
  tailwind-merge \
  lucide-react \
  @radix-ui/react-dialog \
  @radix-ui/react-progress \
  @radix-ui/react-tooltip

npm install -D @types/pdf-parse @types/file-saver
```

Create `.env.local` with all variables from `02-tech-stack.md`.

---

## Task 2 — Supabase Setup

1. Go to [supabase.com](https://supabase.com) → New Project
2. Run all SQL from `04-database-schema.md` in the SQL editor
3. Enable Google OAuth:
   - Supabase Dashboard → Auth → Providers → Google → Enable
   - Add your Google OAuth credentials
4. Set Site URL to `http://localhost:3000`
5. Set Redirect URL to `http://localhost:3000/auth/callback`

---

## Task 3 — Supabase Client Setup

```typescript
// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

```typescript
// src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
```

```typescript
// src/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login')
  const isAppRoute = request.nextUrl.pathname.startsWith('/dashboard') ||
                     request.nextUrl.pathname.startsWith('/project')

  if (!user && isAppRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|auth/callback).*)'],
}
```

---

## Task 4 — Auth Callback Route

```typescript
// src/app/auth/callback/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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

---

## Task 5 — Login Page

```typescript
// src/app/(auth)/login/page.tsx
'use client'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    })
  }

  const signInWithEmail = async () => {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-md p-8 bg-gray-900 rounded-2xl border border-gray-800">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Prism</h1>
          <p className="text-gray-400 mt-1">Define your project once. Build it everywhere.</p>
        </div>

        <button
          onClick={signInWithGoogle}
          className="w-full py-3 px-4 bg-white text-gray-900 rounded-xl font-medium hover:bg-gray-100 transition-colors flex items-center justify-center gap-3"
        >
          <GoogleIcon />
          Continue with Google
        </button>

        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-gray-800" />
          <span className="text-gray-500 text-sm">or</span>
          <div className="flex-1 h-px bg-gray-800" />
        </div>

        <div className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            onClick={signInWithEmail}
            disabled={loading}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
      <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
      <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/>
      <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/>
    </svg>
  )
}
```

---

## Task 6 — Dashboard Layout + Sidebar

```typescript
// src/app/(app)/layout.tsx
import ProjectSidebar from '@/components/dashboard/ProjectSidebar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-950">
      <ProjectSidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
```

### ProjectSidebar Component

```typescript
// src/components/dashboard/ProjectSidebar.tsx
'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Project } from '@/types/project'
import { Plus, Brain } from 'lucide-react'
import NewProjectButton from './NewProjectButton'
import ProjectCard from './ProjectCard'

export default function ProjectSidebar() {
  const [projects, setProjects] = useState<Project[]>([])
  const supabase = createClient()
  const pathname = usePathname()

  useEffect(() => {
    const fetchProjects = async () => {
      const { data } = await supabase
        .from('projects')
        .select('*')
        .order('updated_at', { ascending: false })
      if (data) setProjects(data)
    }
    fetchProjects()
  }, [])

  return (
    <aside className="w-64 h-full bg-gray-900 border-r border-gray-800 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Brain size={20} className="text-blue-400" />
          <span className="font-semibold text-white">Prism</span>
        </div>
      </div>

      {/* New Project Button */}
      <div className="p-3">
        <NewProjectButton onCreated={(p) => setProjects([p, ...projects])} />
      </div>

      {/* Project List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {projects.map(project => (
          <ProjectCard
            key={project.id}
            project={project}
            active={pathname.includes(project.id)}
          />
        ))}
        {projects.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-8">
            No projects yet.<br />Create one to start.
          </p>
        )}
      </div>

      {/* Sign Out */}
      <div className="p-3 border-t border-gray-800">
        <button
          onClick={() => supabase.auth.signOut()}
          className="w-full text-left text-gray-400 hover:text-white text-sm px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
```

### ProjectCard Component

```typescript
// src/components/dashboard/ProjectCard.tsx
import Link from 'next/link'
import { Project } from '@/types/project'

const statusColors = {
  drafting: 'bg-gray-500',
  clarifying: 'bg-yellow-500',
  compiling: 'bg-blue-500',
  ready: 'bg-green-500',
  exported: 'bg-purple-500',
}

export default function ProjectCard({ project, active }: { project: Project, active: boolean }) {
  return (
    <Link
      href={`/project/${project.id}`}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
        active ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
      }`}
    >
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColors[project.status]}`} />
      <span className="text-sm truncate">{project.name}</span>
    </Link>
  )
}
```

### NewProjectButton Component

```typescript
// src/components/dashboard/NewProjectButton.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus } from 'lucide-react'

export default function NewProjectButton({ onCreated }: { onCreated: (p: any) => void }) {
  const [creating, setCreating] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const create = async () => {
    setCreating(true)
    const name = `Project ${new Date().toLocaleDateString()}`
    const { data, error } = await supabase
      .from('projects')
      .insert({ name })
      .select()
      .single()

    if (data) {
      onCreated(data)
      router.push(`/project/${data.id}`)
    }
    setCreating(false)
  }

  return (
    <button
      onClick={create}
      disabled={creating}
      className="w-full flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
    >
      <Plus size={16} />
      {creating ? 'Creating...' : 'New Project'}
    </button>
  )
}
```

---

## Task 7 — Dashboard Home Page

```typescript
// src/app/(app)/dashboard/page.tsx
export default function DashboardPage() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-white mb-2">
          Select a project or create a new one
        </h2>
        <p className="text-gray-400">
          Define your project once. Export context to any LLM.
        </p>
      </div>
    </div>
  )
}
```

---

## M1 Done When
- [ ] `npm run dev` runs without errors
- [ ] `/login` shows Google + Email login
- [ ] Google OAuth redirects back correctly
- [ ] `/dashboard` shows empty sidebar
- [ ] Clicking "New Project" creates a project in Supabase and navigates to `/project/[id]`
- [ ] Unauthenticated users redirected to `/login`
- [ ] Project cards show in sidebar with correct status dots
