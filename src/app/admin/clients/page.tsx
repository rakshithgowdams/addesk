import Link from "next/link"
import { CreateClientForm } from "@/components/admin/account-forms"
import { EmptyState } from "@/components/empty-state"
import { requireAgency } from "@/lib/auth/session"
import { t } from "@/lib/i18n"

export default async function ClientsPage() {
  const context = await requireAgency()
  const { data: clients } = await context.supabase
    .from("organizations")
    .select("id, name, slug, status, request_prefix")
    .order("name")
  const isSuper = context.profile.platform_role === "super_admin"
  return (
    <div className="grid gap-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">{t("nav.clients")}</h1>
        {isSuper ? <CreateClientForm /> : null}
      </div>
      {(clients ?? []).length === 0 ? <EmptyState title={t("empty.clients")} /> : null}
      <div className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {(clients ?? []).map((client) => (
          <Link key={client.id} href={`/admin/clients/${client.id}`} className="panel flex aspect-square flex-col justify-between p-4">
            <p className="text-xs font-medium tracking-wide text-muted-foreground">{client.request_prefix}</p>
            <p className="text-lg font-semibold leading-tight">{client.name}</p>
            <p className="text-sm text-muted-foreground">
              {t(`orgStatus.${client.status}`)}
              <span className="mt-1 block truncate">/c/{client.slug}</span>
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
