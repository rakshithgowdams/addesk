import { AppShell } from "@/components/shell"
import { OrgSwitcher } from "@/components/org-switcher"
import { requireClientOrg } from "@/lib/auth/session"
import { t } from "@/lib/i18n"

export default async function ClientLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const context = await requireClientOrg(orgSlug)
  const options = context.memberships
    .map((item) => item.organization)
    .filter((org): org is NonNullable<typeof org> => Boolean(org))
    .map((org) => ({ slug: org.slug, name: org.name }))
  return (
    <AppShell
      title={context.organization.name}
      links={[
        { href: `/c/${orgSlug}`, label: t("nav.home") },
        { href: `/c/${orgSlug}/requests`, label: t("nav.requests") },
        { href: `/c/${orgSlug}/requests/new`, label: t("nav.newRequest") },
        { href: `/c/${orgSlug}/team`, label: t("nav.team") },
      ]}
      switcher={<OrgSwitcher current={orgSlug} options={options} />}
    >
      {context.organization.status === "paused" ? <p className="rounded-xl border bg-amber-50 p-4 text-sm text-amber-950">{t("org.paused")}</p> : null}
      {context.organization.status === "offboarded" ? <p className="rounded-xl border bg-stone-100 p-4 text-sm">{t("org.offboarded")}</p> : null}
      {children}
    </AppShell>
  )
}
