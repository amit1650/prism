import Link from 'next/link'

export default async function QaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <div className="flex items-center justify-center min-h-full p-8 text-center">
      <div>
        <h1 className="text-xl font-semibold text-text-0 tracking-tight">
          Q&amp;A wizard
        </h1>
        <p className="mt-2 text-sm text-text-2 max-w-md mx-auto">
          Coming in M3. Your chat history and uploaded documents are saved and will feed
          the analysis once we wire it up.
        </p>
        <Link
          href={`/project/${id}`}
          className="inline-block mt-6 text-sm text-text-0 underline underline-offset-2"
        >
          ← Back to chat
        </Link>
      </div>
    </div>
  )
}
