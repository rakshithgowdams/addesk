import { t } from "@/lib/i18n"

const CODES = [
  "not_allowed",
  "invalid_status",
  "urgent_limit",
  "org_not_active",
  "rights_required",
  "not_editable",
  "invalid_instagram_url",
  "invalid_brand",
  "invalid_product",
  "invalid_reference_url",
  "invalid_links",
  "invalid_assets",
  "last_super_admin",
  "already_member",
  "note_required",
  "assignee_not_agency",
  "locked_field",
  "not_found",
  "append_only",
] as const

export function errorText(error: { message?: string } | null | undefined): string {
  const message = error?.message ?? ""
  const code = CODES.find((item) => message.includes(item))
  if (message.includes("duplicate key") && message.includes("slug")) return t("errors.generic")
  if (message.includes("organizations_slug_key")) return "That workspace slug is already used."
  if (message.includes("organizations_request_prefix_key")) return "That request prefix is already used."
  if (message.includes("profiles_email_key") || message.includes("already been registered")) {
    return "already_registered"
  }
  if (code) return t(`errors.${code}`)
  return t("errors.generic")
}
