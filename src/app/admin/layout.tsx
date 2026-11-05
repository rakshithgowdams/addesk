import { AppShell } from "@/components/shell"
import { requireAgency } from "@/lib/auth/session"
import { t } from "@/lib/i18n"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const context = await requireAgency()
  return (
    <AppShell
      title={context.profile.full_name || t("app.name")}
      links={[
        { href: "/admin", label: t("nav.home") },
        { href: "/admin/requests", label: t("nav.requests") },
        { href: "/admin/clients", label: t("nav.clients") },
        { href: "/admin/team", label: t("nav.team") },
        { href: "/admin/audit", label: t("nav.audit") },
      ]}
    >
      {children}
    </AppShell>
  )
}
