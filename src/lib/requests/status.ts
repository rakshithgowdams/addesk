export const REQUEST_STATUSES = [
  "submitted",
  "in_review",
  "needs_info",
  "ready_to_launch",
  "live",
  "paused",
  "completed",
  "rejected",
  "cancelled",
] as const

export type RequestStatus = (typeof REQUEST_STATUSES)[number]

export const TRANSITIONS: Record<RequestStatus, readonly RequestStatus[]> = {
  submitted: ["in_review", "needs_info", "rejected", "cancelled"],
  in_review: ["needs_info", "ready_to_launch", "rejected", "cancelled"],
  needs_info: ["in_review", "cancelled"],
  ready_to_launch: ["live", "needs_info", "cancelled"],
  live: ["paused", "completed"],
  paused: ["live", "completed"],
  completed: [],
  rejected: [],
  cancelled: [],
}

export function canTransition(from: RequestStatus, to: RequestStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

export const CLIENT_CANCEL_STATUSES: readonly RequestStatus[] = [
  "submitted",
  "in_review",
  "needs_info",
  "ready_to_launch",
]

export function isTerminal(status: RequestStatus): boolean {
  return status === "completed" || status === "rejected" || status === "cancelled"
}

export function isOverdue(input: {
  status: RequestStatus
  first_response_at: string | null
  first_response_due_at: string | null
  now?: Date
}): boolean {
  if (!input.first_response_due_at || input.first_response_at) return false
  if (isTerminal(input.status)) return false
  return new Date(input.first_response_due_at).getTime() < (input.now ?? new Date()).getTime()
}
