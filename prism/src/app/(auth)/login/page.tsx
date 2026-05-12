import { AuthCard } from '@/components/auth/AuthCard'
import { SignInForm } from '@/components/auth/SignInForm'

export default function LoginPage() {
  return (
    <AuthCard title="Welcome back" subtitle="Sign in to your workspace">
      <SignInForm />
    </AuthCard>
  )
}
