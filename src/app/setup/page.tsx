import { connection } from "next/server"
import { redirect } from "next/navigation"
import { publicSupabaseEnv } from "@/lib/env"
import { t } from "@/lib/i18n"

export default async function SetupPage() {
  await connection()
  if (publicSupabaseEnv()) redirect("/")
  return (
    <main className="mx-auto grid min-h-full max-w-lg gap-3 px-4 py-10">
      <h1 className="text-2xl font-semibold">{t("setup.title")}</h1>
      <p className="text-sm leading-6 text-muted-foreground">{t("setup.body")}</p>
    </main>
  )
}
