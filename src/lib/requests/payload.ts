import { isAllowedReferenceUrl, parseInstagramUrl } from "@/lib/instagram"
import { draftSchema, requestPayloadSchema, type DraftState, type RequestPayload } from "@/lib/validation/schemas"

export function draftToPayload(input: DraftState): { ok: true; payload: RequestPayload } | { ok: false; error: string } {
  const links = []
  for (const [index, link] of input.links.entries()) {
    if (!link.url.trim()) continue
    const parsed = parseInstagramUrl(link.url)
    if (!parsed.ok) return { ok: false, error: "invalid_instagram_url" }
    links.push({
      originalUrl: parsed.originalUrl,
      normalizedUrl: parsed.normalizedUrl,
      shortcode: parsed.shortcode,
      linkType: parsed.linkType,
      productId: link.productId || null,
      sortOrder: index,
    })
  }
  if (links.length === 0) return { ok: false, error: "invalid_links" }

  const assets = []
  for (const asset of input.assets) {
    if (!asset.url.trim()) continue
    if (!isAllowedReferenceUrl(asset.url)) return { ok: false, error: "invalid_reference_url" }
    assets.push({
      kind: asset.kind,
      externalUrl: asset.url.trim(),
      fileName: new URL(asset.url.trim()).hostname,
    })
  }

  const budget = input.budgetInr.trim() === "" ? null : Number(input.budgetInr)
  if (budget !== null && !Number.isFinite(budget)) return { ok: false, error: "generic" }

  const parsed = requestPayloadSchema.safeParse({
    title: input.title,
    priority: input.priority,
    brandAccountId: input.brandAccountId,
    objective: input.objective,
    destinationType: input.destinationType,
    destinationValue: input.destinationValue,
    budgetInr: budget,
    budgetType: budget === null ? null : input.budgetType,
    startDate: input.startDate || null,
    endDate: input.endDate || null,
    offerEndDate: input.offerEndDate || null,
    locations: input.locations,
    audienceNotes: input.audienceNotes,
    language: input.language,
    offerDetails: input.offerDetails,
    clientNotes: input.clientNotes,
    rightsConfirmed: input.rightsConfirmed ? true : undefined,
    links,
    assets,
  })

  if (!parsed.success) {
    const issue = parsed.error.issues[0]?.message
    if (issue === "date_order") return { ok: false, error: "date_order" }
    if (!input.rightsConfirmed) return { ok: false, error: "rights_required" }
    return { ok: false, error: "generic" }
  }

  return { ok: true, payload: parsed.data }
}

export function parseDraft(input: unknown): DraftState {
  return draftSchema.parse(input)
}
