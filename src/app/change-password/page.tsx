import { PasswordForm } from "@/components/auth/auth-forms"
import { AuthFrame } from "@/components/auth/auth-frame"
import { requireUser } from "@/lib/auth/session"
import { t } from "@/lib/i18n"

export default async function ChangePasswordPage() {
  await requireUser({ allowPasswordChange: true })
  return (
    <AuthFrame title={t("auth.changeTitle")} lede={t("auth.changeHelp")}>
      <PasswordForm />
    </AuthFrame>
  )
}
