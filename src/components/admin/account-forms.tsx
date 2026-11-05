"use client"

import { useEffect, useState, useTransition } from "react"
import QRCode from "qrcode"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { CopyButton } from "@/components/copy-button"
import { Field } from "@/components/field"
import { t } from "@/lib/i18n"
import {
  addBrandAccount,
  addClientMember,
  addStaffMember,
  createClientAccount,
  resetUserPassword,
  setOrganizationStatus,
  setUserActive,
  updateBrandAccount,
  updateOrganizationSettings,
} from "@/server/actions/accounts"

const control = "h-11 text-base md:text-base"

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
}

function prefixFrom(value: string) {
  const letters = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase()
  const sliced = letters.slice(0, 4)
  return sliced.length >= 2 ? sliced : `${sliced}AD`.slice(0, 4)
}

function LoginResult({
  password,
  existing,
}: {
  password: string | null
  existing: boolean
}) {
  const [qr, setQr] = useState("")
  const link = typeof window === "undefined" ? "/install" : `${window.location.origin}/install`
  useEffect(() => {
    void QRCode.toDataURL(link, { margin: 1, width: 240 }).then(setQr)
  }, [link])
  return (
    <div className="grid gap-3 rounded-xl border bg-amber-50 p-4 text-sm text-amber-950" role="status">
      {existing ? <p>{t("admin.existingUser")}</p> : null}
      {password ? (
        <>
          <p className="font-medium">{t("admin.passwordOnce")}</p>
          <code className="break-all rounded bg-white px-2 py-2 text-base">{password}</code>
          <CopyButton value={password} />
        </>
      ) : null}
      <p>{t("admin.installHelp")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="break-all">{link}</code>
        <CopyButton value={link} />
      </div>
      {qr ? (
        // The QR code is a local data URL for the install link, so the image optimizer cannot fetch it.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qr} alt="" width={240} height={240} />
      ) : null}
    </div>
  )
}

export function CreateClientForm() {
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [prefix, setPrefix] = useState("")
  const [touched, setTouched] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<{ password: string | null; existingUser: boolean } | null>(null)
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild>
      <Button className="h-11 px-4">
        <Plus />
        {t("admin.addClient")}
      </Button>
    </DialogTrigger>
    <DialogContent className="max-h-[min(90vh,760px)] overflow-y-auto sm:max-w-lg">
    <DialogHeader>
      <DialogTitle className="text-lg">{t("admin.addClient")}</DialogTitle>
    </DialogHeader>
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        startTransition(async () => {
          const created = await createClientAccount({
            name: data.get("name"),
            slug: data.get("slug"),
            prefix: data.get("prefix"),
            instagramHandle: data.get("instagramHandle"),
            contactName: data.get("contactName"),
            email: data.get("email"),
            phone: data.get("phone"),
            password: data.get("password"),
          })
          if (!created.ok) {
            setError(created.error)
            setResult(null)
            return
          }
          setError("")
          setResult(created)
        })
      }}
    >
      <Field label={t("admin.businessName")}>
        <Input
          className={control}
          name="name"
          required
          value={name}
          onChange={(event) => {
            const next = event.target.value
            setName(next)
            if (!touched) {
              setSlug(slugify(next))
              setPrefix(prefixFrom(next))
            }
          }}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("admin.slug")}>
          <Input className={control} name="slug" required value={slug} onChange={(event) => { setTouched(true); setSlug(event.target.value) }} />
        </Field>
        <Field label={t("admin.prefix")}>
          <Input className={control} name="prefix" required value={prefix} onChange={(event) => { setTouched(true); setPrefix(event.target.value.toUpperCase()) }} />
        </Field>
      </div>
      <Field label={t("admin.handle")} hint={t("admin.handleHelp")}>
        <Input className={control} name="instagramHandle" required placeholder="@name or instagram.com/name" />
      </Field>
      <Field label={t("admin.contactName")}><Input className={control} name="contactName" required /></Field>
      <Field label={t("admin.contactEmail")}><Input className={control} name="email" type="email" required /></Field>
      <Field label={t("admin.phone")} hint={t("admin.phoneHelp")}>
        <Input className={control} name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="9876543210" />
      </Field>
      <Field label={t("admin.tempPassword")} hint={t("admin.tempPasswordHelp")}>
        <Input className={control} name="password" type="text" autoComplete="off" />
      </Field>
      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
      {result ? <LoginResult password={result.password} existing={result.existingUser} /> : null}
      <Button className="h-11" disabled={pending}>{t("admin.create")}</Button>
    </form>
    </DialogContent>
    </Dialog>
  )
}

