import { ProjectSidebar } from '@/components/dashboard/ProjectSidebar'
import { NewProjectDialogProvider } from '@/components/dashboard/NewProjectDialogProvider'
import { getProjects } from '@/lib/projects'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let projects = [] as Awaited<ReturnType<typeof getProjects>>
  try {
    projects = await getProjects()
  } catch {
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
