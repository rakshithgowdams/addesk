import Link from "next/link"
import { BrandMark } from "@/components/brand-mark"
import { InstallPrompt } from "@/components/pwa/pwa-client"
import { ShellNav } from "@/components/shell-nav"
import { EnablePush } from "@/components/push/enable-push"
import { SignOutButton } from "@/components/sign-out-button"
import { t } from "@/lib/i18n"

export function AppShell({
  title,
  links,
  children,
  switcher,
}: {
  title: string
  links: { href: string; label: string }[]
  children: React.ReactNode
  switcher?: React.ReactNode
}) {
  return (
    <div className="min-h-full">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2"
      >
        {t("nav.skip")}
      </a>
      <header className="safe-top sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-3 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            <BrandMark className="size-9" />
            <span>
              <span className="block text-[11px] font-medium tracking-wide text-muted-foreground">{t("app.credit")}</span>
              <span className="flex items-center gap-2">
                <span className="text-sm font-semibold leading-tight">{title}</span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{t("app.version")}</span>
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <EnablePush />
            <SignOutButton />
          </div>
        </div>
        <ShellNav links={links} label={title} />
      </header>
      <main id="main" className="page-enter mx-auto grid w-full max-w-6xl gap-5 px-4 pt-6 pb-[calc(env(safe-area-inset-bottom,0px)+4rem)]">
        {switcher}
        <InstallPrompt />
        {children}
      </main>
    </div>
  )
}
