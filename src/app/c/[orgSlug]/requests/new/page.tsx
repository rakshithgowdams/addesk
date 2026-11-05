import { redirect } from "next/navigation"
import { RequestForm } from "@/components/requests/request-form"
import { requireClientOrg } from "@/lib/auth/session"
import { draftSchema, type DraftState } from "@/lib/validation/schemas"

export default async function NewRequestPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params
  const context = await requireClientOrg(orgSlug)
  if (context.organization.status !== "active") redirect(`/c/${orgSlug}`)
  const [{ data: brands }, { data: products }, { data: draft }, { data: support }] = await Promise.all([
    context.supabase.from("brand_accounts").select("id, instagram_handle").eq("org_id", context.organization.id),
    context.supabase.from("products").select("id, name").eq("org_id", context.organization.id).eq("is_archived", false),
    context.supabase.from("request_drafts").select("payload").eq("org_id", context.organization.id).eq("user_id", context.user.id).maybeSingle(),
    context.supabase.rpc("client_request_support", { p_org_id: context.organization.id }),
  ])
  const supportRecord = support && typeof support === "object" && !Array.isArray(support) ? support : {}
  const initial = draft?.payload ? draftSchema.safeParse(draft.payload) : null
  const last = "last_ad" in supportRecord ? supportRecord.last_ad : null
  return (
    <RequestForm
      orgId={context.organization.id}
      orgSlug={orgSlug}
      brands={brands ?? []}
      products={products ?? []}
      urgentUsed={Number("urgent_used" in supportRecord ? supportRecord.urgent_used : 0)}
      urgentLimit={Number("urgent_limit" in supportRecord ? supportRecord.urgent_limit : 2)}
      lastAd={last && typeof last === "object" ? mapLast(last as Record<string, unknown>) : null}
      initial={initial?.success ? initial.data : undefined}
    />
  )
}

function mapLast(last: Record<string, unknown>): Partial<DraftState> {
  return {
    objective: String(last.objective ?? "messages"),
    destinationType: (last.destination_type as DraftState["destinationType"]) ?? "whatsapp",
    destinationValue: String(last.destination_value ?? ""),
    budgetInr: last.budget_inr == null ? "" : String(last.budget_inr),
    budgetType: (last.budget_type as DraftState["budgetType"]) ?? "daily",
    startDate: String(last.start_date ?? ""),
    endDate: String(last.end_date ?? ""),
    offerEndDate: String(last.offer_end_date ?? ""),
    locations: String(last.locations ?? ""),
    audienceNotes: String(last.audience_notes ?? ""),
    language: String(last.language ?? ""),
    offerDetails: String(last.offer_details ?? ""),
    clientNotes: String(last.client_notes ?? ""),
  }
}
