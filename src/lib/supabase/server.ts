import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { publicSupabaseEnv } from "@/lib/env"
import type { Database } from "@/types/database"

export async function createClient() {
  const env = publicSupabaseEnv()
  if (!env) {
    throw new Error("Supabase is not configured")
  }
  const cookieStore = await cookies()
  return createServerClient<Database>(env.url, env.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Server Components cannot write cookies. The proxy refreshes the session.
        }
      },
    },
  })
}
