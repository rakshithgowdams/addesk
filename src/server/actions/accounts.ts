"use server"

import { revalidatePath } from "next/cache"
import { errorText } from "@/lib/auth/errors"
import { generatePassword, isStrongPassword } from "@/lib/auth/passwords"
import { allowRateLimit } from "@/lib/auth/rate-limit"
import { requireAgency, requireSuperAdmin } from "@/lib/auth/session"
import { t } from "@/lib/i18n"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  addMemberSchema,
  addStaffSchema,
  brandSchema,
  brandUpdateSchema,
  createClientSchema,
  orgSettingsSchema,
} from "@/lib/validation/schemas"

export type CreatedLogin = {
  ok: true
  password: string | null
  existingUser: boolean
  orgId?: string
}

export type AccountError = { ok: false; error: string }

function validationError(error: { issues: { path: PropertyKey[] }[] }): string {
  const path = String(error.issues[0]?.path[0] ?? "")
  if (path === "instagramHandle") return t("errors.invalid_handle")
  if (path === "phone") return t("errors.invalid_phone")
  if (path === "slug") return t("errors.invalid_slug")
  if (path === "prefix") return t("errors.invalid_prefix")
  if (path === "email") return t("errors.invalid_email")
  return t("errors.generic")
}

async function ensureProfile(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  userId: string,
  email: string,
  fullName: string,
  phone = "",
) {
  const existing = await admin.from("profiles").select("id").eq("id", userId).maybeSingle()
  if (existing.data) {
    if (!phone) return null
    const updated = await admin.from("profiles").update({ phone }).eq("id", userId)
    return updated.error
  }
  const inserted = await admin.from("profiles").insert({
    id: userId,
    email,
    full_name: fullName,
    phone: phone || null,
    is_active: true,
    must_change_password: true,
  })
  return inserted.error
}

async function temporaryPassword(requested: string) {
  if (!requested) return generatePassword()
  if (!isStrongPassword(requested)) return null
  return requested
}

export async function createClientAccount(input: unknown): Promise<CreatedLogin | AccountError> {
  const context = await requireSuperAdmin()
  const parsed = createClientSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: validationError(parsed.error) }

  const limit = await allowRateLimit("create_account", context.user.id, 20, 60 * 60)
  if (limit === "not_configured") return { ok: false, error: t("errors.not_configured") }
  if (limit === "limited") return { ok: false, error: t("errors.rate_limited") }

  const admin = createAdminClient()
  if (!admin) return { ok: false, error: t("errors.not_configured") }

  const email = parsed.data.email.toLowerCase()
  const { data: existing } = await admin.from("profiles").select("id").eq("email", email).maybeSingle()

  let userId = existing?.id ?? null
  let createdUserId: string | null = null
  let password: string | null = null

  if (!userId) {
    password = await temporaryPassword(parsed.data.password)
    if (!password) return { ok: false, error: t("auth.weak") }
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: parsed.data.contactName },
    })
    if (error || !data.user) return { ok: false, error: errorText(error) }
    userId = data.user.id
    createdUserId = data.user.id
  }

  const profileError = await ensureProfile(admin, userId, email, parsed.data.contactName, parsed.data.phone)
  if (profileError) return { ok: false, error: errorText(profileError) }

  const { data: orgId, error } = await admin.rpc("provision_client", {
    p_actor: context.user.id,
    p_user_id: userId,
    p_full_name: parsed.data.contactName,
    p_org_name: parsed.data.name,
    p_slug: parsed.data.slug,
    p_prefix: parsed.data.prefix,
    p_instagram_handle: parsed.data.instagramHandle,
    p_force_password: Boolean(createdUserId),
  })

  if (error || !orgId) {
    if (createdUserId) await admin.auth.admin.deleteUser(createdUserId)
    return { ok: false, error: errorText(error) }
  }

  revalidatePath("/admin/clients")
  return { ok: true, password, existingUser: !createdUserId, orgId }
}

