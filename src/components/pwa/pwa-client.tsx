"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { BrandMark } from "@/components/brand-mark"
import { t } from "@/lib/i18n"
import { rememberInstallDismissed } from "@/lib/pwa/browser-data"

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function ServiceWorkerRegister() {
  const [updateReady, setUpdateReady] = useState(false)
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null)

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return
    let active = true
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((registration) => {
        if (!active) return
        const show = () => {
          if (registration.waiting && navigator.serviceWorker.controller) {
            setWaiting(registration.waiting)
            setUpdateReady(true)
          }
        }
        show()
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed") show()
          })
        })
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  if (!updateReady) return null
  const dirty = typeof document !== "undefined" && document.querySelector("[data-form-dirty='true']")
  if (dirty) return null

  return (
    <div className="safe-top fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-3 border-b bg-card px-4 py-3 text-sm">
      <p>{t("pwa.update")}</p>
      <button
        type="button"
        className="h-11 rounded-lg bg-primary px-4 font-medium text-primary-foreground"
        onClick={() => {
          waiting?.postMessage("SKIP_WAITING")
          window.location.reload()
        }}
      >
        {t("pwa.reload")}
      </button>
    </div>
  )
}

export function InstallPrompt() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
      const dismissed = window.localStorage.getItem("addesk-install-dismissed") === "1"
      setVisible(!standalone && !dismissed)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  if (!visible) return null
  return (
    <div className="panel flex flex-col gap-3 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p>{t("install.prompt")}</p>
      <div className="flex gap-2">
        <Link href="/install" className="inline-flex h-11 items-center rounded-lg bg-primary px-4 text-primary-foreground">
          {t("nav.install")}
        </Link>
        <button
          type="button"
          className="h-11 rounded-lg px-3"
          onClick={() => {
            rememberInstallDismissed()
            setVisible(false)
          }}
        >
          {t("install.later")}
        </button>
      </div>
    </div>
  )
}

export function InstallGuide() {
  const [mode, setMode] = useState<"loading" | "installed" | "inapp" | "ios" | "prompt" | "manual">("loading")
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const ua = navigator.userAgent
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
    const onPrompt = (event: Event) => {
      event.preventDefault()
      setPromptEvent(event as BeforeInstallPromptEvent)
      setMode("prompt")
    }
    window.addEventListener("beforeinstallprompt", onPrompt)
    const timer = window.setTimeout(() => {
      if (standalone) setMode("installed")
      else if (/Instagram|FBAN|FBAV|WhatsApp/i.test(ua)) setMode("inapp")
      else if (/iPad|iPhone|iPod/.test(ua)) setMode("ios")
      else setMode("manual")
    }, 0)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener("beforeinstallprompt", onPrompt)
    }
  }, [])

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
  }

  return (
    <div className="mx-auto grid w-full max-w-lg gap-4 px-4 py-8">
      <div className="flex items-center gap-3">
        <BrandMark className="size-12 rounded-2xl" />
        <div>
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground">{t("app.credit")}</p>
          <h1 className="text-2xl font-semibold">{t("install.title")}</h1>
          <p className="text-[11px] font-medium text-primary">{t("app.version")}</p>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{t("install.lead")}</p>
      {mode === "installed" ? <p>{t("install.installed")}</p> : null}
      {mode === "inapp" ? (
        <div className="grid gap-3 rounded-xl border bg-card p-4">
          <p>{t("install.inApp")}</p>
          <button type="button" className="h-11 rounded-lg bg-primary text-primary-foreground" onClick={() => void copyLink()}>
            {copied ? t("admin.copied") : t("install.copy")}
          </button>
        </div>
      ) : null}
      {mode === "ios" ? (
        <div className="grid gap-2 rounded-xl border bg-card p-4">
          <p>{t("install.ios")}</p>
          <p className="font-medium">{t("install.iosSteps")}</p>
        </div>
      ) : null}
      {mode === "prompt" ? (
        <button
          type="button"
          className="h-11 rounded-lg bg-primary text-primary-foreground"
          onClick={() => void promptEvent?.prompt()}
        >
          {t("install.android")}
        </button>
      ) : null}
      {mode === "manual" || mode === "prompt" ? <p className="text-sm text-muted-foreground">{t("install.desktop")}</p> : null}
      {mode === "manual" ? <p className="text-sm text-muted-foreground">{t("install.androidHelp")}</p> : null}
    </div>
  )
}
