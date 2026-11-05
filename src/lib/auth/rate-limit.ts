import { createHash } from "crypto"
import { headers } from "next/headers"
import { createAdminClient } from "@/lib/supabase/admin"

export async function allowRateLimit(
  action: string,
  subject: string,
  limit: number,
  windowSeconds: number,
): Promise<"ok" | "limited" | "not_configured"> {
  const admin = createAdminClient()
  if (!admin) return "not_configured"
  const headerList = await headers()
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() || "local"
  const subjectHash = createHash("sha256").update(`${ip}:${subject.toLowerCase()}`).digest("hex")
  const { data, error } = await admin.rpc("consume_rate_limit", {
    p_action: action,
    p_subject_hash: subjectHash,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  })
  if (error) return "not_configured"
  if (data !== true) return "limited"
  return "ok"
}
