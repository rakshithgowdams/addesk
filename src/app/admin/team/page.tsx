import { AddStaffForm, UserAccessButtons } from "@/components/admin/account-forms"
import { EmptyState } from "@/components/empty-state"
import { requireAgency } from "@/lib/auth/session"
import { t } from "@/lib/i18n"

export default async function TeamPage() {
  const context = await requireAgency()
  const { data: staff } = await context.supabase
    .from("profiles")
    .select("id, full_name, email, platform_role, is_active")
    .not("platform_role", "is", null)
    .order("full_name")
  const isSuper = context.profile.platform_role === "super_admin"
  return (
    <div className="grid gap-4">
      <h1 className="text-3xl font-semibold tracking-tight">{t("nav.team")}</h1>
      {(staff ?? []).length === 0 ? <EmptyState title={t("empty.team")} /> : null}
      {(staff ?? []).map((person) => (
        <div key={person.id} className="grid gap-2 rounded-xl border bg-card p-4">
          <p className="font-medium">{person.full_name}</p>
          <p className="text-sm text-muted-foreground">
            {person.email} · {person.platform_role === "super_admin" ? t("admin.superAdmin") : t("admin.staff")}
            {person.is_active ? "" : ` · ${t("admin.disable")}`}
          </p>
          {isSuper ? <UserAccessButtons userId={person.id} active={person.is_active} /> : null}
        </div>
      ))}
      {isSuper ? <AddStaffForm /> : null}
    </div>
  )
}
