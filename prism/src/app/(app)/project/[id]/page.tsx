import Link from 'next/link'
import { getProjectById } from '@/lib/projects'
import { getProjectMessages } from '@/lib/messages'
import { ProjectHeader } from '@/components/chat/ProjectHeader'
import { ChatWindow } from '@/components/chat/ChatWindow'

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
            We couldn&apos;t find that project, or you don&apos;t have access.
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

  const messages = await getProjectMessages(id)

  return (
    <div className="flex flex-col h-full">
      <ProjectHeader project={project} />
      <div className="flex-1 overflow-hidden">
        <ChatWindow projectId={id} initialMessages={messages} />
      </div>
    </div>
  )
}
