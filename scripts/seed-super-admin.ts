import { config } from "dotenv"
import { createClient } from "@supabase/supabase-js"

config({ path: ".env.local" })
config({ path: ".env" })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const email = process.env.SEED_ADMIN_EMAIL?.toLowerCase()
const password = process.env.SEED_ADMIN_PASSWORD
const name = process.env.SEED_ADMIN_NAME || "Super admin"

if (!url || !key || !email || !password) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SEED_ADMIN_EMAIL, and SEED_ADMIN_PASSWORD.")
  process.exit(1)
}

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

async function seed() {
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (listed.error) {
    console.error(listed.error.message)
    process.exit(1)
  }

  let userId = listed.data.users.find((user) => user.email?.toLowerCase() === email)?.id
  let createdNow = false
  if (!userId) {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name },
    })
    if (created.error || !created.data.user) {
      console.error(created.error?.message ?? "Could not create the super admin.")
      process.exit(1)
    }
    userId = created.data.user.id
    createdNow = true
  }

  const existingProfile = await admin.from("profiles").select("id").eq("id", userId).maybeSingle()
  const { data: profile, error } = await admin
    .from("profiles")
    .upsert(
      {
        id: userId,
        email,
        full_name: name,
        platform_role: "super_admin",
        is_active: true,
        must_change_password: createdNow || !existingProfile.data,
      },
      { onConflict: "id" },
    )
    .select("id")
    .single()

  if (error || !profile) {
    console.error(error?.message ?? "The admin profile was not saved.")
    process.exit(1)
  }

await admin.from("audit_logs").insert({
  actor_id: userId,
  action: "super_admin_seeded",
  target_type: "user",
  target_id: userId,
  metadata: {},
})

console.log(`Super admin ready for ${email}. Change the password on first login.`)
}

seed().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Seed failed.")
  process.exit(1)
})
