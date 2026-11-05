"use client"

import { useRouter } from "next/navigation"

export function OrgSwitcher({
  current,
  options,
}: {
  current: string
  options: { slug: string; name: string }[]
}) {
  const router = useRouter()
  if (options.length < 2) return null
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-muted-foreground">Workspace</span>
      <select
        className="h-11 rounded-lg border bg-card px-3"
        value={current}
        onChange={(event) => router.push(`/c/${event.target.value}`)}
      >
        {options.map((option) => (
          <option key={option.slug} value={option.slug}>{option.name}</option>
        ))}
      </select>
    </label>
  )
}
