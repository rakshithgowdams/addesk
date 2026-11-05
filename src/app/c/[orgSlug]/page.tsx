import Link from "next/link"
import { EmptyState } from "@/components/empty-state"
import { StatusBadge } from "@/components/status-badge"
import { requireClientOrg } from "@/lib/auth/session"
import { formatDateTime } from "@/lib/format"
import { t } from "@/lib/i18n"
import type { Blocker } from "@/lib/requests/presentation"
import { whoseTurn } from "@/lib/requests/presentation"
import type { RequestStatus } from "@/lib/requests/status"

type ClientRequest = {
  id: string
  request_number: string
  title: string
  status: RequestStatus
  priority: "normal" | "urgent"
  blocker: Blocker
  first_response_due_at: string | null
  created_at: string
}

function RequestCard({ orgSlug, request }: { orgSlug: string; request: ClientRequest }) {
  const turn = whoseTurn(request.status, request.blocker, "client")
  return (
    <Link href={`/c/${orgSlug}/requests/${request.id}`} className="panel grid gap-2 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{request.request_number}</p>
          <p className="font-medium">{request.title}</p>
        </div>
        <StatusBadge status={request.status} />
      </div>
      <p className="text-sm">{turn.label}</p>
      <p className="text-sm text-muted-foreground">{t("home.due", { time: formatDateTime(request.first_response_due_at) })}</p>
    </Link>
  )
}

export default async function ClientHomePage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params
  const context = await requireClientOrg(orgSlug)
  const { data } = await context.supabase.rpc("client_request_list", { p_org_id: context.organization.id })
  const requests = (Array.isArray(data) ? data : []) as ClientRequest[]
  const needsYou = requests.filter((request) => request.status === "needs_info" || request.blocker === "waiting_on_client")
  const active = requests.filter((request) => ["submitted", "in_review", "ready_to_launch", "paused"].includes(request.status) && !needsYou.includes(request))
  const live = requests.filter((request) => request.status === "live")
  const recent = requests.filter((request) => ["completed", "rejected", "cancelled"].includes(request.status)).slice(0, 5)
  const sections = [
    [t("home.needsYou"), needsYou, t("empty.needsYou")],
    [t("home.active"), active, t("empty.active")],
    [t("home.live"), live, t("empty.live")],
    [t("home.recent"), recent, t("empty.recent")],
  ] as const
  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">{t("home.clientTitle")}</h1>
      </div>
      {requests.length === 0 ? (
        <EmptyState title={t("empty.requests")} action={context.organization.status === "active" ? { href: `/c/${orgSlug}/requests/new`, label: t("empty.requestsAction") } : undefined} />
      ) : null}
      {sections.map(([title, items, empty]) => (
        <section key={title} className="grid gap-2">
          <h2 className="text-lg font-semibold">{title}</h2>
          {items.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : null}
          {items.map((request) => <RequestCard key={request.id} orgSlug={orgSlug} request={request} />)}
        </section>
      ))}
    </div>
  )
}
