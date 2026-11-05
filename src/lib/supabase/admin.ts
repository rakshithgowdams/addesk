import "server-only"
import { createClient } from "@supabase/supabase-js"
import { publicSupabaseEnv } from "@/lib/env"
import type { Database } from "@/types/database"

export function createAdminClient() {
  const env = publicSupabaseEnv()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!env || !key) return null
  return createClient<Database>(env.url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
