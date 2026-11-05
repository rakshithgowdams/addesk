# AdDesk

AdDesk is the request desk for a Meta ads agency. A client nominates an Instagram post, and both sides can see the request number, the live status, the blocker, and the history. Phase 1 is the portal itself. Channels, file uploads, email, and Meta API sync come later.

## What this phase includes

- Email login, password reset, and a forced password change. There is no public sign-up.
- A super admin creates each client, its owner, its first Instagram account, and its default channel. The temporary password is shown once.
- Client workspace: home, request list, three-step request form with a server-side draft, and the request page.
- Master panel: counts, overdue queue, all requests, client profile, team, and audit log.
- Status changes are enforced in the database. Every change is written to the request history.
- One installable app. The account decides whether login opens the master panel or a client workspace.

## Setup

1. Create a Supabase project and run the SQL in `supabase/migrations` in order, or use the Supabase CLI:

```bash
supabase db push
```

2. In the Supabase dashboard, turn off public sign-ups. Add these redirect URLs:

- `http://localhost:3000/auth/callback`
- your production URL with the same `/auth/callback` path

3. Copy `.env.example` to `.env.local` and fill in the Supabase URL, the anon or publishable key, and the service role key. The service role key must never use a `NEXT_PUBLIC_` name.

4. Install and seed the first super admin:

```bash
npm install
npm run seed
```

The seed reads `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, and `SEED_ADMIN_NAME`. The first login asks for a new password. The seed does not print the password.

5. Start the app:

```bash
npm run dev
```

Create Pari Trends from **Clients**. Do not put a sample client in the database by hand if you want the audit history to match what the screen does.

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Row-level security tests live in `supabase/tests` and run against a local Supabase database:

```bash
supabase test db
```

After the migrations are applied, run the Supabase security advisor and fix anything it reports before going live. Database types can be regenerated with `npm run db:types` once the local database is running. The checked-in types match the phase 1 migrations.

## Deploy

Deploy the Next.js app to Vercel. Set the same environment variables there, and set `NEXT_PUBLIC_APP_URL` to the public https URL. Apply the migrations to the production database before the first login.

Install the app from `/install`. Android and desktop Chrome or Edge can use the install button when the browser offers it. iPhone and iPad use Safari: Share, Add to Home Screen, Add. A link opened inside WhatsApp or Instagram has to be opened in Chrome or Safari first.

## Before a real client uses it

The rights checkbox is plain language, not legal advice. Have a lawyer review it before launch.

AdDesk never asks for an Instagram, Facebook, or Meta password. Access is granted in Meta Business Settings.

Phase 1 stores the link and the details the client typed. It does not read the post from Instagram. Confirm the post, the music, and the permission to advertise in Instagram and Ads Manager.

## Phase 1 assumptions

- One agency uses the portal. Client data is scoped by organization so a second agency would be a later migration, not a setting.
- Nominating a post means the client asks for that post to be run as an ad.
- The default reply time is 24 hours and the default urgent limit is 2 per client per month. Both can be changed per client.
- Clients can submit posts from their own accounts or from creators. The permission method starts as not checked.
- Spend and results will show on the request after the later results update. Phase 1 does not invent numbers.
- Reference videos are links in this phase. File upload arrives next.
- Overdue requests are listed from the stored reply deadline. The overdue email job is later.
- The channel row is created with the client. The conversation screen is later.

## Phone check

Install and open the app on a real Android phone, a real iPhone, and a desktop browser. Confirm the icon, the standalone window, the login staying signed in, the offline screen, and the update prompt. A Lighthouse installability check is useful on desktop. iPhone push is not part of this phase, and email is the fallback when it arrives.
