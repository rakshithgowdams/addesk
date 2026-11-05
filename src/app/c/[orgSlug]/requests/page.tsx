import Link from "next/link"
import { Suspense } from "react"
import { EmptyState } from "@/components/empty-state"
import { PageLoading } from "@/components/empty-state"
import { StatusBadge } from "@/components/status-badge"
import { requireClientOrg } from "@/lib/auth/session"
import { t } from "@/lib/i18n"
import { REQUEST_STATUSES, type RequestStatus } from "@/lib/requests/status"

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? ""
}

export default function ClientRequestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <Suspense fallback={<PageLoading />}>
      <ClientRequestsContent params={params} searchParams={searchParams} />
    </Suspense>
  )
}

async function ClientRequestsContent({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { orgSlug } = await params
  const query = await searchParams
  const context = await requireClientOrg(orgSlug)
  const status = one(query.status)
  const text = one(query.q)
  const { data } = await context.supabase.rpc("client_request_list", {
    p_org_id: context.organization.id,
    p_status: status,
    p_query: text,
  })
  const requests = (Array.isArray(data) ? data : []) as {
    id: string
    request_number: string
    title: string
    status: RequestStatus
  }[]
  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">{t("nav.requests")}</h1>
        {context.organization.status === "active" ? (
          <Link href={`/c/${orgSlug}/requests/new`} className="inline-flex h-11 items-center rounded-lg bg-primary px-4 text-sm text-primary-foreground">
            {t("nav.newRequest")}
          </Link>
        ) : null}
      </div>
      <form className="grid gap-3 sm:grid-cols-[1fr_180px_auto]" method="get">
        <input name="q" defaultValue={text} placeholder={t("admin.search")} className="h-11 rounded-lg border px-3" />
        <select name="status" defaultValue={status} className="h-11 rounded-lg border bg-card px-3">
          <option value="">{t("admin.all")}</option>
          {REQUEST_STATUSES.map((item) => <option key={item} value={item}>{t(`status.${item}`)}</option>)}
        </select>
        <button className="h-11 rounded-lg border px-4 text-sm">{t("admin.apply")}</button>
      </form>
      {requests.length === 0 ? (
        <EmptyState
          title={text || status ? t("empty.filtered") : t("empty.requests")}
          action={!text && !status && context.organization.status === "active" ? { href: `/c/${orgSlug}/requests/new`, label: t("empty.requestsAction") } : undefined}
        />
      ) : null}
      {requests.map((request) => (
        <Link key={request.id} href={`/c/${orgSlug}/requests/${request.id}`} className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4">
          <span>
            <span className="text-sm text-muted-foreground">{request.request_number}</span>
            <span className="block font-medium">{request.title}</span>
          </span>
          <StatusBadge status={request.status} />
        </Link>
      ))}
    </div>
  )
}
