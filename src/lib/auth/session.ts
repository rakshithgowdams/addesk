import { connection } from "next/server"
import { notFound, redirect } from "next/navigation"
import type { User } from "@supabase/supabase-js"
import { publicSupabaseEnv } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database"

export type Profile = Database["public"]["Tables"]["profiles"]["Row"]
export type Organization = Database["public"]["Tables"]["organizations"]["Row"]
type Supabase = Awaited<ReturnType<typeof createClient>>

export type Membership = {
  org_id: string
  role: "client_owner" | "client_member"
  organization: Pick<Organization, "id" | "name" | "slug" | "status"> | null
}

type ReadyContext = {
  configured: true
  supabase: Supabase
  user: User
  profile: Profile
  memberships: Membership[]
}

export async function getAuthContext(): Promise<
  | { configured: false }
  | { configured: true; supabase: Supabase; user: null }
  | { configured: true; supabase: Supabase; user: User; profile: null; reason: "missing" | "inactive" }
  | ReadyContext
> {
  await connection()
  if (!publicSupabaseEnv()) return { configured: false }
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return { configured: true, supabase, user: null }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, platform_role, is_active, must_change_password, email_notifications, created_at, updated_at")
    .eq("id", data.user.id)
    .maybeSingle()

  if (!profile) {
    return { configured: true, supabase, user: data.user, profile: null, reason: "missing" }
  }
  if (!profile.is_active) {
    return { configured: true, supabase, user: data.user, profile: null, reason: "inactive" }
  }

  const { data: membershipRows } = await supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", data.user.id)

  const orgIds = (membershipRows ?? []).map((row) => row.org_id)
  const { data: organizations } = orgIds.length
    ? await supabase.from("organizations").select("id, name, slug, status").in("id", orgIds)
    : { data: [] as Pick<Organization, "id" | "name" | "slug" | "status">[] }

  const memberships: Membership[] = (membershipRows ?? []).map((row) => ({
    org_id: row.org_id,
    role: row.role,
    organization: (organizations ?? []).find((org) => org.id === row.org_id) ?? null,
  }))

  return { configured: true, supabase, user: data.user, profile, memberships }
}

export async function requireUser(options?: { allowPasswordChange?: boolean }): Promise<ReadyContext> {
  const context = await getAuthContext()
  if (!context.configured) redirect("/setup")
  if (!context.user) redirect("/login")
  if (!("profile" in context) || !context.profile) {
    const reason = "reason" in context && context.reason === "inactive" ? "disabled" : "missing"
    await context.supabase.auth.signOut()
    redirect(`/login?error=${reason}`)
  }
  if (context.profile.must_change_password && !options?.allowPasswordChange) {
    redirect("/change-password")
  }
  return context
}

export async function requireAgency() {
  const context = await requireUser()
  if (context.profile.platform_role !== "super_admin" && context.profile.platform_role !== "staff") {
    redirect("/")
  }
  return context
}

export async function requireSuperAdmin() {
  const context = await requireAgency()
  if (context.profile.platform_role !== "super_admin") redirect("/admin")
  return context
}

export async function requireClientOrg(slug: string) {
  const context = await requireUser()
  const membership = context.memberships.find((item) => item.organization?.slug === slug)
  if (membership?.organization) {
    return { ...context, organization: membership.organization, role: membership.role }
  }

  if (context.profile.platform_role === "super_admin" || context.profile.platform_role === "staff") {
    const { data: organization } = await context.supabase
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .maybeSingle()
    if (organization) redirect(`/admin/clients/${organization.id}`)
  }

  notFound()
}
