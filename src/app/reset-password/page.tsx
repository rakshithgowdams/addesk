import { PasswordForm } from "@/components/auth/auth-forms"
import { AuthFrame } from "@/components/auth/auth-frame"
import { t } from "@/lib/i18n"

export default function ResetPasswordPage() {
  return (
    <AuthFrame title={t("auth.resetTitle")}>
      <PasswordForm />
    </AuthFrame>
  )
}
