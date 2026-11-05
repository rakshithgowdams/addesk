"use client"

import { useEffect, useState } from "react"
import { t } from "@/lib/i18n"
import { savePushSubscription } from "@/server/actions/push"

function keyBytes(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), "="))
  return Uint8Array.from(raw, (char) => char.charCodeAt(0))
}

export function EnablePush() {
  const [label, setLabel] = useState(t("pwa.pushEnable"))
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setLabel(t("pwa.pushUnsupported"))
        return
      }
      if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
        setLabel(t("pwa.pushMissingKey"))
        return
      }
      if (Notification.permission === "denied") {
        setLabel(t("pwa.pushDenied"))
        return
      }
      setReady(true)
      void navigator.serviceWorker.ready.then(async (registration) => {
        const existing = await registration.pushManager.getSubscription()
        if (existing && Notification.permission === "granted") setLabel(t("pwa.pushOn"))
      })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <button
      type="button"
      disabled={!ready || label === t("pwa.pushOn")}
      className="rounded-full border bg-card/80 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-default disabled:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      onClick={() => {
        void (async () => {
          const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
          if (!publicKey) {
            setLabel(t("pwa.pushMissingKey"))
            setReady(false)
            return
          }
          const permission = await Notification.requestPermission()
          if (permission !== "granted") {
            setLabel(t("pwa.pushDenied"))
            setReady(false)
            return
          }
          const registration = await navigator.serviceWorker.ready
          const subscription =
            (await registration.pushManager.getSubscription()) ??
            (await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: keyBytes(publicKey),
            }))
          const json = subscription.toJSON()
          const saved = await savePushSubscription({
            endpoint: json.endpoint,
            keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
          })
          setLabel(saved.ok ? t("pwa.pushOn") : saved.error)
          if (!saved.ok) setReady(true)
        })().catch((error: unknown) => {
          const detail = error instanceof Error ? error.message : ""
          setLabel(detail.includes("push service not available") ? t("pwa.pushUnavailable") : t("pwa.pushFailed"))
          setReady(true)
        })
      }}
    >
      {label}
    </button>
  )
}
