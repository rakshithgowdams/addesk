export type InstagramLinkType = "post" | "reel" | "tv" | "share" | "other"

export type ParsedInstagramUrl =
  | {
      ok: true
      originalUrl: string
      normalizedUrl: string
      shortcode: string | null
      linkType: InstagramLinkType
      needsStaffCheck: boolean
    }
  | {
      ok: false
      reason: "empty" | "not_https" | "not_instagram" | "unrecognized_path"
    }

const HOSTS = new Set(["instagram.com", "www.instagram.com"])
const CODE = /^[A-Za-z0-9_-]+$/
const HANDLE = /^[A-Za-z0-9._]{1,30}$/
const RESERVED_HANDLES = new Set([
  "about",
  "accounts",
  "direct",
  "explore",
  "legal",
  "p",
  "reel",
  "reels",
  "share",
  "stories",
  "tv",
])

export function instagramHandleFromInput(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  if (!trimmed.includes("/") && !trimmed.includes(" ")) {
    const bare = trimmed.replace(/^@/, "")
    return HANDLE.test(bare) ? bare : null
  }

  let url: URL
  try {
    url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`)
  } catch {
    return null
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "")
  if (host !== "instagram.com") return null
  const parts = cleanPath(url.pathname)
  if (parts.length !== 1) return null
  const handle = parts[0].replace(/^@/, "")
  if (RESERVED_HANDLES.has(handle.toLowerCase()) || !HANDLE.test(handle)) return null
  return handle
}

export function normalizePhone(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return ""
  const compact = trimmed.replace(/[^\d+]/g, "")
  return /^\+?\d{8,15}$/.test(compact) ? compact : null
}

function cleanPath(pathname: string): string[] {
  return pathname
    .split("/")
    .filter(Boolean)
    .map((part) => {
      try {
        return decodeURIComponent(part)
      } catch {
        return part
      }
    })
}

export function parseInstagramUrl(input: string): ParsedInstagramUrl {
  const originalUrl = input.trim()
  if (!originalUrl) return { ok: false, reason: "empty" }

  let url: URL
  try {
    url = new URL(originalUrl)
  } catch {
    return { ok: false, reason: "unrecognized_path" }
  }

  if (url.protocol !== "https:") return { ok: false, reason: "not_https" }
  if (!HOSTS.has(url.hostname.toLowerCase())) return { ok: false, reason: "not_instagram" }

  const parts = cleanPath(url.pathname)
  let linkType: InstagramLinkType = "other"
  let shortcode: string | null = null
  let needsStaffCheck = false

  if (parts[0] === "share" && parts.length >= 2) {
    linkType = "share"
    needsStaffCheck = true
  } else if (parts[0] === "p" && parts[1] && CODE.test(parts[1])) {
    linkType = "post"
    shortcode = parts[1]
  } else if ((parts[0] === "reel" || parts[0] === "reels") && parts[1] && CODE.test(parts[1])) {
    linkType = "reel"
    shortcode = parts[1]
  } else if (parts[0] === "tv" && parts[1] && CODE.test(parts[1])) {
    linkType = "tv"
    shortcode = parts[1]
  } else if (parts.length >= 3 && parts[1] === "p" && CODE.test(parts[2])) {
    linkType = "post"
    shortcode = parts[2]
  } else if (
    parts.length >= 3 &&
    (parts[1] === "reel" || parts[1] === "reels") &&
    CODE.test(parts[2])
  ) {
    linkType = "reel"
    shortcode = parts[2]
  } else {
    return { ok: false, reason: "unrecognized_path" }
  }

  const normalizedPath = shortcode
    ? linkType === "post"
      ? `/p/${shortcode}/`
      : linkType === "reel"
        ? `/reel/${shortcode}/`
        : `/tv/${shortcode}/`
    : `/${parts.join("/")}/`

  return {
    ok: true,
    originalUrl,
    normalizedUrl: `https://www.instagram.com${normalizedPath}`,
    shortcode,
    linkType,
    needsStaffCheck,
  }
}

const REFERENCE_HOSTS = new Set([
  "drive.google.com",
  "docs.google.com",
  "youtube.com",
  "m.youtube.com",
  "youtu.be",
  "instagram.com",
  "www.instagram.com",
])

export function isAllowedReferenceUrl(input: string): boolean {
  try {
    const url = new URL(input.trim())
    return url.protocol === "https:" && REFERENCE_HOSTS.has(url.hostname.toLowerCase())
  } catch {
    return false
  }
}
