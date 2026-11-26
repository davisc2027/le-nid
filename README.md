# Le Nid

Companion PWA for the Strasbourg mission trip: announcements with push, itinerary, files released after prep meetings, to-dos with reminders, French lessons, scripture memory, live translation, and a group goal. Setup steps: `SETUP.md`. Before launch, work through `docs/launch-checklist.md` (owner-side tasks). Product plan: `docs/plan.md`. Design plan: `docs/design.md`. Audits: `docs/audit-trip-readiness.md`, `docs/audit-security.md`, `docs/audit-reliability.md`.

Stack: Next.js (App Router) + Tailwind, Supabase (Postgres, Auth, Storage), `web-push`, hosted on Vercel. Everything is free-tier. No machine-specific setup; all state lives in Supabase and git.

## Quick start (see SETUP.md for the full checklist)
1. `npm install`
2. Create a free Supabase project. Run **every file in `supabase/migrations` (0001-0019 and any newer), in order**, in the SQL editor (or `npx supabase link` then `npx supabase db push`). `0010` contains security fixes; see the migrations table below.
3. Supabase dashboard -> Authentication -> URL Configuration: set Site URL to your deployed URL and add `<url>/auth/callback` (and `http://localhost:3000/auth/callback`) to Redirect URLs.
4. `cp .env.example .env.local` and fill it in (variables are listed in SETUP.md section 2). Generate push keys with `npx web-push generate-vapid-keys`. Never commit `vercel-env.txt` or any env file.
5. `npm run dev`, sign in with your email, then make yourself admin in the SQL editor:
   `update profiles set role = 'admin' where email in ('you@example.com', 'coleader@example.com');`
6. Sign-up is restricted to an allowlist: add every trip member's email on the Admin page before they sign in.

## Migrations (0001-0019)
| File | Purpose |
| --- | --- |
| `0001_core.sql` | Core schema: profiles, announcements, push subscriptions, itinerary, meetings, files. |
| `0002_todos.sql` | To-dos with deadlines, per-person assignments, uploads and the reminder log. |
| `0003_french.sql` | French lesson progress, XP events and streaks (`award_xp`, `complete_lesson`). |
| `0004_scripture.sql` | Verse sets and per-person review cards for scripture memory. |
| `0005_together.sql` | Teams, opt-in weekly leaderboard and the trip-wide group goal. |
| `0006_profile_trigger_fix.sql` | Makes profile creation resilient so sign-up never fails on it. |
| `0007_hardening.sql` | Sign-up allowlist, private emails, column-level write grants, XP caps, push claim, auto-assigned to-dos. |
| `0008_access_requests.sql` | Accounts wait as `pending` until an admin approves them; `allowed_emails` becomes the pre-approved list. |
| `0009_vocab_cards.sql` | Spaced-repetition cards for French phrases (end-of-lesson review and Practice). |
| `0010_access_gaps.sql` | **Security fixes** (approved-only XP and lessons, admin status changes, push endpoint validation, profile self-insert limits) plus `my_stats()`, `pending_count()` and the daily usage budgets. Not optional. |
| `0011_verse_progress.sql` | Saves the verse mastery path position so it resumes on any device. |
| `0012_delete_users.sql` | Lets an admin delete a person; their announcements stay, with no author. |
| `0013_todo_audience.sql` | To-dos for everyone or for specific people. |
| `0014_polls.sql` | Polls with options, votes, tallies and the admin voter list. |
| `0015_linter_cleanup.sql` | Supabase linter fixes: fixed search paths, closed anon grants, foreign-key indexes. |
| `0016_itinerary_tz.sql` | Per-item time zone (Texas or Strasbourg) and the "Updated" tag on itinerary items. |
| `0017_app_content.sql` | Admin-editable wording for built-in resources (Three Circles) with a "reviewed" flag. |
| `0018_todo_retired.sql` | Admins can retire a to-do without deleting anyone's progress. |
| `0019_push_status.sql` | Admin list of who has notifications on (never the endpoints or keys). |

