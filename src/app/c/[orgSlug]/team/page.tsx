import { requireClientOrg } from "@/lib/auth/session"
import { t } from "@/lib/i18n"

export default async function ClientTeamPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params
  const context = await requireClientOrg(orgSlug)
  const { data: members } = await context.supabase.from("org_members").select("user_id, role").eq("org_id", context.organization.id)
  const ids = (members ?? []).map((member) => member.user_id)
  const { data: profiles } = ids.length
    ? await context.supabase.from("profiles").select("id, full_name, email").in("id", ids)
    : { data: [] }
  return (
    <div className="grid gap-3">
      <h1 className="text-3xl font-semibold tracking-tight">{t("nav.team")}</h1>
      <p className="text-sm text-muted-foreground">{t("auth.loginHelp")}</p>
      {(members ?? []).map((member) => {
        const profile = (profiles ?? []).find((item) => item.id === member.user_id)
        return (
          <div key={member.user_id} className="rounded-xl border bg-card p-4">
            <p className="font-medium">{profile?.full_name || profile?.email}</p>
            <p className="text-sm text-muted-foreground">
              {profile?.email} · {member.role === "client_owner" ? t("admin.clientOwner") : t("admin.clientMember")}
            </p>
          </div>
        )
      })}
    </div>
  )
}
