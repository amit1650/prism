export function EmptyState({ error }: { error?: string }) {
  return (
    <div className="flex items-center justify-center min-h-full p-6 text-center">
      <div>
        <h2 className="text-base font-semibold text-text-0">
          Select a project or create a new one
        </h2>
        <p className="text-xs text-text-2 mt-1.5">
          Define your project once. Export to any LLM.
        </p>
        {error && (
          <p role="alert" className="mt-4 text-xs text-text-1 bg-surface-1 border border-border-2 rounded-md px-3 py-2">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
