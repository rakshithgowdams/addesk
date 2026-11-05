import { notFound } from "next/navigation"
import { Suspense, type ReactNode } from "react"
import { PageLoading } from "@/components/empty-state"
import { ClientRequestActions } from "@/components/requests/client-request-actions"
import { StatusBadge } from "@/components/status-badge"
import { requireClientOrg } from "@/lib/auth/session"
import { formatDate, formatDateTime, formatInr } from "@/lib/format"
import { t } from "@/lib/i18n"
import { blockerLabel, whoseTurn, type Blocker } from "@/lib/requests/presentation"
import { CLIENT_CANCEL_STATUSES, type RequestStatus } from "@/lib/requests/status"

type Detail = {
  request: {
    id: string
    request_number: string
    title: string
    status: RequestStatus
    priority: "normal" | "urgent"
    blocker: Blocker
    blocker_note: string | null
    objective: string | null
    destination_type: string | null
    destination_value: string | null
    budget_inr: number | null
    budget_type: string | null
    start_date: string | null
    end_date: string | null
    offer_end_date: string | null
    locations: string | null
    audience_notes: string | null
    language: string | null
    offer_details: string | null
    client_notes: string | null
    rights_confirmed_at: string | null
    first_response_due_at: string | null
    first_response_at: string | null
  }
  links: { id: string; original_url: string; normalized_url: string; link_type: string; product_name: string | null }[]
  assets: { id: string; kind: string; external_url: string | null; file_name: string | null }[]
  events: { id: string; event_type: string; to_value: string | null; created_at: string; actor_side: string }[]
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  if (children === null || children === undefined || children === "" || children === "—") return null
  return (
    <div className="grid gap-1 border-b border-border/70 py-3 last:border-b-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm">{children}</dd>
    </div>
  )
}

function displayUrl(value: string) {
  return value.replace(/^https?:\/\//, "")
}

export default function ClientRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string; id: string }>
  searchParams: Promise<{ created?: string }>
}) {
  return (
    <Suspense fallback={<PageLoading />}>
      <ClientRequestContent params={params} searchParams={searchParams} />
    </Suspense>
  )
}

