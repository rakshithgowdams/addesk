"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field } from "@/components/field"
import { parseInstagramUrl } from "@/lib/instagram"
import { t } from "@/lib/i18n"
import { draftSchema, type DraftState } from "@/lib/validation/schemas"
import {
  checkDuplicates,
  createProduct,
  discardDraft,
  saveDraft,
  submitRequest,
  updateSubmittedRequest,
} from "@/server/actions/requests"

type Brand = { id: string; instagram_handle: string }
type Product = { id: string; name: string }

const control = "h-11 text-base md:text-base"

export function RequestForm({
  orgId,
  orgSlug,
  brands,
  products,
  urgentUsed,
  urgentLimit,
  lastAd,
  initial,
  requestId,
}: {
  orgId: string
  orgSlug: string
  brands: Brand[]
  products: Product[]
  urgentUsed: number
  urgentLimit: number
  lastAd: Partial<DraftState> | null
  initial?: DraftState
  requestId?: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [step, setStep] = useState(initial?.step ?? 0)
  const [draft, setDraft] = useState<DraftState>(initial ?? draftSchema.parse({ brandAccountId: brands[0]?.id ?? "" }))
  const [productList, setProductList] = useState(products)
  const [productName, setProductName] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [duplicates, setDuplicates] = useState<string[]>([])
  const urgentLeft = Math.max(urgentLimit - urgentUsed, 0)

  const dirty = useMemo(() => JSON.stringify(draft), [draft])

  function update(patch: Partial<DraftState>) {
    setDraft((current) => ({ ...current, ...patch }))
  }

  function validateStep() {
    if (step === 0) {
      if (!draft.brandAccountId) return t("form.noBrand")
      const filled = draft.links.filter((link) => link.url.trim())
      if (filled.length === 0) return t("errors.invalid_links")
      if (filled.some((link) => !parseInstagramUrl(link.url).ok)) return t("form.invalidLink")
    }
    if (step === 1 && draft.title.trim().length < 2) return t("form.titleRequired")
    return ""
  }

  function addProduct() {
    if (productName.trim().length < 2) {
      setError(t("form.productName"))
      return
    }
    startTransition(async () => {
      const created = await createProduct(orgId, productName)
      if (!created.ok) {
        setError(created.error)
        return
      }
      setProductList((current) => [...current, created])
      setProductName("")
      setError("")
    })
  }

  function persist(next: DraftState) {
    startTransition(async () => {
      const result = await saveDraft(orgId, next)
      setMessage(result.ok ? t("form.draftSaved") : result.error)
    })
  }

  return (
    <form
      className="grid gap-4"
      data-form-dirty={dirty ? "true" : "false"}
      onSubmit={(event) => {
        event.preventDefault()
        const problem = validateStep()
        if (problem) {
          setError(problem)
          return
        }
        if (step < 2) {
          const nextStep = step + 1
          const next = { ...draft, step: nextStep }
          setDraft(next)
          setStep(nextStep)
          setError("")
          if (!requestId) persist(next)
          return
        }
        startTransition(async () => {
          const result = requestId
            ? await updateSubmittedRequest(requestId, orgId, draft)
            : await submitRequest(orgId, draft)
          if (!result.ok || !result.id) {
            setError(result.ok ? t("errors.generic") : result.error)
            return
          }
          router.push(`/c/${orgSlug}/requests/${result.id}?created=1`)
        })
      }}
    >
      <p className="text-sm text-muted-foreground">
        {t("form.stepPosts")} · {t("form.stepDetails")} · {t("form.stepReview")}
      </p>
      <h1 className="text-2xl font-semibold">{requestId ? t("form.editTitle") : t("form.title")}</h1>
      {brands.length === 0 ? <p>{t("form.noBrand")}</p> : null}

      {step === 0 ? (
        <div className="grid gap-4">
          <Field label={t("form.brand")}>
            <select
              className={`${control} w-full rounded-lg border bg-card px-3`}
              value={draft.brandAccountId}
              onChange={(event) => update({ brandAccountId: event.target.value })}
            >
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  @{brand.instagram_handle}
                </option>
              ))}
            </select>
          </Field>
          {draft.links.map((link, index) => {
            const parsed = link.url ? parseInstagramUrl(link.url) : null
            return (
              <div key={index} className="grid gap-3 rounded-xl border bg-card p-3">
                <Field label={t("form.link")}>
                  <Input
                    className={control}
                    inputMode="url"
                    value={link.url}
                    aria-invalid={Boolean(parsed && !parsed.ok)}
                    onChange={(event) => {
                      const links = draft.links.slice()
                      links[index] = { ...link, url: event.target.value }
                      update({ links })
                    }}
                    onBlur={() => {
                      startTransition(async () => {
                        const found = await checkDuplicates(orgId, draft.links.map((item) => item.url))
                        setDuplicates(found.map((item) => t("form.duplicate", { number: item.request_number })))
                      })
                    }}
                  />
                </Field>
                {parsed && !parsed.ok && link.url.trim() ? <p className="text-sm text-destructive">{t("form.invalidLink")}</p> : null}
                {parsed?.ok && parsed.needsStaffCheck ? <p className="text-sm">{t("request.shareCheck")}</p> : null}
                <Field label={t("form.productOptional")} hint={t("form.productHint")}>
                  <select
                    className={`${control} w-full rounded-lg border bg-card px-3`}
                    value={link.productId}
                    onChange={(event) => {
                      const links = draft.links.slice()
                      links[index] = { ...link, productId: event.target.value }
                      update({ links })
                    }}
                  >
                    <option value="">{t("form.noProduct")}</option>
                    {productList.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </Field>
                {draft.links.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => update({ links: draft.links.filter((_, item) => item !== index) })}
                  >
                    {t("form.remove")}
                  </Button>
                ) : null}
              </div>
            )
          })}
          {duplicates.map((item) => (
            <p key={item} className="text-sm">{item}</p>
          ))}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              className={control}
              value={productName}
              placeholder={t("form.newProduct")}
              onChange={(event) => {
                setProductName(event.target.value)
                setError("")
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return
                event.preventDefault()
                addProduct()
              }}
            />
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={addProduct}
            >
              {t("form.addProduct")}
            </Button>
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={() => update({ links: [...draft.links, { url: "", productId: "" }] })}
          >
            {t("form.addLink")}
          </Button>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="grid gap-4">
          {lastAd ? (
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => update({ ...lastAd, links: draft.links, brandAccountId: draft.brandAccountId, step: 1 })}
            >
              {t("form.copyLast")}
            </Button>
          ) : null}
          <Field label={t("form.requestTitle")}>
            <Input className={control} value={draft.title} onChange={(event) => update({ title: event.target.value })} />
          </Field>
          <Field label={t("form.objective")}>
            <select className={`${control} w-full rounded-lg border bg-card px-3`} value={draft.objective} onChange={(event) => update({ objective: event.target.value })}>
              {["messages", "whatsapp", "website_visits", "profile_visits", "calls", "awareness"].map((item) => (
                <option key={item} value={item}>{t(`objective.${item}`)}</option>
              ))}
            </select>
          </Field>
          <Field label={t("form.destination")}>
            <select className={`${control} w-full rounded-lg border bg-card px-3`} value={draft.destinationType} onChange={(event) => update({ destinationType: event.target.value as DraftState["destinationType"] })}>
              {["whatsapp", "website", "profile", "instagram_dm", "call", "other"].map((item) => (
                <option key={item} value={item}>{t(`destination.${item}`)}</option>
              ))}
            </select>
          </Field>
          <Field label={t("form.destinationValue")}>
            <Input className={control} value={draft.destinationValue} onChange={(event) => update({ destinationValue: event.target.value })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("form.budget")}>
              <Input className={control} inputMode="decimal" value={draft.budgetInr} onChange={(event) => update({ budgetInr: event.target.value })} />
            </Field>
            <Field label={t("form.budgetType")}>
              <select className={`${control} w-full rounded-lg border bg-card px-3`} value={draft.budgetType} onChange={(event) => update({ budgetType: event.target.value as DraftState["budgetType"] })}>
                <option value="daily">{t("budgetType.daily")}</option>
                <option value="total">{t("budgetType.total")}</option>
              </select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("form.start")}><Input className={control} type="date" value={draft.startDate} onChange={(event) => update({ startDate: event.target.value })} /></Field>
            <Field label={t("form.end")}><Input className={control} type="date" value={draft.endDate} onChange={(event) => update({ endDate: event.target.value })} /></Field>
            <Field label={t("form.offerEnd")}><Input className={control} type="date" value={draft.offerEndDate} onChange={(event) => update({ offerEndDate: event.target.value })} /></Field>
          </div>
          <Field label={t("form.locations")}><Input className={control} value={draft.locations} onChange={(event) => update({ locations: event.target.value })} /></Field>
          <Field label={t("form.audience")}><Textarea value={draft.audienceNotes} onChange={(event) => update({ audienceNotes: event.target.value })} /></Field>
          <Field label={t("form.language")}><Input className={control} value={draft.language} onChange={(event) => update({ language: event.target.value })} /></Field>
          <Field label={t("form.offer")}><Textarea value={draft.offerDetails} onChange={(event) => update({ offerDetails: event.target.value })} /></Field>
          <Field label={t("form.notes")}><Textarea value={draft.clientNotes} onChange={(event) => update({ clientNotes: event.target.value })} /></Field>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="grid gap-4">
          <p className="text-sm text-muted-foreground">{t("form.referenceHelp")}</p>
          {draft.assets.map((asset, index) => (
            <div key={index} className="grid gap-2 sm:grid-cols-[160px_1fr]">
              <select className={`${control} rounded-lg border bg-card px-3`} value={asset.kind} onChange={(event) => {
                const assets = draft.assets.slice()
                assets[index] = { ...asset, kind: event.target.value as DraftState["assets"][number]["kind"] }
                update({ assets })
              }}>
                {["screenshot", "reference_video", "product_image", "other"].map((kind) => (
                  <option key={kind} value={kind}>{t(`assetKind.${kind}`)}</option>
                ))}
              </select>
              <Input className={control} inputMode="url" value={asset.url} onChange={(event) => {
                const assets = draft.assets.slice()
                assets[index] = { ...asset, url: event.target.value }
                update({ assets })
              }} />
            </div>
          ))}
          <Button type="button" variant="outline" className="h-11" onClick={() => update({ assets: [...draft.assets, { kind: "screenshot", url: "" }] })}>
            {t("form.addReference")}
          </Button>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1 size-4"
              checked={draft.priority === "urgent"}
              disabled={draft.priority !== "urgent" && urgentLeft === 0}
              onChange={(event) => update({ priority: event.target.checked ? "urgent" : "normal" })}
            />
            <span>
              {t("form.urgent")}
              <span className="mt-1 block text-muted-foreground">
                {urgentLeft === 0 ? t("form.urgentNone") : t("form.urgentLeft", { left: urgentLeft, limit: urgentLimit })}
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-1 size-4" checked={draft.rightsConfirmed} onChange={(event) => update({ rightsConfirmed: event.target.checked })} />
            <span>{t("form.rights")}</span>
          </label>
          <div className="rounded-xl border bg-card p-4 text-sm">
            <p className="font-medium">{t("form.summary")}</p>
            <p className="mt-2">{draft.title}</p>
            <p>{draft.links.filter((link) => link.url.trim()).length} Instagram links</p>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
      {message ? <p className="text-sm" role="status">{message}</p> : null}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <div className="flex gap-2">
          {step > 0 ? (
            <Button type="button" variant="outline" className="h-11" onClick={() => setStep((current) => current - 1)}>
              {t("form.back")}
            </Button>
          ) : null}
          {!requestId ? (
            <Button type="button" variant="ghost" className="h-11" onClick={() => persist(draft)}>
              {t("form.saveDraft")}
            </Button>
          ) : null}
        </div>
        <Button type="submit" className="h-11" disabled={pending || brands.length === 0}>
          {step === 2 ? (pending ? t("form.submitting") : t("form.submit")) : t("form.continue")}
        </Button>
      </div>
      {!requestId ? (
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            startTransition(async () => {
              await discardDraft(orgId)
              setDraft(draftSchema.parse({ brandAccountId: brands[0]?.id ?? "" }))
              setStep(0)
            })
          }}
        >
          {t("form.discard")}
        </Button>
      ) : null}
    </form>
  )
}
