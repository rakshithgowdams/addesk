"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Field } from "@/components/field"
import { t } from "@/lib/i18n"
import { TRANSITIONS, type RequestStatus } from "@/lib/requests/status"
import { assignRequest, changeBlocker, changeStatus, saveLinkCheck } from "@/server/actions/requests"

const control = "h-11 w-full rounded-lg border bg-card px-3 text-base"

export function StatusForm({ requestId, status }: { requestId: string; status: RequestStatus }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const options = TRANSITIONS[status]
  return (
    <form className="grid gap-3" onSubmit={(event) => {
      event.preventDefault()
      const data = new FormData(event.currentTarget)
      startTransition(async () => {
        const result = await changeStatus(requestId, String(data.get("status")) as RequestStatus, String(data.get("note") ?? ""))
        setError(result.ok ? "" : result.error)
      })
    }}>
      <Field label={t("request.status")}>
        <select name="status" className={control} defaultValue={options[0] ?? status}>
          {options.map((item) => <option key={item} value={item}>{t(`status.${item}`)}</option>)}
        </select>
      </Field>
      <Field label={t("request.messageToClient")}>
        <Textarea name="note" />
      </Field>
      <Button className="h-11" disabled={pending || options.length === 0}>{t("admin.saveStatus")}</Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </form>
  )
}

export function BlockerForm({
  requestId,
  blocker,
  note,
}: {
  requestId: string
  blocker: string
  note: string | null
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")
  return (
    <form className="grid gap-3" onSubmit={(event) => {
      event.preventDefault()
      const data = new FormData(event.currentTarget)
      startTransition(async () => {
        const result = await changeBlocker(
          requestId,
          String(data.get("blocker")) as "none" | "waiting_on_client" | "waiting_on_creator_approval" | "waiting_on_agency" | "waiting_on_meta",
          String(data.get("note") ?? ""),
        )
        setError(result.ok ? "" : result.error)
      })
    }}>
      <Field label={t("request.blocker")}>
        <select name="blocker" className={control} defaultValue={blocker}>
          {["none", "waiting_on_client", "waiting_on_creator_approval", "waiting_on_agency", "waiting_on_meta"].map((item) => (
            <option key={item} value={item}>{t(`blockerAgency.${item}`)}</option>
          ))}
        </select>
      </Field>
      <Field label={t("request.messageToClient")}>
        <Textarea name="note" defaultValue={note ?? ""} />
      </Field>
      <Button className="h-11" disabled={pending}>{t("admin.saveBlocker")}</Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </form>
  )
}

export function AssignmentForm({
  requestId,
  assignedTo,
  staff,
}: {
  requestId: string
  assignedTo: string | null
  staff: { id: string; full_name: string }[]
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")
  return (
    <form className="grid gap-3" onSubmit={(event) => {
      event.preventDefault()
      const data = new FormData(event.currentTarget)
      startTransition(async () => {
        const result = await assignRequest(requestId, String(data.get("assignee") ?? ""))
        setError(result.ok ? "" : result.error)
      })
    }}>
      <Field label={t("request.assigned")}>
        <select name="assignee" className={control} defaultValue={assignedTo ?? ""}>
          <option value="">{t("request.unassigned")}</option>
          {staff.map((person) => <option key={person.id} value={person.id}>{person.full_name || person.id}</option>)}
        </select>
      </Field>
      <Button className="h-11" disabled={pending}>{t("admin.saveAssignment")}</Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </form>
  )
}

export function LinkCheckForm({
  requestId,
  link,
}: {
  requestId: string
  link: {
    id: string
    normalized_url: string
    link_type: string
    permission_method: "unknown" | "own_account" | "ad_code" | "partner_boost" | "account_level"
    permission_status: "not_checked" | "requested" | "received" | "approved" | "blocked"
    ad_code: string | null
    music_check: "not_checked" | "ok" | "issue"
    staff_only_check_notes: string | null
  }
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")
  return (
    <form className="grid gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3" onSubmit={(event) => {
      event.preventDefault()
      const data = new FormData(event.currentTarget)
      startTransition(async () => {
        const result = await saveLinkCheck({
          requestId,
          linkId: link.id,
          method: String(data.get("method")) as typeof link.permission_method,
          status: String(data.get("status")) as typeof link.permission_status,
          adCode: String(data.get("adCode") ?? ""),
          music: String(data.get("music")) as typeof link.music_check,
          notes: String(data.get("notes") ?? ""),
        })
        setError(result.ok ? "" : result.error)
      })
    }}>
      <p className="text-xs font-medium uppercase tracking-wide text-amber-900">{t("request.staffNote")}</p>
      <a href={link.normalized_url} target="_blank" rel="noreferrer" className="break-all text-sm underline">{link.normalized_url}</a>
      {link.link_type === "share" ? <p className="text-sm">{t("request.shareCheck")}</p> : null}
      <select name="method" className={control} defaultValue={link.permission_method}>
        {["unknown", "own_account", "ad_code", "partner_boost", "account_level"].map((item) => <option key={item} value={item}>{t(`permission.${item}`)}</option>)}
      </select>
      <select name="status" className={control} defaultValue={link.permission_status}>
        {["not_checked", "requested", "received", "approved", "blocked"].map((item) => <option key={item} value={item}>{t(`permissionStatus.${item}`)}</option>)}
      </select>
      <input name="adCode" defaultValue={link.ad_code ?? ""} placeholder={t("admin.adCode")} className={control} />
      <select name="music" className={control} defaultValue={link.music_check}>
        {["not_checked", "ok", "issue"].map((item) => <option key={item} value={item}>{t(`music.${item}`)}</option>)}
      </select>
      <Textarea name="notes" defaultValue={link.staff_only_check_notes ?? ""} placeholder={t("request.staffNote")} />
      <Button className="h-11" disabled={pending}>{t("request.save")}</Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </form>
  )
}
