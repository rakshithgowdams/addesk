"use server"

import { requireUser } from "@/lib/auth/session"
import { t } from "@/lib/i18n"
import { createAdminClient } from "@/lib/supabase/admin"

type SubscriptionInput = {
  endpoint?: string
  keys?: { p256dh?: string; auth?: string }
}

export async function savePushSubscription(input: SubscriptionInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const context = await requireUser()
  const endpoint = input.endpoint?.trim() ?? ""
  const p256dh = input.keys?.p256dh ?? ""
  const auth = input.keys?.auth ?? ""
  if (!endpoint.startsWith("https://") || !p256dh || !auth) return { ok: false, error: t("pwa.pushFailed") }
  const admin = createAdminClient()
  if (!admin) return { ok: false, error: t("errors.not_configured") }
  const saved = await admin.from("push_subscriptions").upsert(
    { user_id: context.user.id, endpoint, p256dh, auth },
    { onConflict: "endpoint" },
  )
  if (!saved.error) return { ok: true }
  await admin.from("notifications").delete().eq("type", "push_subscription").eq("title", endpoint)
  const fallback = await admin.from("notifications").insert({
    user_id: context.user.id,
    type: "push_subscription",
    title: endpoint,
    body: JSON.stringify({ p256dh, auth }),
  })
  if (fallback.error) return { ok: false, error: t("pwa.pushFailed") }
  return { ok: true }
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  const context = await requireUser()
  if (!endpoint.startsWith("https://")) return
  const admin = createAdminClient()
  if (!admin) return
  await admin.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", context.user.id)
  await admin.from("notifications").delete().eq("type", "push_subscription").eq("title", endpoint).eq("user_id", context.user.id)
}
