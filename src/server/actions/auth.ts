"use server"

import { redirect } from "next/navigation"
import { z } from "zod"
import { errorText } from "@/lib/auth/errors"
import { isStrongPassword } from "@/lib/auth/passwords"
import { allowRateLimit } from "@/lib/auth/rate-limit"
import { requireUser } from "@/lib/auth/session"
import { t } from "@/lib/i18n"
import { appUrl } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"

export type ActionState = { error?: string; message?: string }

const credentials = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(72),
})

function safeNext(value: FormDataEntryValue | null): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/"
  return value
}

export async function signIn(_state: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })
  if (!parsed.success) return { error: t("auth.invalid") }

  const limit = await allowRateLimit("login", parsed.data.email, 5, 15 * 60)
  if (limit === "not_configured") return { error: t("auth.notConfigured") }
  if (limit === "limited") return { error: t("auth.rateLimited") }

  let supabase: Awaited<ReturnType<typeof createClient>>
  try {
    supabase = await createClient()
  } catch {
    return { error: t("auth.notConfigured") }
  }
  const { data: signedIn, error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error || !signedIn.user) return { error: t("auth.invalid") }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_active, must_change_password, platform_role")
    .eq("id", signedIn.user.id)
    .maybeSingle()

  if (profileError || !profile) {
    await supabase.auth.signOut()
    return { error: t("auth.noProfile") }
  }
  if (!profile.is_active) {
    await supabase.auth.signOut()
    return { error: t("auth.disabled") }
  }
  if (profile.must_change_password) redirect("/change-password")
  redirect(safeNext(formData.get("next")))
}

export async function requestPasswordReset(_state: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "")
  const parsed = z.string().trim().email().safeParse(email)
  if (!parsed.success) return { message: t("auth.resetSent") }

  const limit = await allowRateLimit("password_reset_request", parsed.data, 5, 15 * 60)
  if (limit === "not_configured") return { error: t("auth.notConfigured") }
  if (limit === "limited") return { error: t("auth.rateLimited") }

  const supabase = await createClient()
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${appUrl()}/auth/callback?next=/reset-password`,
  })
  return { message: t("auth.resetSent") }
}

export async function updatePassword(_state: ActionState, formData: FormData): Promise<ActionState> {
  const password = String(formData.get("password") ?? "")
  const confirm = String(formData.get("confirm") ?? "")
  if (!isStrongPassword(password)) return { error: t("auth.weak") }
  if (password !== confirm) return { error: t("auth.mismatch") }

  const context = await requireUser({ allowPasswordChange: true })
  const { error } = await context.supabase.auth.updateUser({ password })
  if (error) return { error: errorText(error) }
  const { error: flagError } = await context.supabase.rpc("complete_password_change")
  if (flagError) return { error: errorText(flagError) }
  redirect("/")
}

export async function signOut() {
  try {
    const supabase = await createClient()
    await supabase.auth.signOut()
  } catch {
    redirect("/login")
  }
  redirect("/login")
}
