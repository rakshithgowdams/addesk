import { t } from "@/lib/i18n"
import type { RequestStatus } from "@/lib/requests/status"

export type Blocker =
  | "none"
  | "waiting_on_client"
  | "waiting_on_creator_approval"
  | "waiting_on_agency"
  | "waiting_on_meta"

export function statusLabel(status: RequestStatus): string {
  return t(`status.${status}`)
}

export function blockerLabel(blocker: Blocker, audience: "client" | "agency"): string {
  return t(`${audience === "client" ? "blockerClient" : "blockerAgency"}.${blocker}`)
}

export function whoseTurn(
  status: RequestStatus,
  blocker: Blocker,
  audience: "client" | "agency",
): { label: string; tone: "client" | "agency" | "quiet" } {
  if (status === "completed" || status === "rejected" || status === "cancelled") {
    return { label: t("turn.closed"), tone: "quiet" }
  }
  if (status === "live") return { label: t("turn.running"), tone: "quiet" }
  if (status === "paused") return { label: t("turn.paused"), tone: "quiet" }
  if (blocker === "waiting_on_creator_approval") {
    return { label: t("turn.creator"), tone: "agency" }
  }
  if (blocker === "waiting_on_meta") return { label: t("turn.meta"), tone: "agency" }
  if (blocker === "waiting_on_client" || status === "needs_info") {
    return {
      label: audience === "client" ? t("turn.yourTurn") : t("turn.clientTurn"),
      tone: "client",
    }
  }
  return {
    label: audience === "client" ? t("turn.ourTurn") : t("turn.teamTurn"),
    tone: "agency",
  }
}
