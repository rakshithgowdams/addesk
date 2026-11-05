import type { Metadata, Viewport } from "next"
import { Geist } from "next/font/google"
import { Suspense } from "react"
import { ServiceWorkerRegister } from "@/components/pwa/pwa-client"
import { PageLoading } from "@/components/empty-state"
import { t } from "@/lib/i18n"
import "./globals.css"

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
})

export const viewport: Viewport = {
  themeColor: "#123f3d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export const metadata: Metadata = {
  title: { default: t("app.name"), template: `%s · ${t("app.name")}` },
  description: t("app.description"),
  applicationName: t("app.name"),
  robots: { index: false, follow: false },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: t("app.name"),
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/logo.png", sizes: "1024x1024", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full bg-background text-foreground">
        <ServiceWorkerRegister />
        <Suspense fallback={<PageLoading />}>{children}</Suspense>
      </body>
    </html>
  )
}
