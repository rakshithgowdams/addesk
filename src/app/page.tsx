import { redirect } from "next/navigation"
import Link from "next/link"
import { getAuthContext } from "@/lib/auth/session"
import { t } from "@/lib/i18n"

export default async function HomePage() {
  const context = await getAuthContext()
  if (!context.configured) redirect("/setup")
  if (!context.user) redirect("/login")
  if (!context.profile) {
    const reason = context.reason === "inactive" ? "disabled" : "missing"
    await context.supabase.auth.signOut()
    redirect(`/login?error=${reason}`)
  }
  if (context.profile.must_change_password) redirect("/change-password")
  if (context.profile.platform_role === "super_admin" || context.profile.platform_role === "staff") {
    redirect("/admin")
  }
  const workspaces = context.memberships.filter((item) => item.organization)
  if (workspaces.length === 1 && workspaces[0]?.organization) {
    redirect(`/c/${workspaces[0].organization.slug}`)
  }
  return (
    <main className="mx-auto grid min-h-full max-w-lg gap-3 px-4 py-8">
      <h1 className="text-2xl font-semibold">{t("app.name")}</h1>
      {workspaces.length === 0 ? <p>{t("auth.noWorkspace")}</p> : null}
      {workspaces.map((item) =>
        item.organization ? (
          <Link key={item.org_id} href={`/c/${item.organization.slug}`} className="rounded-xl border bg-card px-4 py-3">
            {item.organization.name}
          </Link>
        ) : null,
      )}
    </main>
  )
}
