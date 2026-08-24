# Hikoya

A platform for reading and publishing serialized stories in Russian and
Uzbek. First chapters are open to guests; continuing, bookmarking,
commenting, and publishing require an account.

Built with **Next.js 16** (App Router, TypeScript, Tailwind CSS v4) and
**Supabase** (Postgres, Auth, Storage) via `@supabase/ssr` — no ORM.

## Status

The app runs today against a **placeholder** Supabase project (see
`.env.local`), so every page renders its guest/empty state, but nothing is
persisted and sign-in doesn't work yet. Follow the setup below to connect a
real backend.

## 1. Create a Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Copy **Project Settings → API**: Project URL, `anon` public key, and
   `service_role` secret key into `.env.local` (copy `.env.local.example`
   first if you haven't).
3. Install the [Supabase CLI](https://supabase.com/docs/guides/cli) and link
   it:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   ```
4. Apply the schema (tables, RLS policies, storage buckets, seed tags/achievements):
   ```bash
   npx supabase db push
   ```
   This runs everything in `supabase/migrations/` in order. Review
   `0001_schema.sql` through `0007_view_counts.sql` — they're plain,
   readable SQL — before pushing to a real project.

## 2. Enable auth providers

**Google** — Supabase Dashboard → Authentication → Providers → Google.
Create an OAuth client in
[Google Cloud Console](https://console.cloud.google.com/apis/credentials)
(Web application), and set the Supabase-provided redirect URI there. No
extra env vars needed beyond the Supabase ones above — the app calls
`supabase.auth.signInWithOAuth`.

**Email** — enabled by default in Supabase Auth (magic link, no password).
Nothing to configure.

**Telegram** — Supabase has no built-in Telegram provider, so this app
bridges it itself (`src/app/auth/telegram/route.ts` + the Telegram Login
Widget in `src/components/auth/AuthButtons.tsx`):
1. Create a bot with [@BotFather](https://t.me/BotFather) (`/newbot`).
2. Run `/setdomain` in BotFather and point it at this app's domain
   (`localhost` won't work for the widget — use a tunnel like ngrok for
   local testing, or test this piece after deploying).
3. Set `TELEGRAM_BOT_TOKEN` (from BotFather) and
   `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` (without the `@`) in `.env.local`.

Until Telegram is configured, its button just shows "Telegram скоро" —
nothing breaks.

## 3. Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Project structure

```
src/app/(site)/        Reader + author-facing pages (Home, Search, Story,
                        Reader, Create, Manage, Author, Library, Collections,
                        Board) — shares the Header/Sidebar shell
src/app/admin/          Staff-only panel (Dashboard, Users, Stories,
                        Reports, Settings) — separate layout, gated by role
src/app/onboarding/      3-step signup/personalization wizard
src/app/auth/            OAuth callback, Telegram bridge, sign-out
src/lib/supabase/        Browser/server/admin Supabase clients
src/lib/queries/         Read-only data access, one file per domain
src/lib/actions/         Server Actions (mutations)
src/lib/i18n/            RU/UZ dictionaries + locale provider
supabase/migrations/     Schema, RLS policies, storage buckets, seed data
```

## Guest chapter gating

`platform_settings.guest_free_chapters` (editable at `/admin/settings`, 1–4)
controls how many of a story's earliest chapters render in full for
anonymous visitors. It's enforced **server-side** in
`src/app/(site)/story/[slug]/[chapter]/page.tsx`, not just hidden with CSS.

## What's not done yet

- Real end-to-end auth testing (needs the Supabase project above)
- Deployment to Vercel
- Redis/Meilisearch (only worth adding once traffic justifies them, per the
  original tech-stack notes)
- Deep responsive/mobile pass — the layout is solid at desktop widths;
  narrow-viewport polish is a follow-up
