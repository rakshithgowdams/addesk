import { EmptyState } from "@/components/empty-state"
import { requireAgency } from "@/lib/auth/session"
import { formatDateTime } from "@/lib/format"
import { t } from "@/lib/i18n"

export default async function AuditPage() {
  const context = await requireAgency()
  const { data: logs } = await context.supabase
    .from("audit_logs")
    .select("id, actor_id, org_id, action, target_type, target_id, created_at")
    .order("created_at", { ascending: false })
    .limit(200)
  const actorIds = [...new Set((logs ?? []).map((log) => log.actor_id).filter((id): id is string => Boolean(id)))]
  const { data: actors } = actorIds.length
    ? await context.supabase.from("profiles").select("id, email, full_name").in("id", actorIds)
    : { data: [] }
  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t("nav.audit")}</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{t("admin.auditHint")}</p>
      </div>
      {(logs ?? []).length === 0 ? <EmptyState title={t("empty.audit")} /> : (
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-muted/70 text-xs tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-3 py-3 font-medium">{t("admin.auditWhen")}</th>
              <th className="px-3 py-3 font-medium">{t("admin.auditName")}</th>
              <th className="px-3 py-3 font-medium">{t("admin.auditAction")}</th>
              <th className="px-3 py-3 font-medium">{t("admin.auditRecord")}</th>
            </tr>
          </thead>
          <tbody>
            {(logs ?? []).map((log) => {
              const actor = (actors ?? []).find((item) => item.id === log.actor_id)
              return (
                <tr key={log.id} className="border-t">
                  <td className="px-3 py-3 text-muted-foreground">{formatDateTime(log.created_at)}</td>
                  <td className="px-3 py-3 font-medium">{actor?.full_name || actor?.email || "—"}</td>
                  <td className="px-3 py-3"><span className="rounded-full bg-muted px-2 py-1 text-xs">{log.action}</span></td>
                  <td className="px-3 py-3">{log.target_type}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      )}
    </div>
  )
}
