"use server"

import { revalidatePath } from "next/cache"
import { errorText } from "@/lib/auth/errors"
import { sendPushToAgency, sendPushToUsers } from "@/lib/push/send"
import { requireAgency, requireUser } from "@/lib/auth/session"
import { t } from "@/lib/i18n"
import { draftToPayload } from "@/lib/requests/payload"
import type { RequestStatus } from "@/lib/requests/status"
import { canTransition } from "@/lib/requests/status"
import { draftSchema } from "@/lib/validation/schemas"
import type { Json } from "@/types/database"

export type RequestActionResult = { ok: true; id?: string } | { ok: false; error: string }

async function orgSlug(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], orgId: string) {
  const { data } = await supabase.from("organizations").select("slug").eq("id", orgId).maybeSingle()
  return data?.slug ?? ""
}

export async function saveDraft(orgId: string, draft: unknown): Promise<RequestActionResult> {
  const context = await requireUser()
  const parsed = draftSchema.safeParse(draft)
  if (!parsed.success) return { ok: false, error: t("errors.generic") }
  const { error } = await context.supabase.from("request_drafts").upsert(
    {
      org_id: orgId,
      user_id: context.user.id,
      payload: parsed.data as unknown as Json,
    },
    { onConflict: "org_id,user_id" },
  )
  if (error) return { ok: false, error: errorText(error) }
  return { ok: true }
}

export async function discardDraft(orgId: string): Promise<RequestActionResult> {
  const context = await requireUser()
  const { error } = await context.supabase.from("request_drafts").delete().eq("org_id", orgId).eq("user_id", context.user.id)
  if (error) return { ok: false, error: errorText(error) }
  return { ok: true }
}

export async function submitRequest(orgId: string, draft: unknown): Promise<RequestActionResult> {
  const context = await requireUser()
  const parsedDraft = draftSchema.safeParse(draft)
  if (!parsedDraft.success) return { ok: false, error: t("errors.generic") }
  const payload = draftToPayload(parsedDraft.data)
  if (!payload.ok) {
    return { ok: false, error: payload.error === "date_order" ? t("form.dateOrder") : t(`errors.${payload.error}`) }
  }
  const { data, error } = await context.supabase.rpc("submit_request", {
    p_org_id: orgId,
    p_payload: payload.payload as unknown as Json,
  })
  if (error || !data) return { ok: false, error: errorText(error) }
  const slug = await orgSlug(context.supabase, orgId)
  await sendPushToAgency({
    title: t("nav.requests"),
    body: payload.payload.title,
    url: `/admin/requests/${data}`,
  }).catch(() => undefined)
  revalidatePath(`/c/${slug}`)
  revalidatePath("/admin/requests")
  return { ok: true, id: data }
}

export async function updateSubmittedRequest(requestId: string, orgId: string, draft: unknown): Promise<RequestActionResult> {
  const context = await requireUser()
  const parsedDraft = draftSchema.safeParse(draft)
  if (!parsedDraft.success) return { ok: false, error: t("errors.generic") }
  const payload = draftToPayload(parsedDraft.data)
  if (!payload.ok) {
    return { ok: false, error: payload.error === "date_order" ? t("form.dateOrder") : t(`errors.${payload.error}`) }
  }
  const { error } = await context.supabase.rpc("update_submitted_request", {
    p_request_id: requestId,
    p_payload: payload.payload as unknown as Json,
  })
  if (error) return { ok: false, error: errorText(error) }
  const slug = await orgSlug(context.supabase, orgId)
  revalidatePath(`/c/${slug}/requests/${requestId}`)
  return { ok: true, id: requestId }
}

export async function cancelOwnRequest(requestId: string, orgSlugValue: string): Promise<RequestActionResult> {
  const context = await requireUser()
  const { error } = await context.supabase.rpc("cancel_request", { p_request_id: requestId })
  if (error) return { ok: false, error: errorText(error) }
  revalidatePath(`/c/${orgSlugValue}/requests/${requestId}`)
  return { ok: true }
}

export async function askForChange(requestId: string, orgSlugValue: string, note: string): Promise<RequestActionResult> {
  const context = await requireUser()
  const { error } = await context.supabase.rpc("request_change", { p_request_id: requestId, p_note: note })
  if (error) return { ok: false, error: errorText(error) }
  revalidatePath(`/c/${orgSlugValue}/requests/${requestId}`)
  revalidatePath(`/admin/requests/${requestId}`)
  return { ok: true }
}

