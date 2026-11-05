import Link from "next/link"
import type { ReactNode } from "react"
import { notFound } from "next/navigation"
import {
  AddBrandForm,
  AddMemberForm,
  BrandChecklistForm,
  OrgSettingsForm,
  OrgStatusButtons,
  UserAccessButtons,
} from "@/components/admin/account-forms"
import { EmptyState } from "@/components/empty-state"
import { StatusBadge } from "@/components/status-badge"
import { requireAgency } from "@/lib/auth/session"
import { t } from "@/lib/i18n"
import type { RequestStatus } from "@/lib/requests/status"

function Section({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="panel grid gap-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export default async function ClientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const context = await requireAgency()
  const { data: organization } = await context.supabase.from("organizations").select("*").eq("id", id).maybeSingle()
  if (!organization) notFound()

  const [{ data: members }, { data: brands }, { data: products }, { data: requests }, { data: assets }] = await Promise.all([
    context.supabase.from("org_members").select("user_id, role").eq("org_id", id),
    context.supabase.from("brand_accounts").select("*").eq("org_id", id).order("created_at"),
    context.supabase.from("products").select("id, name, is_archived").eq("org_id", id).order("name"),
    context.supabase.from("requests").select("id, request_number, title, status, created_at").eq("org_id", id).order("created_at", { ascending: false }),
    context.supabase.from("request_assets").select("size_bytes").eq("org_id", id),
  ])

  const userIds = (members ?? []).map((member) => member.user_id)
  const { data: profiles } = userIds.length
    ? await context.supabase.from("profiles").select("id, full_name, email, phone, is_active").in("id", userIds)
    : { data: [] }
  const usedMb = Math.round(((assets ?? []).reduce((sum, asset) => sum + (asset.size_bytes ?? 0), 0) / (1024 * 1024)) * 10) / 10
  const isSuper = context.profile.platform_role === "super_admin"

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/clients" className="text-sm text-muted-foreground underline-offset-4 hover:underline">{t("nav.clients")}</Link>
          <h1 className="text-3xl font-semibold tracking-tight">{organization.name}</h1>
          <p className="text-sm text-muted-foreground">{organization.request_prefix} · {t(`orgStatus.${organization.status}`)}</p>
        </div>
        {isSuper ? <OrgStatusButtons orgId={organization.id} status={organization.status} /> : null}
      </div>
      {isSuper ? (
        <Section title={t("admin.settings")}>
          <OrgSettingsForm orgId={organization.id} responseHours={organization.response_hours} urgentLimit={organization.urgent_limit_per_month} />
        </Section>
      ) : null}

      <Section title={t("admin.members")} action={isSuper ? <AddMemberForm orgId={organization.id} /> : null}>
        {(members ?? []).length === 0 ? <p className="text-sm text-muted-foreground">{t("empty.team")}</p> : null}
        {(members ?? []).map((member) => {
          const profile = (profiles ?? []).find((item) => item.id === member.user_id)
          return (
            <div key={member.user_id} className="grid gap-3 rounded-xl border bg-background/70 p-4">
              <div>
                <p className="font-medium">{profile?.full_name || profile?.email}</p>
                <p className="text-sm text-muted-foreground">{[profile?.email, profile?.phone, member.role === "client_owner" ? t("admin.clientOwner") : t("admin.clientMember")].filter(Boolean).join(" · ")}</p>
              </div>
              {isSuper && profile ? <UserAccessButtons userId={profile.id} active={profile.is_active} /> : null}
            </div>
          )
        })}
      </Section>

      <Section title={t("admin.brands")} action={<AddBrandForm orgId={organization.id} />}>
        <p className="text-sm text-muted-foreground">{t("admin.passwordWarning")}</p>
        {(brands ?? []).map((brand) => (
          <div key={brand.id} className="grid gap-3">
            <p className="font-medium">@{brand.instagram_handle}</p>
            <BrandChecklistForm brand={brand} />
          </div>
        ))}
      </Section>

      <Section title={t("admin.products")}>
        {(products ?? []).length === 0 ? <EmptyState title={t("empty.products")} /> : null}
        {(products ?? []).map((product) => (
          <p key={product.id} className="text-sm">{product.name}{product.is_archived ? " · archived" : ""}</p>
        ))}
      </Section>

      <Section title={t("nav.requests")}>
        {(requests ?? []).length === 0 ? <EmptyState title={t("empty.clientRequests")} /> : null}
        {(requests ?? []).map((request) => (
          <Link key={request.id} href={`/admin/requests/${request.id}`} className="flex items-center justify-between gap-3 rounded-xl border bg-background/70 p-4">
            <span>
              <span className="font-medium">{request.request_number}</span>
              <span className="mt-1 block text-sm">{request.title}</span>
            </span>
            <StatusBadge status={request.status as RequestStatus} />
          </Link>
        ))}
      </Section>

      <Section title={t("admin.storage")}>
        <p className="text-sm">{t("admin.storageValue", { used: usedMb, limit: organization.storage_limit_mb })}</p>
        <p className="text-sm text-muted-foreground">{t("admin.storageLater")}</p>
      </Section>
    </div>
  )
}
