import { WelcomeScreen } from '@/components/dashboard/WelcomeScreen'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { getProjectCount } from '@/lib/projects'

export default async function DashboardPage() {
  let count: number | null = null
  try {
    count = await getProjectCount()
  } catch {
    count = null
  }
  if (count === null) {
    return <EmptyState error="Couldn't load your projects. Please refresh." />
  }
  return count === 0 ? <WelcomeScreen /> : <EmptyState />
}
