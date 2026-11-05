import fs from "fs"
import path from "path"
import { describe, expect, it } from "vitest"
import { clearBrowserUserData } from "@/lib/pwa/browser-data"

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8")
}

function walk(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) return walk(full)
    return full
  })
}

describe("phase 1 security boundaries", () => {
  it("enables row level security on every public table", () => {
    const sql = walk(path.join(process.cwd(), "supabase/migrations"))
      .filter((file) => file.endsWith(".sql"))
      .map((file) => fs.readFileSync(file, "utf8"))
      .join("\n")
    const tables = [...sql.matchAll(/CREATE TABLE public\.(\w+)/g)].map((match) => match[1])
    expect(tables.length).toBeGreaterThan(10)
    for (const table of tables) {
      expect(sql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`)
    }
  })

  it("keeps staff-only fields out of the client-safe functions", () => {
    const sql = read("supabase/migrations/20261105120100_phase1_functions_rls.sql")
    const start = sql.indexOf("-- BEGIN CLIENT SAFE")
    const end = sql.indexOf("-- END CLIENT SAFE")
    const clientSql = sql.slice(start, end)
    expect(clientSql).not.toContain("staff_only_check_notes")
    expect(clientSql).not.toContain("assigned_to")
    expect(clientSql).not.toContain("ad_code")
    expect(clientSql).toContain("client_visible = true")
  })

  it("does not reference the service role key from client code or public env", () => {
    const files = walk(path.join(process.cwd(), "src")).filter(
      (file) => /\.(ts|tsx|js)$/.test(file) && !file.endsWith(".test.ts"),
    )
    for (const file of files) {
      const source = fs.readFileSync(file, "utf8")
      const isClient = source.startsWith('"use client"') || source.startsWith("'use client'")
      if (isClient) {
        expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY")
        expect(source).not.toContain("createAdminClient")
      }
      expect(source).not.toContain("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY")
    }
    expect(read("src/lib/supabase/admin.ts")).toContain('import "server-only"')
    expect(read("src/lib/env.ts")).not.toContain("SERVICE_ROLE")
  })

  it("does not cache authenticated pages, API responses, or signed URLs", () => {
    const worker = read("public/sw.js")
    expect(worker).toContain('path.startsWith("/admin")')
    expect(worker).toContain('path.startsWith("/c/")')
    expect(worker).toContain('url.origin !== self.location.origin')
    expect(worker).toContain("/storage/v1/")
    expect(worker).toContain('token=')
    expect(worker).toContain('request.mode === "navigate"')
    const navigateIndex = worker.lastIndexOf('request.mode === "navigate"')
    const staticIndex = worker.lastIndexOf("isStaticAsset(url)")
    const putIndex = worker.indexOf("cache.put")
    expect(staticIndex).toBeGreaterThan(navigateIndex)
    expect(putIndex).toBeGreaterThan(staticIndex)
    expect(worker.slice(navigateIndex, staticIndex)).not.toContain("cache.put")
    expect(worker).not.toContain('pathname.startsWith("/_next/static/")')
  })

  it("clears browser storage on sign-out except the install dismissal", () => {
    const keys = ["sb-project-auth-token", "addesk-install-dismissed", "request-draft"]
    const storage = {
      length: keys.length,
      key(index: number) {
        return keys[index] ?? null
      },
      removeItem(key: string) {
        const index = keys.indexOf(key)
        if (index >= 0) keys.splice(index, 1)
      },
      clear() {
        keys.splice(0, keys.length)
      },
    }
    let sessionCleared = false
    clearBrowserUserData(storage, { clear: () => { sessionCleared = true } })
    expect(keys).toEqual(["addesk-install-dismissed"])
    expect(sessionCleared).toBe(true)
  })
})
