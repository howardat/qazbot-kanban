# Qazbot Kanban

Team kanban boards with email magic-link sign-in.

Stack: Next.js 15 (App Router) · TypeScript · Tailwind v4 · shadcn/ui (Radix) · Supabase Auth (magic link) · Supabase Postgres via Drizzle ORM · dnd-kit.

## Features

- **Dashboard** (`/`): your open cards, past-deadline and due-this-week lists, a two-week deadline strip,
  board progress and open cards per person
- **Boards**: drag cards and columns; mark a column as "done" so its cards stop counting as late
- **Cards**: multiple assignees, start date + deadline, per-board colored tags; filter a board by person or tag
- **Calendar** (`/calendar`): month view by deadline; drag a card to another day to reschedule
  (its start date moves with it), or from "No deadline" onto a day
- **Timeline** (`/timeline`): six-week Gantt view from start to deadline, grouped by board
- Calendar and timeline cover all boards, or one with `?board=<id>` (the board's view tabs link there)
- Magic-link sign-in restricted to an email allowlist (managed at `/admin`, linked as **Access**, admins only)

"Today" uses the team's time zone: `APP_TIMEZONE` (default `Asia/Almaty`).

## Access rules

1. The **first** person to sign in becomes admin and is added to the allowlist.
2. After that, only emails on the allowlist (or in `ALLOWED_DOMAIN`, if set) can sign in.
3. Removing an email revokes access on the user's next request.
4. Links are only emailed to allowed addresses; the form responds the same either way.

## Security model

All app data is read and written on the server through `DATABASE_URL` (Drizzle). Every table has
Row Level Security **enabled with no policies**, so Supabase's public Data API (publishable/anon key)
can't read or write anything. If you ever add browser-side Supabase queries, add RLS policies first.

## Local setup

Requires Docker running.

```bash
pnpm install
pnpm supabase:start               # local Supabase (Postgres :54322, API :54321, Studio :54323)
cp .env.example .env.local        # fill NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY from the start output
pnpm db:migrate
pnpm dev                          # http://localhost:3000
```

### Signing in locally

Sign-in is by **magic link** (no passwords). Locally, Supabase doesn't send real email: open
**Mailpit at http://127.0.0.1:54324** to see the link. The first person to sign in becomes admin.

## Deploy (Vercel + Supabase)

1. Create a Supabase project. Run migrations: `DATABASE_URL="<supabase pooler URL, transaction mode>" pnpm db:migrate`.
2. **Authentication → URL Configuration**: Site URL = your app URL; add `https://<your-domain>/auth/confirm` to Redirect URLs.
3. **Authentication → Emails → Magic Link** template: set the link to
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` (copy of `supabase/templates/magic_link.html`).
4. **Authentication → Emails → SMTP Settings**: configure a provider (Resend, Postmark, SES…). Supabase's built-in
   mailer only allows a few emails per hour and is meant for testing.
5. Vercel env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `DATABASE_URL` (optionally `ALLOWED_DOMAIN`).

Notes: Vercel Hobby is non-commercial only. Supabase free projects pause after 7 days of inactivity.

## Scripts

| Script | Purpose |
| --- | --- |
| `pnpm dev` | Dev server |
| `pnpm build` / `pnpm start` | Production build / server |
| `pnpm supabase:start` / `pnpm supabase:stop` | Local Supabase stack |
| `pnpm db:generate` | Generate a migration after editing `src/db/schema.ts` |
| `pnpm db:migrate` | Apply migrations |
| `pnpm db:studio` | Browse the database (or Supabase Studio at :54323) |
| `pnpm typecheck` / `pnpm lint` | Checks |
