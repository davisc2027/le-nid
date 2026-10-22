# Le Nid

Companion PWA for the Strasbourg mission trip: announcements with push, itinerary, files released after prep meetings, to-dos with reminders, French lessons, scripture memory, live translation, and a group goal. Setup steps: `SETUP.md`. Product plan: `docs/plan.md`. Design plan: `docs/design.md`.

Stack: Next.js (App Router) + Tailwind, Supabase (Postgres, Auth, Storage), `web-push`, hosted on Vercel. Everything is free-tier. No machine-specific setup; all state lives in Supabase and git.

## Quick start (see SETUP.md for the full checklist)
1. `npm install`
2. Create a free Supabase project. Run `supabase/migrations/0001` through `0009` (0009 adds the French Practice and end-of-lesson review) in order in the SQL editor (or `npx supabase link` then `npx supabase db push`).
3. Supabase dashboard -> Authentication -> URL Configuration: set Site URL to your deployed URL and add `<url>/auth/callback` (and `http://localhost:3000/auth/callback`) to Redirect URLs.
4. `cp .env.example .env.local` and fill it in (variables are listed in SETUP.md section 2). Generate push keys with `npx web-push generate-vapid-keys`. Never commit `vercel-env.txt` or any env file.
5. `npm run dev`, sign in with your email, then make yourself admin in the SQL editor:
   `update profiles set role = 'admin' where email in ('you@example.com', 'coleader@example.com');`
6. Sign-up is restricted to an allowlist: add every trip member's email on the Admin page before they sign in.

## Deploy
Import the repo into Vercel and add the same env vars from `.env.example`. Push to `main` to deploy. Follow SETUP.md for email templates (Confirm signup and Magic Link), custom SMTP and the iPhone checklist.

## Notes
- iPhone push only works after "Add to Home Screen" and opening the app from there.
- Free Supabase projects pause after about a week of inactivity; unpause from the dashboard.
- Members only see files whose `release_at` has passed (enforced by RLS, not the UI).
- Placeholder icons are generated in `app/icons/[size]/route.tsx` and `app/apple-icon.tsx`; replace with real art later.
- Next.js 16 here differs from older versions; see `AGENTS.md` and `node_modules/next/dist/docs/`.

## Reminders
`vercel.json` runs `/api/cron/reminders` daily at 07:00 UTC (08:00-09:00 Paris). Set `CRON_SECRET` in Vercel. Reminders go out 5, 1, and 0 days before a to-do's due date to people who haven't finished it; `reminder_log` prevents repeats. Reminders are push notifications only. The only email is one weekly summary on Mondays (Paris time) with each person's overdue and next-7-days to-dos, sent through Resend if `RESEND_API_KEY` and `EMAIL_FROM` are set (about 35 emails a week, far under Resend's free limit). Test locally: `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/reminders`.

## French lessons
Content is plain data in `content/french/units.json` (phrases only; exercises are generated from them in `lib/french/exercises.ts`). Add a phrase or lesson there; no code change needed. Progress, XP and streaks live in Supabase (`0003_french.sql`); streaks are written only by the `complete_lesson()` function. Audio uses the device's built-in `fr-FR` voice. Odile's lines are in `lib/odile.ts` (lines marked `sass` are hidden in gentle mode).

## Scripture track
Verse text is static JSON generated once from eBible.org: `node scripts/build-bible.mjs` writes `public/bible/fr` (Sainte Bible libre pour le monde, public domain, still a draft: proofread the verses you use) and `public/bible/en` (World English Bible). Commit the output. Run it on any machine that can reach ebible.org. Leaders publish verse sets from the Admin page; members add any verse by reference (e.g. "Jean 3:16-17"). Review scheduling uses FSRS (`ts-fsrs`). Scripture and French share one XP total and streak.

## Translate
The Translate tab in the bottom nav opens `/translate`: type or speak (browser speech recognition, English or French), get DeepL's translation, hear it, or show it full screen to the other person. Needs `DEEPL_API_KEY` (free plan) and internet. Limits: 500 characters per request and 40 requests per person per hour (in-memory, per server instance). If it fails, the page links to Google Translate. Speech input depends on the browser: Safari on iPhone supports it, but it may not work from an installed Home Screen app, so typing is the fallback.

### Conversation mode
`/translate/talk` (the big "Conversation mode" card on the Translate page) is a live two-way interpreter: put the phone between two people, tap Start listening, and take turns. Each sentence becomes a bubble with the translation large and the speaker's own words small beneath. Layouts: chat thread (default) or side by side (French left, English right). Text size, layout and the Read aloud switch (off by default; speaks French translations with the phone's voice) are remembered on the device.

- **How it works.** The page records one clip per sentence (voice-activity detection: starts when someone talks, ends after about 0.9 s of silence, skips clips under about 0.6 s or too quiet, caps at 25 s). `/api/stt` (signed-in, approved users only) sends the clip to Groq's hosted Whisper (`whisper-large-v3-turbo`, language auto-detected) and drops Whisper's usual silence inventions ("Thank you.", "Merci.", "Sous-titres réalisés par..."). French is translated to English and everything else to French through the existing `/api/translate` (DeepL). Sentences are processed in order.
- **What leaves the phone.** Audio goes to Groq (speech to text) and the text to DeepL (translation), both through Le Nid's server. Le Nid keeps no recordings or transcripts; nothing is written to the database or logs. The page shows a small "AI audio processing used" line.
- **Needs** `GROQ_API_KEY` (free, console.groq.com) in addition to `DEEPL_API_KEY`. See SETUP.md section 3a.
- **Limits.** One Groq key is shared by the whole group: about 20 requests per minute and 8 hours of audio per day in total. Per person: 30 sentences per minute, 300 per hour, and each sentence also counts toward the Translate limit (40 per hour). In-memory, per server instance.
- **Safari backup.** If Groq is full, failing, or not set up, the page switches to Safari's own speech recognition (tap English or Français for whoever is speaking). That only works in Safari, so in the Home Screen app it offers "Copy Safari link": a single-use sign-in link (`/api/handoff` -> `/auth/handoff`) that opens Conversation mode in Safari signed in as the same person. It works once, expires with Supabase's email-link expiry, and should not be shared. "Having trouble? Use the Safari backup" opens it any time.
- **Development demo.** `npm run dev`, then `/translate/talk?demo=1` plays a scripted conversation without a microphone, Groq or DeepL (`&fail=rate_limited`, `&standalone=1` and `&mode=safari` show the fallback states). Disabled in production builds.
