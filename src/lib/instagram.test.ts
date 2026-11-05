import { describe, expect, it } from "vitest"
import { instagramHandleFromInput, isAllowedReferenceUrl, normalizePhone, parseInstagramUrl } from "@/lib/instagram"

describe("parseInstagramUrl", () => {
  it("keeps the original link and strips tracking parameters", () => {
    const parsed = parseInstagramUrl("https://www.instagram.com/p/ABC123/?utm_source=ig&igsh=abc")
    expect(parsed).toMatchObject({
      ok: true,
      originalUrl: "https://www.instagram.com/p/ABC123/?utm_source=ig&igsh=abc",
      normalizedUrl: "https://www.instagram.com/p/ABC123/",
      shortcode: "ABC123",
      linkType: "post",
      needsStaffCheck: false,
    })
  })

  it("accepts reels, tv, username paths, and share links", () => {
    expect(parseInstagramUrl("https://instagram.com/reel/AbC/")).toMatchObject({ linkType: "reel", shortcode: "AbC" })
    expect(parseInstagramUrl("https://www.instagram.com/reels/ZZ9/")).toMatchObject({ linkType: "reel", shortcode: "ZZ9" })
    expect(parseInstagramUrl("https://www.instagram.com/tv/TvCode/")).toMatchObject({ linkType: "tv", shortcode: "TvCode" })
    expect(parseInstagramUrl("https://www.instagram.com/pari.trends/p/Post1/")).toMatchObject({
      linkType: "post",
      shortcode: "Post1",
    })
    expect(parseInstagramUrl("https://www.instagram.com/pari.trends/reel/Reel1/?igsh=1")).toMatchObject({
      normalizedUrl: "https://www.instagram.com/reel/Reel1/",
      shortcode: "Reel1",
    })
    expect(parseInstagramUrl("https://www.instagram.com/share/abcXYZ/?igsh=1")).toMatchObject({
      linkType: "share",
      shortcode: null,
      needsStaffCheck: true,
      normalizedUrl: "https://www.instagram.com/share/abcXYZ/",
    })
  })

  it("rejects non-https, non-instagram, and unsupported paths", () => {
    expect(parseInstagramUrl("http://www.instagram.com/p/ABC/")).toMatchObject({ ok: false, reason: "not_https" })
    expect(parseInstagramUrl("https://facebook.com/p/ABC/")).toMatchObject({ ok: false, reason: "not_instagram" })
    expect(parseInstagramUrl("https://www.instagram.com/stories/pari/1/")).toMatchObject({
      ok: false,
      reason: "unrecognized_path",
    })
  })
})

describe("instagramHandleFromInput", () => {
  it("accepts a username, an @handle, and a profile link", () => {
    expect(instagramHandleFromInput("alur_pari_trends")).toBe("alur_pari_trends")
    expect(instagramHandleFromInput("@alur_pari_trends")).toBe("alur_pari_trends")
    expect(instagramHandleFromInput("https://www.instagram.com/alur_pari_trends")).toBe("alur_pari_trends")
    expect(instagramHandleFromInput("instagram.com/alur_pari_trends/")).toBe("alur_pari_trends")
  })

  it("rejects a post link", () => {
    expect(instagramHandleFromInput("https://www.instagram.com/p/ABC123/")).toBeNull()
  })
})

describe("normalizePhone", () => {
  it("keeps a mobile number and drops spaces", () => {
    expect(normalizePhone("98765 43210")).toBe("9876543210")
    expect(normalizePhone("+91 98765 43210")).toBe("+919876543210")
    expect(normalizePhone("")).toBe("")
    expect(normalizePhone("123")).toBeNull()
  })
})

describe("isAllowedReferenceUrl", () => {
  it("allows Drive, YouTube, and Instagram https links", () => {
    expect(isAllowedReferenceUrl("https://drive.google.com/file/d/abc")).toBe(true)
    expect(isAllowedReferenceUrl("https://youtu.be/abc")).toBe(true)
    expect(isAllowedReferenceUrl("http://youtube.com/watch?v=1")).toBe(false)
    expect(isAllowedReferenceUrl("https://example.com/video")).toBe(false)
  })
})
