"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { t } from "@/lib/i18n"
import { askForChange, cancelOwnRequest } from "@/server/actions/requests"

export function ClientRequestActions({
  requestId,
  orgSlug,
  canCancel,
  canEdit,
  canChange,
}: {
  requestId: string
  orgSlug: string
  canCancel: boolean
  canEdit: boolean
  canChange: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const [sent, setSent] = useState(false)
  return (
    <div className="grid gap-3">
      {canEdit ? (
        <a href={`/c/${orgSlug}/requests/${requestId}/edit`} className="inline-flex h-11 items-center justify-center rounded-lg border px-4 text-sm font-medium">
          {t("request.edit")}
        </a>
      ) : null}
      {canCancel ? (
        <Button type="button" variant="outline" className="h-11" disabled={pending} onClick={() => {
          if (!window.confirm(t("request.cancelConfirm"))) return
          startTransition(async () => {
            const result = await cancelOwnRequest(requestId, orgSlug)
            setError(result.ok ? "" : result.error)
          })
        }}>
          {t("request.cancel")}
        </Button>
      ) : null}
      {canChange ? (
        <form className="grid gap-2" onSubmit={(event) => {
          event.preventDefault()
          const note = String(new FormData(event.currentTarget).get("note") ?? "")
          startTransition(async () => {
            const result = await askForChange(requestId, orgSlug, note)
            if (!result.ok) setError(result.error)
            else setSent(true)
          })
        }}>
          <p className="text-sm">{t("request.changeHelp")}</p>
          <Textarea name="note" required />
          <Button className="h-11" disabled={pending}>{t("request.change")}</Button>
        </form>
      ) : null}
      {sent ? <p role="status">{t("request.changeSent")}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
