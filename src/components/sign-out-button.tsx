"use client"

import { signOut } from "@/server/actions/auth"
import { clearBrowserUserData } from "@/lib/pwa/browser-data"
import { t } from "@/lib/i18n"
import { removePushSubscription } from "@/server/actions/push"

export function SignOutButton() {
  return (
    <button
      type="button"
      className="rounded-full border bg-card/80 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      onClick={() => {
        void (async () => {
          if ("serviceWorker" in navigator) {
            const registration = await navigator.serviceWorker.getRegistration()
            const subscription = await registration?.pushManager.getSubscription()
            if (subscription) {
              await removePushSubscription(subscription.endpoint)
              await subscription.unsubscribe()
            }
          }
          clearBrowserUserData()
          await signOut()
        })()
      }}
    >
      {t("nav.signOut")}
    </button>
  )
}
