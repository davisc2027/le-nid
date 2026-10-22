# Le Nid

Companion PWA for the Strasbourg mission trip: announcements with push, itinerary, and files released after prep meetings. Product plan: `docs/plan.md`. Design plan: `docs/design.md`.

Stack: Next.js (App Router) + Tailwind, Supabase (Postgres, Auth, Storage), `web-push`, hosted on Vercel. Everything is free-tier. No machine-specific setup; all state lives in Supabase and git.

## Setup (any computer)
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
M2 to-dos and reminders, M3 conversational French, M4 scripture French, M5 translate. See `docs/plan.md`.
