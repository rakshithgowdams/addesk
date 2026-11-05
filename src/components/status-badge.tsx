import { statusLabel } from "@/lib/requests/presentation"
import type { RequestStatus } from "@/lib/requests/status"
import { cn } from "@/lib/utils"

const tones: Record<RequestStatus, string> = {
  submitted: "bg-slate-200 text-slate-900",
  in_review: "bg-sky-100 text-sky-950",
  needs_info: "bg-amber-100 text-amber-950",
  ready_to_launch: "bg-violet-100 text-violet-950",
  live: "bg-emerald-100 text-emerald-950",
  paused: "bg-orange-100 text-orange-950",
  completed: "bg-teal-100 text-teal-950",
  rejected: "bg-rose-100 text-rose-950",
  cancelled: "bg-stone-200 text-stone-800",
}

export function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", tones[status], status === "live" && "status-live")}>
      {statusLabel(status)}
    </span>
  )
}
