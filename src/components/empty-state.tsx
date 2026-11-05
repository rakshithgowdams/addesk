import Link from "next/link"

export function EmptyState({ title, action }: { title: string; action?: { href: string; label: string } }) {
  return (
    <div className="rounded-2xl border border-dashed bg-card/60 px-4 py-10 text-center">
      <p className="text-sm text-muted-foreground">{title}</p>
      {action ? (
        <Link
          href={action.href}
          className="mt-4 inline-flex h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  )
}

export function PageLoading() {
  return (
    <div className="grid min-h-[40vh] place-items-center px-4" role="status" aria-label="Loading">
      <span className="inline-block size-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
    </div>
  )
}