export async function addClientMember(input: unknown): Promise<CreatedLogin | AccountError> {
  const context = await requireSuperAdmin()
  const parsed = addMemberSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: validationError(parsed.error) }
  const admin = createAdminClient()
  if (!admin) return { ok: false, error: t("errors.not_configured") }

  const limit = await allowRateLimit("create_account", context.user.id, 20, 60 * 60)
  if (limit !== "ok") return { ok: false, error: t(limit === "limited" ? "errors.rate_limited" : "errors.not_configured") }

  const email = parsed.data.email.toLowerCase()
  const { data: existing } = await admin.from("profiles").select("id").eq("email", email).maybeSingle()
  let userId = existing?.id ?? null
  let createdUserId: string | null = null
  let password: string | null = null

  if (!userId) {
    password = await temporaryPassword(parsed.data.password)
    if (!password) return { ok: false, error: t("auth.weak") }
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: parsed.data.fullName },
    })
    if (error || !data.user) return { ok: false, error: errorText(error) }
    userId = data.user.id
    createdUserId = data.user.id
  }

  const profileError = await ensureProfile(admin, userId, email, parsed.data.fullName, parsed.data.phone)
  if (profileError) {
    if (createdUserId) await admin.auth.admin.deleteUser(createdUserId)
    return { ok: false, error: errorText(profileError) }
  }

  const { error } = await admin.rpc("add_org_member", {
    p_actor: context.user.id,
    p_user_id: userId,
    p_org_id: parsed.data.orgId,
    p_role: parsed.data.role,
    p_full_name: parsed.data.fullName,
    p_new_user: Boolean(createdUserId),
  })
  if (error) {
    if (createdUserId) await admin.auth.admin.deleteUser(createdUserId)
    return { ok: false, error: errorText(error) }
  }
  revalidatePath(`/admin/clients/${parsed.data.orgId}`)
  return { ok: true, password, existingUser: !createdUserId }
}

export async function addStaffMember(input: unknown): Promise<CreatedLogin | AccountError> {
  const context = await requireSuperAdmin()
  const parsed = addStaffSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: t("errors.generic") }
  const admin = createAdminClient()
  if (!admin) return { ok: false, error: t("errors.not_configured") }

  const limit = await allowRateLimit("create_account", context.user.id, 20, 60 * 60)
  if (limit !== "ok") return { ok: false, error: t(limit === "limited" ? "errors.rate_limited" : "errors.not_configured") }

  const email = parsed.data.email.toLowerCase()
  const { data: existing } = await admin.from("profiles").select("id, platform_role").eq("email", email).maybeSingle()
  let userId = existing?.id ?? null
  let createdUserId: string | null = null
  let password: string | null = null

  if (!userId) {
    password = await temporaryPassword(parsed.data.password)
    if (!password) return { ok: false, error: t("auth.weak") }
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: parsed.data.fullName },
    })
    if (error || !data.user) return { ok: false, error: errorText(error) }
    userId = data.user.id
    createdUserId = data.user.id
  }

  const profileError = await ensureProfile(admin, userId, email, parsed.data.fullName)
  if (profileError) {
    if (createdUserId) await admin.auth.admin.deleteUser(createdUserId)
    return { ok: false, error: errorText(profileError) }
  }

  const { error } = await admin
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      platform_role: parsed.data.role,
      must_change_password: Boolean(createdUserId),
    })
    .eq("id", userId)
  if (error) {
    if (createdUserId) await admin.auth.admin.deleteUser(createdUserId)
    return { ok: false, error: errorText(error) }
  }

  await admin.from("audit_logs").insert({
    actor_id: context.user.id,
    action: existing ? "staff_role_changed" : "staff_created",
    target_type: "user",
    target_id: userId,
    metadata: { role: parsed.data.role },
  })
  revalidatePath("/admin/team")
  return { ok: true, password, existingUser: !createdUserId }
}

export async function setUserActive(userId: string, isActive: boolean): Promise<AccountError | { ok: true }> {
  const context = await requireSuperAdmin()
  if (userId === context.user.id && !isActive) return { ok: false, error: t("errors.last_super_admin") }
  const admin = createAdminClient()
  if (!admin) return { ok: false, error: t("errors.not_configured") }

  const { error } = await admin.from("profiles").update({ is_active: isActive }).eq("id", userId)
  if (error) return { ok: false, error: errorText(error) }
  const ban = await admin.auth.admin.updateUserById(userId, { ban_duration: isActive ? "none" : "876000h" })
  if (ban.error) return { ok: false, error: errorText(ban.error) }
  await admin.from("audit_logs").insert({
    actor_id: context.user.id,
    action: isActive ? "user_enabled" : "user_disabled",
    target_type: "user",
    target_id: userId,
    metadata: {},
  })
  revalidatePath("/admin", "layout")
  return { ok: true }
}

