import { notFound, redirect } from "next/navigation"
import { RequestForm } from "@/components/requests/request-form"
import { requireClientOrg } from "@/lib/auth/session"
import { draftSchema, type DraftState } from "@/lib/validation/schemas"

export default async function EditRequestPage({ params }: { params: Promise<{ orgSlug: string; id: string }> }) {
  const { orgSlug, id } = await params
  const context = await requireClientOrg(orgSlug)
  const { data } = await context.supabase.rpc("client_request_detail", { p_request_id: id })
  if (!data || typeof data !== "object" || Array.isArray(data) || !("request" in data)) notFound()
  const detail = data as {
    request: Record<string, string | null>
    links: { original_url: string; product_id: string | null }[]
    assets: { kind: DraftState["assets"][number]["kind"]; external_url: string | null }[]
  }
  if (detail.request.status !== "submitted") redirect(`/c/${orgSlug}/requests/${id}`)
  const [{ data: brands }, { data: products }, { data: support }] = await Promise.all([
    context.supabase.from("brand_accounts").select("id, instagram_handle").eq("org_id", context.organization.id),
    context.supabase.from("products").select("id, name").eq("org_id", context.organization.id).eq("is_archived", false),
    context.supabase.rpc("client_request_support", { p_org_id: context.organization.id }),
  ])
  const supportRecord = support && typeof support === "object" && !Array.isArray(support) ? support : {}
  const initial = draftSchema.parse({
    title: detail.request.title ?? "",
    priority: detail.request.priority ?? "normal",
    brandAccountId: detail.request.brand_account_id ?? brands?.[0]?.id ?? "",
    objective: detail.request.objective ?? "messages",
    destinationType: detail.request.destination_type ?? "whatsapp",
    destinationValue: detail.request.destination_value ?? "",
    budgetInr: detail.request.budget_inr ?? "",
    budgetType: detail.request.budget_type ?? "daily",
    startDate: detail.request.start_date ?? "",
    endDate: detail.request.end_date ?? "",
    offerEndDate: detail.request.offer_end_date ?? "",
    locations: detail.request.locations ?? "",
    audienceNotes: detail.request.audience_notes ?? "",
    language: detail.request.language ?? "",
    offerDetails: detail.request.offer_details ?? "",
    clientNotes: detail.request.client_notes ?? "",
    rightsConfirmed: true,
    links: detail.links.map((link) => ({ url: link.original_url, productId: link.product_id ?? "" })),
    assets: detail.assets.filter((asset) => asset.external_url).map((asset) => ({ kind: asset.kind, url: asset.external_url ?? "" })),
  })
  return (
    <RequestForm
      orgId={context.organization.id}
      orgSlug={orgSlug}
      brands={brands ?? []}
      products={products ?? []}
      urgentUsed={Number("urgent_used" in supportRecord ? supportRecord.urgent_used : 0)}
      urgentLimit={Number("urgent_limit" in supportRecord ? supportRecord.urgent_limit : 2)}
      lastAd={null}
      initial={initial}
      requestId={id}
    />
  )
}
