import Link from "next/link"
import { Suspense } from "react"
import { EmptyState } from "@/components/empty-state"
import { PageLoading } from "@/components/empty-state"
import { StatusBadge } from "@/components/status-badge"
import { requireAgency } from "@/lib/auth/session"
import { formatDateTime } from "@/lib/format"
import { t } from "@/lib/i18n"
import { isOverdue, REQUEST_STATUSES, type RequestStatus } from "@/lib/requests/status"

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? ""
}

export default function AdminRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <Suspense fallback={<PageLoading />}>
      <AdminRequestsContent searchParams={searchParams} />
    </Suspense>
  )
}

async function AdminRequestsContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const context = await requireAgency()
  const status = one(params.status)
  const orgId = one(params.org)
  const blocker = one(params.blocker)
  const priority = one(params.priority)
  const assignee = one(params.assignee)
  const from = one(params.from)
  const to = one(params.to)
  const overdue = one(params.overdue) === "1"
  const query = one(params.q).trim()

  let requestQuery = context.supabase
    .from("requests")
    .select("id, request_number, title, status, priority, blocker, first_response_due_at, first_response_at, created_at, org_id, assigned_to")
    .order("created_at", { ascending: false })
    .limit(300)
  if (REQUEST_STATUSES.includes(status as RequestStatus)) requestQuery = requestQuery.eq("status", status as RequestStatus)
  if (blocker) requestQuery = requestQuery.eq("blocker", blocker as "none")
  if (priority === "normal" || priority === "urgent") requestQuery = requestQuery.eq("priority", priority)
  if (assignee) requestQuery = requestQuery.eq("assigned_to", assignee)
  if (from) requestQuery = requestQuery.gte("created_at", `${from}T00:00:00+05:30`)
  if (to) requestQuery = requestQuery.lte("created_at", `${to}T23:59:59+05:30`)

  const [{ data: requests }, { data: organizations }, { data: staff }] = await Promise.all([
    requestQuery,
    context.supabase.from("organizations").select("id, name").order("name"),
    context.supabase.from("profiles").select("id, full_name").not("platform_role", "is", null),
  ])

  const rows = (requests ?? []).filter((request) => {
    if (overdue && !isOverdue(request)) return false
    if (!query) return true
    const haystack = `${request.request_number} ${request.title}`.toLowerCase()
    return haystack.includes(query.toLowerCase())
  })
  const visible = orgId ? rows.filter((request) => request.org_id === orgId) : rows
  const groups = (organizations ?? [])
    .map((org) => ({ org, items: visible.filter((request) => request.org_id === org.id) }))
    .filter((group) => group.items.length > 0)

  function clientHref(nextOrg: string) {
    const search = new URLSearchParams()
    if (query) search.set("q", query)
    if (nextOrg) search.set("org", nextOrg)
    if (status) search.set("status", status)
    if (blocker) search.set("blocker", blocker)
    if (priority) search.set("priority", priority)
    if (assignee) search.set("assignee", assignee)
    if (from) search.set("from", from)
    if (to) search.set("to", to)
    if (overdue) search.set("overdue", "1")
    const value = search.toString()
    return value ? `/admin/requests?${value}` : "/admin/requests"
  }

  return (
    <div className="grid gap-4">
      <h1 className="text-3xl font-semibold tracking-tight">{t("nav.requests")}</h1>
      <form className="panel grid gap-3 p-4 sm:grid-cols-3" method="get">
        <label className="grid gap-1 text-sm">{t("admin.search")}<input name="q" defaultValue={query} className="h-11 rounded-lg border px-3" /></label>
        <label className="grid gap-1 text-sm">{t("admin.client")}
          <select name="org" defaultValue={orgId} className="h-11 rounded-lg border bg-card px-3">
            <option value="">{t("admin.all")}</option>
            {(organizations ?? []).map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">{t("request.status")}
          <select name="status" defaultValue={status} className="h-11 rounded-lg border bg-card px-3">
            <option value="">{t("admin.all")}</option>
            {REQUEST_STATUSES.map((item) => <option key={item} value={item}>{t(`status.${item}`)}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">{t("request.blocker")}
          <select name="blocker" defaultValue={blocker} className="h-11 rounded-lg border bg-card px-3">
            <option value="">{t("admin.all")}</option>
            {["none", "waiting_on_client", "waiting_on_creator_approval", "waiting_on_agency", "waiting_on_meta"].map((item) => (
              <option key={item} value={item}>{t(`blockerAgency.${item}`)}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">{t("priority.normal")}
          <select name="priority" defaultValue={priority} className="h-11 rounded-lg border bg-card px-3">
            <option value="">{t("admin.all")}</option>
            <option value="normal">{t("priority.normal")}</option>
            <option value="urgent">{t("priority.urgent")}</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">{t("admin.assignee")}
          <select name="assignee" defaultValue={assignee} className="h-11 rounded-lg border bg-card px-3">
            <option value="">{t("admin.all")}</option>
            {(staff ?? []).map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">{t("admin.from")}<input type="date" name="from" defaultValue={from} className="h-11 rounded-lg border px-3" /></label>
        <label className="grid gap-1 text-sm">{t("admin.to")}<input type="date" name="to" defaultValue={to} className="h-11 rounded-lg border px-3" /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="overdue" value="1" defaultChecked={overdue} />{t("admin.overdueOnly")}</label>
        <div className="flex gap-2">
          <button className="h-11 rounded-lg bg-primary px-4 text-sm text-primary-foreground">{t("admin.apply")}</button>
          <Link href="/admin/requests" className="inline-flex h-11 items-center rounded-lg border px-4 text-sm">{t("admin.clear")}</Link>
        </div>
      </form>
      <div className="flex gap-2 overflow-x-auto pb-1">
        <Link href={clientHref("")} aria-current={orgId ? undefined : "page"} className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${orgId ? "text-muted-foreground hover:bg-muted" : "bg-primary text-primary-foreground"}`}>{t("admin.all")}</Link>
        {(organizations ?? []).map((org) => {
          const count = rows.filter((request) => request.org_id === org.id).length
          const active = org.id === orgId
          return (
            <Link key={org.id} href={clientHref(org.id)} aria-current={active ? "page" : undefined} className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${active ? "bg-primary text-primary-foreground" : "border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
              {org.name} · {count}
            </Link>
          )
        })}
      </div>
      {groups.length === 0 ? <EmptyState title={t("empty.filtered")} /> : null}
      {groups.map((group) => (
        <section key={group.org.id} className="grid gap-2">
          <h2 className="text-lg font-semibold tracking-tight">{group.org.name}</h2>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-muted/70 text-xs tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th className="px-3 py-3 font-medium">{t("nav.requests")}</th>
                  <th className="px-3 py-3 font-medium">{t("request.status")}</th>
                  <th className="px-3 py-3 font-medium">{t("request.due")}</th>
                </tr>
              </thead>
              <tbody>
                {group.items.map((request) => (
                  <tr key={request.id} className="border-t">
                    <td className="px-3 py-3">
                      <Link href={`/admin/requests/${request.id}`} className="font-medium underline-offset-4 hover:underline">
                        {request.request_number}
                      </Link>
                      <span className="mt-1 block">{request.title}</span>
                      {request.priority === "urgent" ? <span className="text-xs text-rose-700">{t("priority.urgent")}</span> : null}
                    </td>
                    <td className="px-3 py-3"><StatusBadge status={request.status} /></td>
                    <td className="px-3 py-3">{formatDateTime(request.first_response_due_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  )
}
