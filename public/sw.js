const VERSION = "addesk-shell-v4"
const PRECACHE = ["/offline", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-touch-icon.png"]

function isStaticAsset(url) {
  return url.origin === self.location.origin && url.pathname.startsWith("/icons/")
}

function isSensitive(url) {
  if (url.origin !== self.location.origin) return true
  const path = url.pathname
  if (path.startsWith("/admin") || path.startsWith("/c/") || path.startsWith("/api") || path.startsWith("/auth")) {
    return true
  }
  if (path.includes("/storage/v1/") || url.search.includes("token=")) return true
  return false
}

self.addEventListener("install", (event) => {
  self.skipWaiting()
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(PRECACHE)))
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting()
})

self.addEventListener("push", (event) => {
  let payload = { title: "AdDesk", body: "", url: "/" }
  try {
    payload = { ...payload, ...(event.data ? event.data.json() : {}) }
  } catch {
    payload.body = event.data ? event.data.text() : ""
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: payload.url || "/" },
    }),
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windows) => {
      const open = windows.find((windowClient) => windowClient.url.startsWith(self.location.origin))
      if (open) {
        if ("navigate" in open) await open.navigate(target)
        return open.focus()
      }
      return self.clients.openWindow(target)
    }),
  )
})

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.method !== "GET") return
  const url = new URL(request.url)

  if (request.mode === "navigate" || isSensitive(url)) {
    if (request.mode === "navigate") {
      event.respondWith(fetch(request).catch(() => caches.match("/offline")))
    }
    return
  }

  if (!isStaticAsset(url)) return

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone()
          caches.open(VERSION).then((cache) => cache.put(request, copy))
        }
        return response
      })
    }),
  )
})
