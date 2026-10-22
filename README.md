# Le Nid

Companion PWA for the Strasbourg mission trip: announcements with push, itinerary, files released after prep meetings, to-dos with reminders, French lessons, scripture memory, live translation, and a group goal. Setup steps: `SETUP.md`. Product plan: `docs/plan.md`. Design plan: `docs/design.md`.

Stack: Next.js (App Router) + Tailwind, Supabase (Postgres, Auth, Storage), `web-push`, hosted on Vercel. Everything is free-tier. No machine-specific setup; all state lives in Supabase and git.

## Quick start (see SETUP.md for the full checklist)
1. `npm install`
2. Create a free Supabase project. Run `supabase/migrations/*.sql` in order in the SQL editor (or `npx supabase link` then `npx supabase db push`).
3. Supabase dashboard -> Authentication -> URL Configuration: set Site URL to your deployed URL and add `<url>/auth/callback` (and `http://localhost:3000/auth/callback`) to Redirect URLs.
4. `cp .env.example .env.local` and fill in the Supabase keys. Generate push keys with `npx web-push generate-vapid-keys`.
5. `npm run dev`, sign in with your email, then make yourself admin in the SQL editor:
   `update profiles set role = 'admin' where email = 'you@example.com';`
   Repeat for your co-leader.

## Deploy
Import the repo into Vercel and add the same env vars from `.env.example`. Push to `main` to deploy.

## Notes
- iPhone push only works after "Add to Home Screen" and opening the app from there.
- Free Supabase projects pause after about a week of inactivity; unpause from the dashboard.
- Members only see files whose `release_at` has passed (enforced by RLS, not the UI).
- Placeholder icons are generated in `app/icons/[size]/route.tsx` and `app/apple-icon.tsx`; replace with real art later.
- Next.js 16 here differs from older versions; see `AGENTS.md` and `node_modules/next/dist/docs/`.

## Roadmap
M4 scripture French, M5 translate. See `docs/plan.md`.

## Reminders
`vercel.json` runs `/api/cron/reminders` daily at 07:00 UTC (08:00-09:00 Paris). Set `CRON_SECRET` in Vercel. Reminders go out 5, 1, and 0 days before a to-do's due date to people who haven't finished it; `reminder_log` prevents repeats. Run `0002_todos.sql` after `0001_core.sql`. Test locally: `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/reminders`.

## French lessons
Content is plain data in `content/french/units.json` (phrases only; exercises are generated from them in `lib/french/exercises.ts`). Add a phrase or lesson there; no code change needed. Progress, XP and streaks live in Supabase (`0003_french.sql`); streaks are written only by the `complete_lesson()` function. Audio uses the device's built-in `fr-FR` voice. Odile's lines are in `lib/odile.ts` (lines marked `sass` are hidden in gentle mode).

## Scripture track
Run `0004_scripture.sql`. Verse text is static JSON generated once from eBible.org: `node scripts/build-bible.mjs` writes `public/bible/fr` (Sainte Bible libre pour le monde, public domain, still a draft: proofread the verses you use) and `public/bible/en` (World English Bible). Commit the output. Run it on any machine that can reach ebible.org. Leaders publish verse sets from the Admin page; members add any verse by reference (e.g. "Jean 3:16-17"). Review scheduling uses FSRS (`ts-fsrs`). Scripture and French share one XP total and streak.

## Translate
A floating Translate button opens `/translate`: type or speak (browser speech recognition, English or French), get DeepL's translation, hear it, or show it full screen to the other person. Needs `DEEPL_API_KEY` (free plan) and internet. Limits: 500 characters per request and 120 requests per person per hour (in-memory, per server instance). If it fails, the page links to Google Translate. Speech input depends on the browser: Safari on iPhone supports it, but it may not work from an installed Home Screen app, so typing is the fallback.
