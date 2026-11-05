import Link from "next/link"
import { ForgotForm } from "@/components/auth/auth-forms"
import { AuthFrame } from "@/components/auth/auth-frame"
import { t } from "@/lib/i18n"

export default function ForgotPasswordPage() {
  return (
    <AuthFrame
      title={t("auth.forgotTitle")}
      lede={t("auth.forgotHelp")}
      footer={<Link href="/login" className="text-sm underline-offset-4 hover:underline">{t("auth.loginTitle")}</Link>}
    >
      <ForgotForm />
    </AuthFrame>
  )
}
