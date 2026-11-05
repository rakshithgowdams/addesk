import Link from "next/link"
import { EmptyState } from "@/components/empty-state"
import { requireAgency } from "@/lib/auth/session"
import { formatDateTime } from "@/lib/format"
import { t } from "@/lib/i18n"

type Dashboard = {
  submitted: number
  overdue: number
  waiting_on_agency: number
  waiting_on_client: number
  ready_to_launch: number
  live: number
  overdue_requests: {
    id: string
    request_number: string
    title: string
    org_name: string
    first_response_due_at: string
  }[]
}

export default async function AdminHomePage() {
  const context = await requireAgency()
  const { data } = await context.supabase.rpc("agency_dashboard")
  const dashboard = (data ?? {}) as Dashboard
  const counts = [
    [t("home.submitted"), dashboard.submitted ?? 0],
    [t("home.overdue"), dashboard.overdue ?? 0],
    [t("home.waitingAgency"), dashboard.waiting_on_agency ?? 0],
    [t("home.waitingClient"), dashboard.waiting_on_client ?? 0],
    [t("home.ready"), dashboard.ready_to_launch ?? 0],
    [t("home.liveCount"), dashboard.live ?? 0],
  ] as const
  const overdue = dashboard.overdue_requests ?? []
  const accents = ["bg-primary", "bg-rose-500", "bg-amber-500", "bg-sky-600", "bg-violet-600", "bg-emerald-600"]
  return (
    <div className="grid gap-6">
      <h1 className="text-3xl font-semibold tracking-tight">{t("home.masterTitle")}</h1>
      <section className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3">
        {counts.map(([label, value], index) => (
          <div key={label} className="panel relative overflow-hidden p-4">
            <span className={`absolute inset-y-3 left-0 w-1 rounded-full ${accents[index]}`} />
            <p className="pl-3 text-sm text-muted-foreground">{label}</p>
            <p className="pl-3 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
          </div>
        ))}
      </section>
      <section className="grid gap-3">
        <h2 className="text-lg font-semibold tracking-tight">{t("home.overdueTitle")}</h2>
        {overdue.length === 0 ? <EmptyState title={t("empty.overdue")} /> : null}
        {overdue.map((request) => (
          <Link key={request.id} href={`/admin/requests/${request.id}`} className="panel block p-4">
            <p className="font-medium">{request.request_number} · {request.title}</p>
            <p className="text-sm text-muted-foreground">{request.org_name}</p>
            <p className="text-sm">{t("home.due", { time: formatDateTime(request.first_response_due_at) })}</p>
          </Link>
        ))}
      </section>
    </div>
  )
}
