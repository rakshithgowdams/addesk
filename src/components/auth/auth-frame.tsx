import type { ReactNode } from "react"
import { BrandMark } from "@/components/brand-mark"
import { t } from "@/lib/i18n"

export function AuthFrame({
  title,
  lede,
  children,
  footer,
}: {
  title: string
  lede?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <main className="grid min-h-full place-items-center px-4 py-12">
      <div className="page-enter grid w-full max-w-md gap-6">
        <div className="flex items-center gap-3">
          <BrandMark className="size-12 rounded-2xl" />
          <div>
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground">{t("app.credit")}</p>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-[11px] font-medium text-primary">{t("app.version")}</p>
          </div>
        </div>
        {lede ? <p className="text-sm leading-6 text-muted-foreground">{lede}</p> : null}
        <div className="panel grid gap-4 p-5 sm:p-6">{children}</div>
        {footer}
      </div>
    </main>
  )
}
