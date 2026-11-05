import fs from "fs"
import path from "path"
import { describe, expect, it } from "vitest"
import { canTransition, isOverdue, REQUEST_STATUSES, TRANSITIONS } from "@/lib/requests/status"

describe("request status rules", () => {
  it("matches the allowed changes in the database migration", () => {
    const sql = fs.readFileSync(
      path.join(process.cwd(), "supabase/migrations/20261105120100_phase1_functions_rls.sql"),
      "utf8",
    )
    for (const status of REQUEST_STATUSES) {
      const allowed = TRANSITIONS[status]
      if (allowed.length === 0) continue
      const fragment = `WHEN '${status}' THEN to_status IN (${allowed.map((item) => `'${item}'`).join(", ")})`
      expect(sql).toContain(fragment)
    }
  })

  it("refuses a backwards or skipped change", () => {
    expect(canTransition("submitted", "live")).toBe(false)
    expect(canTransition("live", "needs_info")).toBe(false)
    expect(canTransition("completed", "live")).toBe(false)
    expect(canTransition("needs_info", "in_review")).toBe(true)
  })

  it("marks a request overdue only before the first agency response", () => {
    const past = new Date(Date.now() - 60_000).toISOString()
    expect(isOverdue({ status: "submitted", first_response_at: null, first_response_due_at: past })).toBe(true)
    expect(isOverdue({ status: "submitted", first_response_at: past, first_response_due_at: past })).toBe(false)
    expect(isOverdue({ status: "cancelled", first_response_at: null, first_response_due_at: past })).toBe(false)
  })
})
