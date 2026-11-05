import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { publicSupabaseEnv } from "@/lib/env"
import type { Database } from "@/types/database"

const PROTECTED = [/^\/admin(?:\/|$)/, /^\/c(?:\/|$)/, /^\/change-password$/]

function copySession(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie)
  })
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = from.headers.get(header)
    if (value) to.headers.set(header, value)
  }
  return to
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  const env = publicSupabaseEnv()
  if (!env) return supabaseResponse

  const supabase = createServerClient<Database>(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options)
        })
        Object.entries(headers).forEach(([key, value]) => {
          supabaseResponse.headers.set(key, value)
        })
      },
    },
  })

  const { data } = await supabase.auth.getClaims()
  const signedIn = Boolean(data?.claims?.sub)
  const path = request.nextUrl.pathname
  const isProtected = PROTECTED.some((pattern) => pattern.test(path))

  if (!signedIn && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("next", path)
    return copySession(supabaseResponse, NextResponse.redirect(url))
  }

  if (signedIn && path === "/login") {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    url.search = ""
    return copySession(supabaseResponse, NextResponse.redirect(url))
  }

  if (path.startsWith("/admin") || path.startsWith("/c/") || path === "/change-password") {
    supabaseResponse.headers.set("Cache-Control", "private, no-store")
  }

  return supabaseResponse
}
