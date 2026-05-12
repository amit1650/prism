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
          className="w-full px-3 py-2.5 bg-surface-2 border border-border-2 rounded-lg text-text-0 placeholder:text-text-2 text-sm shadow-inner"
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
          className="w-full px-3 py-2.5 bg-surface-2 border border-border-2 rounded-lg text-text-0 placeholder:text-text-2 text-sm shadow-inner"
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
          className="w-full px-3 py-2.5 bg-surface-2 border border-border-2 rounded-lg text-text-0 placeholder:text-text-2 text-sm shadow-inner"
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
        <span className="text-[10px] tracking-widest text-text-2 uppercase">or</span>
        <span className="flex-1 h-px bg-border" />
      </div>
      <Button variant="secondary" disabled className="w-full">
        Continue with Google <span className="text-text-2 font-normal">(soon)</span>
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