export function AddMemberForm({ orgId }: { orgId: string }) {
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<{ password: string | null; existingUser: boolean } | null>(null)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-11 px-4">
          <Plus />
          {t("admin.addMember")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">{t("admin.addMember")}</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            const data = new FormData(event.currentTarget)
            startTransition(async () => {
              const created = await addClientMember({
                orgId,
                fullName: data.get("fullName"),
                email: data.get("email"),
                phone: data.get("phone"),
                role: data.get("role"),
                password: data.get("password"),
              })
              if (!created.ok) {
                setError(created.error)
                return
              }
              setError("")
              setResult(created)
              event.currentTarget.reset()
            })
          }}
        >
          <Field label={t("admin.contactName")}><Input className={control} name="fullName" required /></Field>
          <Field label={t("admin.contactEmail")}><Input className={control} name="email" type="email" required /></Field>
          <Field label={t("admin.phone")} hint={t("admin.phoneHelp")}>
            <Input className={control} name="phone" type="tel" inputMode="tel" autoComplete="tel" />
          </Field>
          <Field label={t("admin.role")}>
            <select name="role" className={`${control} rounded-lg border bg-card px-3`}>
              <option value="client_member">{t("admin.clientMember")}</option>
              <option value="client_owner">{t("admin.clientOwner")}</option>
            </select>
          </Field>
          <Field label={t("admin.tempPassword")} hint={t("admin.tempPasswordHelp")}>
            <Input className={control} name="password" autoComplete="off" />
          </Field>
          {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
          {result ? <LoginResult password={result.password} existing={result.existingUser} /> : null}
          <Button className="h-11" disabled={pending}>{t("admin.addMember")}</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function AddStaffForm() {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const [result, setResult] = useState<{ password: string | null; existingUser: boolean } | null>(null)
  return (
    <form
      className="panel grid gap-3 p-4"
      onSubmit={(event) => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        startTransition(async () => {
          const created = await addStaffMember({
            fullName: data.get("fullName"),
            email: data.get("email"),
            role: data.get("role"),
            password: data.get("password"),
          })
          if (!created.ok) {
            setError(created.error)
            return
          }
          setError("")
          setResult(created)
        })
      }}
    >
      <h2 className="font-semibold">{t("admin.addMember")}</h2>
      <Input className={control} name="fullName" placeholder={t("admin.contactName")} required />
      <Input className={control} name="email" type="email" required />
      <select name="role" className={`${control} rounded-lg border bg-card px-3`}>
        <option value="staff">{t("admin.staff")}</option>
        <option value="super_admin">{t("admin.superAdmin")}</option>
      </select>
      <Input className={control} name="password" placeholder={t("admin.tempPassword")} autoComplete="off" />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {result ? <LoginResult password={result.password} existing={result.existingUser} /> : null}
      <Button className="h-11" disabled={pending}>{t("admin.create")}</Button>
    </form>
  )
}

export function UserAccessButtons({ userId, active }: { userId: string; active: boolean }) {
  const [pending, startTransition] = useTransition()
  const [password, setPassword] = useState<string | null>(null)
  const [error, setError] = useState("")
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" className="h-11" disabled={pending} onClick={() => startTransition(async () => {
        const result = await setUserActive(userId, !active)
        if (!result.ok) setError(result.error)
      })}>
        {active ? t("admin.disable") : t("admin.enable")}
      </Button>
      <Button type="button" variant="outline" className="h-11" disabled={pending} onClick={() => startTransition(async () => {
        const result = await resetUserPassword(userId)
        if (!result.ok) setError(result.error)
        else setPassword(result.password)
      })}>
        {t("admin.resetPassword")}
      </Button>
      {password ? <div className="basis-full"><LoginResult password={password} existing={false} /></div> : null}
      {error ? <p className="basis-full text-sm text-destructive" role="alert">{error}</p> : null}
    </div>
  )
}

