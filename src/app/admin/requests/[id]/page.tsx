import Link from "next/link"
import { notFound } from "next/navigation"
import { AssignmentForm, BlockerForm, LinkCheckForm, StatusForm } from "@/components/admin/request-manage"
import { StatusBadge } from "@/components/status-badge"
import { requireAgency } from "@/lib/auth/session"
import { formatDate, formatDateTime, formatInr } from "@/lib/format"
import { t } from "@/lib/i18n"
import { blockerLabel, whoseTurn } from "@/lib/requests/presentation"

export default async function AdminRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const context = await requireAgency()
  const { data: request } = await context.supabase.from("requests").select("*").eq("id", id).maybeSingle()
  if (!request) notFound()
  const [{ data: organization }, { data: links }, { data: events }, { data: assets }, { data: staff }] = await Promise.all([
    context.supabase.from("organizations").select("id, name, slug").eq("id", request.org_id).maybeSingle(),
    context.supabase.from("request_links").select("*").eq("request_id", id).order("sort_order"),
    context.supabase.from("request_events").select("*").eq("request_id", id).order("created_at"),
    context.supabase.from("request_assets").select("*").eq("request_id", id),
    context.supabase.from("profiles").select("id, full_name").not("platform_role", "is", null),
  ])
  const turn = whoseTurn(request.status, request.blocker, "agency")

  return (
    <div className="grid gap-4">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href={`/admin/clients/${request.org_id}`} className="underline-offset-4 hover:underline">{organization?.name}</Link>
        </p>
        <h1 className="text-2xl font-semibold">{request.request_number}</h1>
        <p>{request.title}</p>
      </div>
      <div className="grid gap-2 rounded-xl border bg-card p-4">
        <StatusBadge status={request.status} />
        <p className="font-medium">{turn.label}</p>
        <p>{t("request.blocker")}: {blockerLabel(request.blocker, "agency")}</p>
        {request.blocker_note ? <p>{request.blocker_note}</p> : null}
        <p className="text-sm">{t("request.due")}: {formatDateTime(request.first_response_due_at)}</p>
        {request.first_response_at ? <p className="text-sm">{t("request.replied")}: {formatDateTime(request.first_response_at)}</p> : null}
      </div>
      <section className="grid gap-4 lg:grid-cols-2">
        <StatusForm requestId={request.id} status={request.status} />
        <BlockerForm requestId={request.id} blocker={request.blocker} note={request.blocker_note} />
        <AssignmentForm requestId={request.id} assignedTo={request.assigned_to} staff={staff ?? []} />
      </section>
      <section className="panel px-4">
        <h2 className="pt-4 text-lg font-semibold tracking-tight">{t("request.details")}</h2>
        <dl>
          <div className="grid gap-1 border-b border-border/70 py-3"><dt className="text-xs font-medium text-muted-foreground">{t("form.objective")}</dt><dd className="text-sm">{request.objective ? t(`objective.${request.objective}`) : "—"}</dd></div>
          <div className="grid gap-1 border-b border-border/70 py-3"><dt className="text-xs font-medium text-muted-foreground">{t("form.destination")}</dt><dd className="break-words text-sm">{[request.destination_type ? t(`destination.${request.destination_type}`) : null, request.destination_value].filter(Boolean).join(" · ") || "—"}</dd></div>
          <div className="grid gap-1 border-b border-border/70 py-3"><dt className="text-xs font-medium text-muted-foreground">{t("form.budget")}</dt><dd className="text-sm">{formatInr(request.budget_inr)}{request.budget_type ? ` · ${t(`budgetType.${request.budget_type}`)}` : ""}</dd></div>
          <div className="grid gap-1 border-b border-border/70 py-3"><dt className="text-xs font-medium text-muted-foreground">{t("request.schedule")}</dt><dd className="text-sm">{formatDate(request.start_date)} – {formatDate(request.end_date)}</dd></div>
          <div className="grid gap-1 border-b border-border/70 py-3"><dt className="text-xs font-medium text-muted-foreground">{t("form.locations")}</dt><dd className="text-sm">{request.locations || "—"}</dd></div>
          <div className="grid gap-1 border-b border-border/70 py-3"><dt className="text-xs font-medium text-muted-foreground">{t("form.audience")}</dt><dd className="text-sm">{request.audience_notes || "—"}</dd></div>
          <div className="grid gap-1 border-b border-border/70 py-3"><dt className="text-xs font-medium text-muted-foreground">{t("form.language")}</dt><dd className="text-sm">{request.language || "—"}</dd></div>
          <div className="grid gap-1 border-b border-border/70 py-3"><dt className="text-xs font-medium text-muted-foreground">{t("form.offer")}</dt><dd className="text-sm">{request.offer_details || "—"}</dd></div>
          <div className="grid gap-1 py-3"><dt className="text-xs font-medium text-muted-foreground">{t("form.notes")}</dt><dd className="text-sm">{request.client_notes || "—"}</dd></div>
        </dl>
      </section>
      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">{t("request.readiness")}</h2>
        {(links ?? []).map((link) => (
          <LinkCheckForm key={link.id} requestId={request.id} link={link} />
        ))}
      </section>
      <section className="grid gap-2">
        <h2 className="text-lg font-semibold">{t("request.files")}</h2>
        {(assets ?? []).length === 0 ? <p className="text-sm text-muted-foreground">{t("request.noFiles")}</p> : null}
        {(assets ?? []).map((asset) => (
          <p key={asset.id} className="text-sm">
            {t(`assetKind.${asset.kind}`)}{" "}
            {asset.external_url ? <a className="underline" href={asset.external_url}>{asset.external_url}</a> : asset.file_name}
          </p>
        ))}
      </section>
      <section className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">{t("request.internalLater")}</section>
      <section className="rounded-xl border p-4 text-sm">
        <h2 className="font-semibold">{t("request.results")}</h2>
        <p className="mt-1 text-muted-foreground">{t("request.resultsLater")}</p>
      </section>
      <section className="grid gap-2">
        <h2 className="text-lg font-semibold">{t("request.timeline")}</h2>
        {(events ?? []).map((event) => (
          <div key={event.id} className={event.client_visible ? "rounded-lg border p-3 text-sm" : "rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm"}>
            <p className="font-medium">{t(`events.${event.event_type}`)}{event.client_visible ? "" : ` · ${t("request.staffNote")}`}</p>
            <p className="text-muted-foreground">{formatDateTime(event.created_at)}</p>
            {event.to_value ? <p>{event.to_value}</p> : null}
          </div>
        ))}
      </section>
    </div>
  )
}
