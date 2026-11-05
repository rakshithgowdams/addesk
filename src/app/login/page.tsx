import { Suspense } from "react"
import { LoginForm } from "@/components/auth/auth-forms"
import { AuthFrame } from "@/components/auth/auth-frame"
import { PageLoading } from "@/components/empty-state"
import { t } from "@/lib/i18n"

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>
}) {
  return (
    <Suspense fallback={<PageLoading />}>
      <LoginPageContent searchParams={searchParams} />
    </Suspense>
  )
}

async function LoginPageContent({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>
}) {
  const params = await searchParams
  return (
    <AuthFrame title={t("auth.loginTitle")} lede={t("auth.loginHelp")}>
      <LoginForm next={params.next} error={params.error} />
    </AuthFrame>
  )
}
