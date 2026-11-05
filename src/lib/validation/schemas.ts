import { z } from "zod"
import { instagramHandleFromInput, normalizePhone } from "@/lib/instagram"

const dateField = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()

export const linkSchema = z.object({
  originalUrl: z.string().trim().min(1).max(2000),
  normalizedUrl: z.string().trim().min(1).max(2000),
  shortcode: z.string().trim().max(80).nullable(),
  linkType: z.enum(["post", "reel", "tv", "share", "other"]),
  productId: z.string().uuid().nullable(),
  sortOrder: z.number().int().min(0).max(20),
})

export const assetSchema = z.object({
  kind: z.enum(["reference_video", "screenshot", "product_image", "other"]),
  externalUrl: z.string().trim().url().max(2000),
  fileName: z.string().trim().max(180).optional().default(""),
})

export const requestPayloadSchema = z
  .object({
    title: z.string().trim().min(2).max(160),
    priority: z.enum(["normal", "urgent"]),
    brandAccountId: z.string().uuid(),
    objective: z.string().trim().min(2).max(80),
    destinationType: z.enum(["whatsapp", "website", "profile", "instagram_dm", "call", "other"]),
    destinationValue: z.string().trim().max(300).default(""),
    budgetInr: z.number().min(0).max(100000000).nullable(),
    budgetType: z.enum(["daily", "total"]).nullable(),
    startDate: dateField,
    endDate: dateField,
    offerEndDate: dateField,
    locations: z.string().trim().max(500).default(""),
    audienceNotes: z.string().trim().max(2000).default(""),
    language: z.string().trim().max(120).default(""),
    offerDetails: z.string().trim().max(2000).default(""),
    clientNotes: z.string().trim().max(4000).default(""),
    rightsConfirmed: z.literal(true),
    links: z.array(linkSchema).min(1).max(10),
    assets: z.array(assetSchema).max(10).default([]),
  })
  .refine((value) => !value.startDate || !value.endDate || value.endDate >= value.startDate, {
    path: ["endDate"],
    message: "date_order",
  })

export type RequestPayload = z.infer<typeof requestPayloadSchema>

export const draftSchema = z.object({
  step: z.number().int().min(0).max(2).default(0),
  title: z.string().max(160).default(""),
  priority: z.enum(["normal", "urgent"]).default("normal"),
  brandAccountId: z.string().default(""),
  objective: z.string().max(80).default("messages"),
  destinationType: z.enum(["whatsapp", "website", "profile", "instagram_dm", "call", "other"]).default("whatsapp"),
  destinationValue: z.string().max(300).default(""),
  budgetInr: z.string().max(20).default(""),
  budgetType: z.enum(["daily", "total"]).default("daily"),
  startDate: z.string().max(10).default(""),
  endDate: z.string().max(10).default(""),
  offerEndDate: z.string().max(10).default(""),
  locations: z.string().max(500).default(""),
  audienceNotes: z.string().max(2000).default(""),
  language: z.string().max(120).default(""),
  offerDetails: z.string().max(2000).default(""),
  clientNotes: z.string().max(4000).default(""),
  rightsConfirmed: z.boolean().default(false),
  links: z
    .array(
      z.object({
        url: z.string().max(2000).default(""),
        productId: z.string().default(""),
      }),
    )
    .max(10)
    .default([{ url: "", productId: "" }]),
  assets: z
    .array(
      z.object({
        kind: z.enum(["reference_video", "screenshot", "product_image", "other"]).default("screenshot"),
        url: z.string().max(2000).default(""),
      }),
    )
    .max(10)
    .default([]),
})

export type DraftState = z.infer<typeof draftSchema>

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

const prefix = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{2,6}$/)

const handle = z
  .string()
  .trim()
  .max(300)
  .transform((value) => instagramHandleFromInput(value) ?? "")
  .pipe(z.string().regex(/^[A-Za-z0-9._]{1,30}$/))

const phone = z
  .string()
  .trim()
  .max(32)
  .optional()
  .default("")
  .transform((value) => normalizePhone(value))
  .refine((value): value is string => value !== null)

export const createClientSchema = z.object({
  name: z.string().trim().min(2).max(160),
  slug,
  prefix,
  instagramHandle: handle,
  contactName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  phone,
  password: z.string().max(72).optional().default(""),
})

export const addMemberSchema = z.object({
  orgId: z.string().uuid(),
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  phone,
  role: z.enum(["client_owner", "client_member"]),
  password: z.string().max(72).optional().default(""),
})

export const addStaffSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  role: z.enum(["super_admin", "staff"]),
  password: z.string().max(72).optional().default(""),
})

export const brandSchema = z.object({
  orgId: z.string().uuid(),
  instagramHandle: handle,
  facebookPageName: z.string().trim().max(160).optional().default(""),
  adAccountLabel: z.string().trim().max(160).optional().default(""),
})

export const brandUpdateSchema = z.object({
  id: z.string().uuid(),
  isProfessionalAccount: z.boolean(),
  isPublicAccount: z.boolean(),
  accessChecklistStatus: z.enum(["not_started", "in_progress", "ready", "blocked"]),
  notesForClient: z.string().trim().max(2000).default(""),
  facebookPageName: z.string().trim().max(160).default(""),
  adAccountLabel: z.string().trim().max(160).default(""),
})

export const orgSettingsSchema = z.object({
  id: z.string().uuid(),
  responseHours: z.number().int().min(1).max(168),
  urgentLimit: z.number().int().min(0).max(20),
})