export async function createProduct(orgId: string, name: string): Promise<{ ok: true; id: string; name: string } | { ok: false; error: string }> {
  const context = await requireUser()
  const trimmed = name.trim()
  if (trimmed.length < 2) return { ok: false, error: t("form.productName") }
  const { data, error } = await context.supabase
    .from("products")
    .insert({ org_id: orgId, name: trimmed })
    .select("id, name")
    .single()
  if (error || !data) return { ok: false, error: errorText(error) }
  return { ok: true, id: data.id, name: data.name }
}

export async function checkDuplicates(orgId: string, urls: string[]) {
  const context = await requireUser()
  const { parseInstagramUrl } = await import("@/lib/instagram")
  const normalized: string[] = []
  const shortcodes: string[] = []
  for (const url of urls) {
    const parsed = parseInstagramUrl(url)
    if (!parsed.ok) continue
    normalized.push(parsed.normalizedUrl)
    if (parsed.shortcode) shortcodes.push(parsed.shortcode)
  }
  if (normalized.length === 0) return []
  const { data } = await context.supabase.rpc("find_duplicate_links", {
    p_org_id: orgId,
    p_normalized: normalized,
    p_shortcodes: shortcodes,
  })
  if (!Array.isArray(data)) return []
  return data as { request_number: string; title: string; normalized_url: string; shortcode: string | null }[]
}

export async function changeStatus(requestId: string, status: RequestStatus, note: string): Promise<RequestActionResult> {
  const context = await requireAgency()
  const { data: current } = await context.supabase
    .from("requests")
    .select("status, org_id, submitted_by, title, request_number")
    .eq("id", requestId)
    .maybeSingle()
  if (!current || !canTransition(current.status, status)) return { ok: false, error: t("errors.invalid_status") }
  const { error } = await context.supabase.rpc("change_request_status", {
    p_request_id: requestId,
    p_status: status,
    p_note: note.trim() || undefined,
  })
  if (error) return { ok: false, error: errorText(error) }
  if (current.submitted_by) {
    const slug = await orgSlug(context.supabase, current.org_id)
    await sendPushToUsers([current.submitted_by], {
      title: current.request_number,
      body: `${current.title} · ${t(`status.${status}`)}`,
      url: `/c/${slug}/requests/${requestId}`,
    }).catch(() => undefined)
  }
  revalidatePath(`/admin/requests/${requestId}`)
  return { ok: true }
}

export async function changeBlocker(
  requestId: string,
  blocker: "none" | "waiting_on_client" | "waiting_on_creator_approval" | "waiting_on_agency" | "waiting_on_meta",
  note: string,
): Promise<RequestActionResult> {
  const context = await requireAgency()
  const { error } = await context.supabase.rpc("set_request_blocker", {
    p_request_id: requestId,
    p_blocker: blocker,
    p_note: note,
  })
  if (error) return { ok: false, error: errorText(error) }
  revalidatePath(`/admin/requests/${requestId}`)
  return { ok: true }
}

export async function assignRequest(requestId: string, assignee: string): Promise<RequestActionResult> {
  const context = await requireAgency()
  const { error } = await context.supabase.rpc("set_request_assignment", {
    p_request_id: requestId,
    p_assignee: assignee || null,
  })
  if (error) return { ok: false, error: errorText(error) }
  revalidatePath(`/admin/requests/${requestId}`)
  return { ok: true }
}

export async function saveLinkCheck(input: {
  linkId: string
  requestId: string
  method: "unknown" | "own_account" | "ad_code" | "partner_boost" | "account_level"
  status: "not_checked" | "requested" | "received" | "approved" | "blocked"
  adCode: string
  music: "not_checked" | "ok" | "issue"
  notes: string
}): Promise<RequestActionResult> {
  const context = await requireAgency()
  const { error } = await context.supabase.rpc("update_link_checks", {
    p_link_id: input.linkId,
    p_method: input.method,
    p_status: input.status,
    p_ad_code: input.adCode,
    p_music: input.music,
    p_notes: input.notes,
  })
  if (error) return { ok: false, error: errorText(error) }
  revalidatePath(`/admin/requests/${input.requestId}`)
  return { ok: true }
}