Recommended order: run **every file in `supabase/migrations` once, in numeric order**, before inviting anyone (each is safe to re-run). Do not skip 0010: it contains security fixes. The app still opens when a later migration is missing (it shows messages such as "Run migration 0019 first"), but a missing one hides features and weakens protections. Files numbered 0020 and up (for example the security hardening migration from `docs/audit-security.md`) follow the same rule.

## Deploy
Import the repo into Vercel and add the same env vars from `.env.example`. Push to `main` to deploy. Follow SETUP.md for email templates (Confirm signup and Magic Link), custom SMTP and the iPhone checklist.

## Notes
- iPhone push only works after "Add to Home Screen" and opening the app from there.
- Free Supabase projects pause after about a week of inactivity; unpause from the dashboard.
- Members only see files whose `release_at` has passed (enforced by RLS, not the UI).
- Placeholder icons are generated in `app/icons/[size]/route.tsx` and `app/apple-icon.tsx`; replace with real art later.
- Next.js 16 here differs from older versions; see `AGENTS.md` and `node_modules/next/dist/docs/`.

## Reminders
`vercel.json` runs `/api/cron/reminders` daily at 14:00 UTC (08:00-09:00 in Texas, 15:00-16:00 in Paris; Vercel Hobby may fire it up to an hour late). The streak nudge cron runs at 17:00 UTC (11:00-12:00 Texas, 18:00-19:00 Paris, an evening reminder on the trip). Both times are UTC, so they do not move at daylight-saving changes. Set `CRON_SECRET` in Vercel. Reminders go out 5, 1, and 0 days before a to-do's due date to people who haven't finished it; `reminder_log` prevents repeats. Reminders are push notifications only. The only email is one weekly summary on Mondays (Paris time) with each person's overdue and next-7-days to-dos, sent through the same SMTP mailbox as the sign-in codes when `SMTP_USER` and `SMTP_PASS` are set (about 35 emails a week; Gmail allows about 500 a day), or through Resend if only `RESEND_API_KEY` is set. "Overdue" in the to-do list is judged on the Paris calendar date for everyone (the reminders use the same date), so a Texas student can see "Overdue" on the evening of the due date; leaders should treat the due date as Paris time. Streak days use the date on the student's own device.

Test locally: `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/reminders`.

## French lessons
Content is plain data in `content/french/units.json` (phrases only; exercises are generated from them in `lib/french/exercises.ts`). Add a phrase or lesson there; no code change needed. Progress, XP and streaks live in Supabase (`0003_french.sql`); streaks are written only by the `complete_lesson()` function. Audio uses the device's built-in `fr-FR` voice. Odile's lines are in `lib/odile.ts` (lines marked `sass` are hidden in gentle mode).

## Scripture track
Verse text is static JSON generated once from eBible.org: `node scripts/build-bible.mjs` writes `public/bible/fr` (Sainte Bible libre pour le monde, public domain, still a draft: proofread the verses you use) and `public/bible/en` (World English Bible). Commit the output. Run it on any machine that can reach ebible.org. Leaders publish verse sets from the Admin page; members add any verse by reference (e.g. "Jean 3:16-17"). Review scheduling uses FSRS (`ts-fsrs`). Scripture and French share one XP total and streak.

## Translate
The Translate tab in the bottom nav opens `/translate`: type or speak (browser speech recognition, English or French), get the translation (DeepL when a key is set, otherwise Groq language models), hear it, or show it full screen to the other person. Needs `DEEPL_API_KEY` (free plan) and internet. Limits: 500 characters per request and 120 requests per person per hour (in-memory, per server instance), plus 15,000 characters per person per day (Postgres). If it fails, the page links to Google Translate. Speech input depends on the browser: Safari on iPhone supports it, but it may not work from an installed Home Screen app, so typing is the fallback.

### Conversation mode
`/translate/talk` (the big "Conversation mode" card on the Translate page) is a live two-way interpreter: put the phone between two people, tap Start listening, and take turns. Each sentence becomes a bubble with the translation large and the speaker's own words small beneath. Layouts: chat thread (default) or side by side (French left, English right). Text size, layout and the Read aloud switch (off by default; speaks French translations with the phone's voice) are remembered on the device.