async function ClientRequestContent({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string; id: string }>
  searchParams: Promise<{ created?: string }>
}) {
  const { orgSlug, id } = await params
  const query = await searchParams
  const context = await requireClientOrg(orgSlug)
  const { data } = await context.supabase.rpc("client_request_detail", { p_request_id: id })
  if (!data || typeof data !== "object" || Array.isArray(data)) notFound()
  const detail = data as Detail
  if (!detail.request) notFound()
  const request = detail.request
  const turn = whoseTurn(request.status, request.blocker, "client")
  const budget = request.budget_inr == null
    ? null
    : `${formatInr(request.budget_inr)}${request.budget_type ? ` · ${t(`budgetType.${request.budget_type}`)}` : ""}`
  const schedule = request.start_date || request.end_date
    ? `${formatDate(request.start_date)} – ${formatDate(request.end_date)}`
    : null
  const actorLabel = (side: string) => t(side === "you" ? "request.you" : side === "agency" ? "request.agency" : "request.someone")
  return (
    <div className="grid gap-5">
      {query.created === "1" ? (
        <div className="panel p-4 text-sm" role="status">
          <p className="font-medium">{t("request.createdBanner", { number: request.request_number, time: formatDateTime(request.first_response_due_at) })}</p>
          <p className="mt-1 text-muted-foreground">{t("request.next")}</p>
        </div>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{request.request_number}</p>
          <h1 className="text-3xl font-semibold tracking-tight">{request.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={request.status} />
          {request.priority === "urgent" ? <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-medium text-rose-950">{t("priority.urgent")}</span> : null}
        </div>
      </div>
      <section className="panel p-4">
        <p className="text-lg font-semibold">{turn.label}</p>
        <dl>
          <Fact label={t("request.blocker")}>{blockerLabel(request.blocker, "client")}</Fact>
          {request.blocker_note ? <Fact label={t("request.staffNote")}>{request.blocker_note}</Fact> : null}
          <Fact label={request.first_response_at ? t("request.replied") : t("request.due")}>
            {formatDateTime(request.first_response_at ?? request.first_response_due_at)}
          </Fact>
        </dl>
      </section>
      <section className="panel px-4">
        <h2 className="pt-4 text-lg font-semibold tracking-tight">{t("request.details")}</h2>
        <dl>
          <Fact label={t("form.objective")}>{request.objective ? t(`objective.${request.objective}`) : null}</Fact>
          <Fact label={t("form.destination")}>{request.destination_type ? t(`destination.${request.destination_type}`) : null}</Fact>
          <Fact label={t("form.destinationValue")}>
            {request.destination_value?.startsWith("http") ? (
              <a className="underline underline-offset-4" href={request.destination_value} target="_blank" rel="noreferrer">{displayUrl(request.destination_value)}</a>
            ) : request.destination_value}
          </Fact>
          <Fact label={t("form.budget")}>{budget}</Fact>
          <Fact label={t("request.schedule")}>{schedule}</Fact>
          <Fact label={t("form.offerEnd")}>{request.offer_end_date ? formatDate(request.offer_end_date) : null}</Fact>
          <Fact label={t("form.locations")}>{request.locations}</Fact>
          <Fact label={t("form.audience")}>{request.audience_notes}</Fact>
          <Fact label={t("form.language")}>{request.language}</Fact>
          <Fact label={t("form.offer")}>{request.offer_details}</Fact>
          <Fact label={t("form.notes")}>{request.client_notes}</Fact>
          <Fact label={t("form.rights")}>{request.rights_confirmed_at ? formatDateTime(request.rights_confirmed_at) : null}</Fact>
        </dl>
      </section>
      <section className="grid gap-3">
        <h2 className="text-lg font-semibold tracking-tight">{t("request.links")}</h2>
        {detail.links.map((link) => (
          <article key={link.id} className="panel grid gap-2 p-4 text-sm">
            {link.product_name ? <p className="text-xs font-medium text-muted-foreground">{link.product_name}</p> : null}
            <p className="break-all">{displayUrl(link.original_url || link.normalized_url)}</p>
            {link.link_type === "share" ? <p className="text-muted-foreground">{t("request.shareCheck")}</p> : null}
            <a className="font-medium text-primary underline-offset-4 hover:underline" href={link.normalized_url} target="_blank" rel="noreferrer">{t("request.openInstagram")}</a>
          </article>
        ))}
      </section>
      <section className="panel p-4">
        <h2 className="text-lg font-semibold tracking-tight">{t("request.files")}</h2>
        {detail.assets.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">{t("request.noFiles")}</p> : (
          <ul className="mt-3 grid gap-2">
            {detail.assets.map((asset) => (
              <li key={asset.id} className="text-sm">
                <span className="text-muted-foreground">{t(`assetKind.${asset.kind}`)}</span>
                {asset.external_url ? <a className="mt-1 block break-all underline underline-offset-4" href={asset.external_url} target="_blank" rel="noreferrer">{asset.file_name || displayUrl(asset.external_url)}</a> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="panel p-4 text-sm">
        <h2 className="font-semibold">{t("request.results")}</h2>
        <p className="mt-1 text-muted-foreground">{t("request.resultsLater")}</p>
      </section>
      <ClientRequestActions
        requestId={request.id}
        orgSlug={orgSlug}
        canEdit={request.status === "submitted"}
        canCancel={CLIENT_CANCEL_STATUSES.includes(request.status)}
        canChange={request.status !== "submitted" && !["completed", "rejected", "cancelled"].includes(request.status)}
      />
      <section className="grid gap-3">
        <h2 className="text-lg font-semibold tracking-tight">{t("request.timeline")}</h2>
        {detail.events.map((event) => (
          <article key={event.id} className="panel p-4 text-sm">
            <p className="font-medium">{t(`events.${event.event_type}`)}</p>
            <p className="mt-1 text-muted-foreground">{formatDateTime(event.created_at)} · {actorLabel(event.actor_side)}</p>
            {event.to_value && event.to_value !== request.request_number ? <p className="mt-2">{event.to_value}</p> : null}
          </article>
        ))}
      </section>
    </div>
  )
}