export function OrgStatusButtons({ orgId, status }: { orgId: string; status: "active" | "paused" | "offboarded" }) {
  const [pending, startTransition] = useTransition()
  const [confirmClose, setConfirmClose] = useState(false)
  return (
    <div className="grid justify-items-end gap-2">
      <div className="flex flex-wrap gap-2">
        {status === "active" ? (
          <Button type="button" variant="outline" className="h-11" disabled={pending} onClick={() => startTransition(() => { void setOrganizationStatus(orgId, "paused") })}>{t("admin.pause")}</Button>
        ) : (
          <Button type="button" className="h-11" disabled={pending} onClick={() => startTransition(() => { void setOrganizationStatus(orgId, "active") })}>{t("admin.resume")}</Button>
        )}
        {status !== "offboarded" ? (
          <Button type="button" variant="destructive" className="h-11" disabled={pending} onClick={() => setConfirmClose(true)}>{t("admin.offboard")}</Button>
        ) : null}
      </div>
      {confirmClose ? (
        <div className="panel grid max-w-sm gap-3 p-3 text-sm">
          <p>{t("admin.closeConfirm")}</p>
          <div className="flex gap-2">
            <Button type="button" variant="destructive" className="h-11" disabled={pending} onClick={() => startTransition(async () => { await setOrganizationStatus(orgId, "offboarded"); setConfirmClose(false) })}>{t("admin.offboard")}</Button>
            <Button type="button" variant="outline" className="h-11" disabled={pending} onClick={() => setConfirmClose(false)}>{t("admin.cancel")}</Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function OrgSettingsForm({
  orgId,
  responseHours,
  urgentLimit,
}: {
  orgId: string
  responseHours: number
  urgentLimit: number
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        startTransition(async () => {
          const result = await updateOrganizationSettings({
            id: orgId,
            responseHours: Number(data.get("responseHours")),
            urgentLimit: Number(data.get("urgentLimit")),
          })
          setSaved(result.ok)
          setError(result.ok ? "" : result.error)
        })
      }}
    >
      <Field label={t("admin.responseHours")}><Input className={control} name="responseHours" type="number" min={1} max={168} defaultValue={responseHours} /></Field>
      <Field label={t("admin.urgentLimit")}><Input className={control} name="urgentLimit" type="number" min={0} max={20} defaultValue={urgentLimit} /></Field>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button className="h-11" disabled={pending}>{t("admin.saveSettings")}</Button>
        {saved ? <p className="text-sm text-muted-foreground" role="status">{t("admin.saved")}</p> : null}
      </div>
      {error ? <p className="text-sm text-destructive sm:col-span-2" role="alert">{error}</p> : null}
    </form>
  )
}

export function AddBrandForm({ orgId }: { orgId: string }) {
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState("")
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-11 px-4">
          <Plus />
          {t("admin.addBrand")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">{t("admin.addBrand")}</DialogTitle>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={(event) => {
          event.preventDefault()
          const data = new FormData(event.currentTarget)
          startTransition(async () => {
            const result = await addBrandAccount({
              orgId,
              instagramHandle: data.get("instagramHandle"),
              facebookPageName: data.get("facebookPageName"),
              adAccountLabel: data.get("adAccountLabel"),
            })
            setError(result.ok ? "" : result.error)
            if (result.ok) {
              event.currentTarget.reset()
              setOpen(false)
            }
          })
        }}>
          <Field label={t("admin.handle")} hint={t("admin.handleHelp")}>
            <Input className={control} name="instagramHandle" required />
          </Field>
          <Field label={t("admin.facebookPage")}><Input className={control} name="facebookPageName" /></Field>
          <Field label={t("admin.adAccount")}><Input className={control} name="adAccountLabel" /></Field>
          {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
          <Button className="h-11" disabled={pending}>{t("admin.addBrand")}</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function BrandChecklistForm({
  brand,
}: {
  brand: {
    id: string
    is_professional_account: boolean
    is_public_account: boolean
    access_checklist_status: "not_started" | "in_progress" | "ready" | "blocked"
    notes_for_client: string
    facebook_page_name: string | null
    ad_account_label: string | null
  }
}) {
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")
  return (
    <form className="grid gap-4 rounded-xl border bg-background/70 p-4" onSubmit={(event) => {
      event.preventDefault()
      const data = new FormData(event.currentTarget)
      startTransition(async () => {
        const result = await updateBrandAccount({
          id: brand.id,
          isProfessionalAccount: data.get("professional") === "on",
          isPublicAccount: data.get("public") === "on",
          accessChecklistStatus: String(data.get("status")),
          notesForClient: String(data.get("notes") ?? ""),
          facebookPageName: String(data.get("facebook") ?? ""),
          adAccountLabel: String(data.get("ad") ?? ""),
        })
        setSaved(result.ok)
        setError(result.ok ? "" : result.error)
      })
    }}>
      <div className="flex flex-wrap gap-4">
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="professional" defaultChecked={brand.is_professional_account} className="size-4" />{t("admin.professional")}</label>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="public" defaultChecked={brand.is_public_account} className="size-4" />{t("admin.publicAccount")}</label>
      </div>
      <Field label={t("admin.checklistStatus")}>
        <select name="status" defaultValue={brand.access_checklist_status} className={`${control} rounded-lg border bg-card px-3`}>
          {["not_started", "in_progress", "ready", "blocked"].map((item) => (
            <option key={item} value={item}>{t(`checklist.${item}`)}</option>
          ))}
        </select>
      </Field>
      <Field label={t("admin.facebookPage")}><Input className={control} name="facebook" defaultValue={brand.facebook_page_name ?? ""} /></Field>
      <Field label={t("admin.adAccount")}><Input className={control} name="ad" defaultValue={brand.ad_account_label ?? ""} /></Field>
      <Field label={t("admin.notesForClient")}>
        <textarea name="notes" defaultValue={brand.notes_for_client} className="min-h-24 rounded-lg border bg-card px-3 py-2" />
      </Field>
      <div className="flex items-center gap-3">
        <Button className="h-11" disabled={pending}>{t("admin.save")}</Button>
        {saved ? <p className="text-sm text-muted-foreground" role="status">{t("admin.saved")}</p> : null}
      </div>
      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
    </form>
  )
}
