"use client"

import { t } from "@/lib/i18n"

export default function OfflinePage() {
  return (
    <main className="mx-auto grid min-h-full max-w-md gap-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">{t("offline.title")}</h1>
      <p className="text-sm leading-6 text-muted-foreground">{t("offline.body")}</p>
      <button type="button" className="mx-auto h-11 rounded-lg bg-primary px-4 text-primary-foreground" onClick={() => window.location.reload()}>
        {t("offline.retry")}
      </button>
    </main>
  )
}
