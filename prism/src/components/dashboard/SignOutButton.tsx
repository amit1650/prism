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
