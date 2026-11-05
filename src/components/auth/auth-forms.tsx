"use client"

import { useActionState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { requestPasswordReset, signIn, updatePassword } from "@/server/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/field"
import { t } from "@/lib/i18n"

const control = "h-11 text-base md:text-base"

export function LoginForm({ next, error }: { next?: string; error?: string }) {
  const [state, action, pending] = useActionState(signIn, {})
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="next" value={next ?? "/"} />
      <Field label={t("auth.email")} htmlFor="email">
        <Input id="email" className={control} name="email" type="email" autoComplete="username" required />
      </Field>
      <Field label={t("auth.password")} htmlFor="password">
        <Input id="password" className={control} name="password" type="password" autoComplete="current-password" required />
      </Field>
      {error === "disabled" ? <p className="text-sm text-destructive">{t("auth.disabled")}</p> : null}
      {error === "missing" ? <p className="text-sm text-destructive">{t("auth.noProfile")}</p> : null}
      {state.error ? <p className="text-sm text-destructive" role="alert">{state.error}</p> : null}
      <Button className="h-11" disabled={pending} aria-busy={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        {pending ? t("auth.signingIn") : t("auth.signIn")}
      </Button>
      <Link href="/forgot-password" className="text-sm underline-offset-4 hover:underline">{t("auth.forgot")}</Link>
    </form>
  )
}

export function ForgotForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, {})
  return (
    <form action={action} className="grid gap-4">
      <Field label={t("auth.email")} htmlFor="email">
        <Input id="email" className={control} name="email" type="email" autoComplete="username" required />
      </Field>
      {state.error ? <p className="text-sm text-destructive" role="alert">{state.error}</p> : null}
      {state.message ? <p className="text-sm" role="status">{state.message}</p> : null}
      <Button className="h-11" disabled={pending}>{t("auth.sendReset")}</Button>
    </form>
  )
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, {})
  return (
    <form action={action} className="grid gap-4">
      <Field label={t("auth.newPassword")} htmlFor="password">
        <Input id="password" className={control} name="password" type="password" autoComplete="new-password" minLength={12} required />
      </Field>
      <Field label={t("auth.confirmPassword")} htmlFor="confirm">
        <Input id="confirm" className={control} name="confirm" type="password" autoComplete="new-password" minLength={12} required />
      </Field>
      {state.error ? <p className="text-sm text-destructive" role="alert">{state.error}</p> : null}
      <Button className="h-11" disabled={pending}>{t("auth.updatePassword")}</Button>
    </form>
  )
}