- **How it works.** The page records one clip per sentence (voice-activity detection: a 0.6 s pre-roll so the first word is not clipped, ends after about 0.7-1.1 s of silence depending on sentence length, skips clips under about 0.6 s or too quiet, soft cap 12 s, hard cap 20 s; sent as 16 kHz WAV, or the browser recorder where AudioWorklet is missing). `/api/stt` (signed-in, approved users only) sends the clip to Groq's hosted Whisper (`whisper-large-v3-turbo` unless `STT_MODEL` says otherwise; language auto-detected, checked against the text, and retried once with the language forced when Whisper names something other than English or French). Segments Whisper itself doubts are dropped, and its usual silence inventions ("Thank you.", "Sous-titres réalisés par...") are filtered; a real "Oui" or "Merci" is kept. French is translated to English and everything else to French through `/api/translate` (DeepL with the source language, the previous turns as context, always the polite *vous*, and the team glossary; Groq models as fallback). Exact course phrases use the curated translation. Sentences are processed in order.
- **What leaves the phone.** Audio goes to Groq (speech to text) and the text to DeepL (translation), both through Le Nid's server. Le Nid keeps no recordings or transcripts; nothing is written to the database or logs. The page shows a small "AI audio processing used" line.
- **Needs** `GROQ_API_KEY` (free, console.groq.com) in addition to `DEEPL_API_KEY`. See SETUP.md section 3a.
- **Limits.** One Groq key is shared by the whole group: about 20 requests per minute and 8 hours of audio per day in total. Per person: 30 sentences per minute, 120 per hour, 120 per day (the one forced-language retry counts toward the minute, hour and group limits but not the daily number), and each sentence also counts toward the Translate limit (120 per hour, 15,000 characters per day). In-memory, per server instance, except the daily numbers.
- **Safari backup.** If Groq is full, failing, or not set up, the page switches to Safari's own speech recognition (tap English or Français for whoever is speaking). That only works in Safari, so in the Home Screen app it offers "Copy Safari link": a single-use sign-in link (`/api/handoff` -> `/auth/handoff`) that opens Conversation mode in Safari signed in as the same person. It works once, expires with Supabase's email-link expiry, and should not be shared. "Having trouble? Use the Safari backup" opens it any time.
- **Fixing mistakes.** Tap a bubble: Edit text, Wrong language (listens again with the language forced while the last 5 clips are still in memory, otherwise swaps the side), Check meaning (back-translation), Translate again, Read aloud, Delete (with Undo). A "May be off" chip appears when the translation looks wrong (lost "not", changed number, wrong language).
- **Noisy place.** The switch above the buttons replaces automatic language detection with two buttons: tap English or Français, then say one sentence. Le Nid sends the language to Whisper, so it cannot mix them up. The choice is remembered on the device.
- **Diagnostics (hidden).** Tap the title "Conversation" five times, or open `/translate/talk?diag=1`. Shows per-sentence language, confidence, retries, clip length and latency; has switches for every new behaviour, a Whisper model switch (turbo / large-v3), and a JSON export. Stays on the phone; no audio unless "Keep audio clips" is switched on.
- **Glossary.** `content/talk/glossary.json` (faith terms and names, marked for a French speaker's review). Run `node scripts/sync-deepl-glossary.mjs` and put the printed ids in `DEEPL_GLOSSARY_EN_FR` / `DEEPL_GLOSSARY_FR_EN`. See SETUP.md.
- **Checks.** `node --experimental-strip-types scripts/check-talk.mjs` runs the pure-logic tests (language check, segment filter, WAV, pre-roll, pause rules, phrasebook, cache, glossary).
- **Development demo.** `npm run dev`, then `/translate/talk?demo=1` plays a scripted conversation without a microphone, Groq or DeepL (`&fail=rate_limited`, `&standalone=1` and `&mode=safari` show the fallback states). Disabled in production builds.

## Checks and CI
`npm run typecheck` (generates route types, then `tsc --noEmit`), `npm run lint`, `npm test` (unit tests plus the quick content checks; `check-curriculum` runs with its fast sampling argument `1`, the full run takes over 10 minutes: `node scripts/check-curriculum.mjs`) and `npm run build`. `.github/workflows/ci.yml` runs all four on every push and pull request with dummy Supabase variables (no secrets needed).