export async function resetUserPassword(userId: string): Promise<CreatedLogin | AccountError> {
  const context = await requireSuperAdmin()
  const admin = createAdminClient()
  if (!admin) return { ok: false, error: t("errors.not_configured") }
  const password = generatePassword()
  const { error } = await admin.auth.admin.updateUserById(userId, { password })
  if (error) return { ok: false, error: errorText(error) }
  const profile = await admin.from("profiles").update({ must_change_password: true }).eq("id", userId)
  if (profile.error) return { ok: false, error: errorText(profile.error) }
  await admin.from("audit_logs").insert({
    actor_id: context.user.id,
    action: "password_reset",
    target_type: "user",
    target_id: userId,
    metadata: {},
  })
  return { ok: true, password, existingUser: false }
}

export async function setOrganizationStatus(
  orgId: string,
  status: "active" | "paused" | "offboarded",
): Promise<AccountError | { ok: true }> {
  const context = await requireSuperAdmin()
  const admin = createAdminClient()
  if (!admin) return { ok: false, error: t("errors.not_configured") }
  const { error } = await admin.from("organizations").update({ status }).eq("id", orgId)
  if (error) return { ok: false, error: errorText(error) }
  await admin.from("audit_logs").insert({
    actor_id: context.user.id,
    org_id: orgId,
    action: "organization_status",
    target_type: "organization",
    target_id: orgId,
    metadata: { status },
  })
  revalidatePath(`/admin/clients/${orgId}`)
  return { ok: true }
}

export async function updateOrganizationSettings(input: unknown): Promise<AccountError | { ok: true }> {
  const context = await requireSuperAdmin()
  const parsed = orgSettingsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: t("errors.generic") }
  const admin = createAdminClient()
  if (!admin) return { ok: false, error: t("errors.not_configured") }
  const { error } = await admin
    .from("organizations")
    .update({
      response_hours: parsed.data.responseHours,
      urgent_limit_per_month: parsed.data.urgentLimit,
    })
    .eq("id", parsed.data.id)
  if (error) return { ok: false, error: errorText(error) }
  await admin.from("audit_logs").insert({
    actor_id: context.user.id,
    org_id: parsed.data.id,
    action: "organization_updated",
    target_type: "organization",
    target_id: parsed.data.id,
    metadata: {
      response_hours: parsed.data.responseHours,
      urgent_limit_per_month: parsed.data.urgentLimit,
    },
  })
  revalidatePath(`/admin/clients/${parsed.data.id}`)
  return { ok: true }
}

export async function addBrandAccount(input: unknown): Promise<AccountError | { ok: true }> {
  const context = await requireAgency()
  const parsed = brandSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: t("errors.generic") }
  const { error } = await context.supabase.from("brand_accounts").insert({
    org_id: parsed.data.orgId,
    instagram_handle: parsed.data.instagramHandle,
    facebook_page_name: parsed.data.facebookPageName || null,
    ad_account_label: parsed.data.adAccountLabel || null,
  })
  if (error) return { ok: false, error: errorText(error) }
  revalidatePath(`/admin/clients/${parsed.data.orgId}`)
  return { ok: true }
}

export async function updateBrandAccount(input: unknown): Promise<AccountError | { ok: true }> {
  const context = await requireAgency()
  const parsed = brandUpdateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: t("errors.generic") }
  const { data, error } = await context.supabase
    .from("brand_accounts")
    .update({
      is_professional_account: parsed.data.isProfessionalAccount,
      is_public_account: parsed.data.isPublicAccount,
      access_checklist_status: parsed.data.accessChecklistStatus,
      notes_for_client: parsed.data.notesForClient,
      facebook_page_name: parsed.data.facebookPageName || null,
      ad_account_label: parsed.data.adAccountLabel || null,
    })
    .eq("id", parsed.data.id)
    .select("org_id")
    .maybeSingle()
  if (error || !data) return { ok: false, error: errorText(error) }
  revalidatePath(`/admin/clients/${data.org_id}`)
  return { ok: true }
}
