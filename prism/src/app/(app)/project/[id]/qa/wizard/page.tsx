import Link from 'next/link'

export default async function QaWizardPage({
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
          Coming in M4. The agent already understands your project — once we
          wire up the wizard, you&apos;ll answer up to 25 targeted questions
          to fill the gaps.
        </p>
        <Link
          href={`/project/${id}/qa`}
          className="inline-block mt-6 text-sm text-text-0 underline underline-offset-2"
        >
          ← Back to summary
        </Link>
      </div>
    </div>
  )
}
