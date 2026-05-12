import { AuthCard } from '@/components/auth/AuthCard'
import { SignUpForm } from '@/components/auth/SignUpForm'

export default function SignupPage() {
  return (
    <AuthCard title="Create your account" subtitle="Start building with Prism">
      <SignUpForm />
    </AuthCard>
  )
}
