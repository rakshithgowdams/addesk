const TIME_ZONE = "Asia/Kolkata"

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—"
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  const date = value.length <= 10 ? new Date(`${value}T00:00:00+05:30`) : new Date(value)
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: TIME_ZONE,
    dateStyle: "medium",
  }).format(date)
}

export function formatInr(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—"
  const amount = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(amount)) return "—"
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount)
}
