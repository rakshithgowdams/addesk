import "server-only"
import webpush from "web-push"
import { createAdminClient } from "@/lib/supabase/admin"

export type PushMessage = {
  title: string
  body: string
  url: string
}

function configured() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return null
  return { publicKey, privateKey }
}

export async function sendPushToUsers(userIds: string[], message: PushMessage) {
  const keys = configured()
  const ids = [...new Set(userIds.filter(Boolean))]
  if (!keys || ids.length === 0) return
  const admin = createAdminClient()
  if (!admin) return
  webpush.setVapidDetails("mailto:notifications@addesk.local", keys.publicKey, keys.privateKey)
  const primary = await admin.from("push_subscriptions").select("endpoint, p256dh, auth").in("user_id", ids)
  let rows: { endpoint: string; p256dh: string; auth: string }[] = primary.data ?? []
  if (primary.error) {
    const fallback = await admin.from("notifications").select("title, body").eq("type", "push_subscription").in("user_id", ids)
    rows = (fallback.data ?? []).flatMap((row) => {
      try {
        const stored = JSON.parse(row.body) as { p256dh?: string; auth?: string }
        if (!stored.p256dh || !stored.auth) return []
        return [{ endpoint: row.title, p256dh: stored.p256dh, auth: stored.auth }]
      } catch {
        return []
      }
    })
  }
  await Promise.all(
    rows.map(async (row) => {
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          JSON.stringify(message),
        )
      } catch (error) {
        const status = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").delete().eq("endpoint", row.endpoint)
          await admin.from("notifications").delete().eq("type", "push_subscription").eq("title", row.endpoint)
        }
      }
    }),
  )
}

export async function sendPushToAgency(message: PushMessage) {
  const admin = createAdminClient()
  if (!admin) return
  const { data } = await admin
    .from("profiles")
    .select("id")
    .in("platform_role", ["super_admin", "staff"])
    .eq("is_active", true)
  await sendPushToUsers((data ?? []).map((row) => row.id), message)
}
