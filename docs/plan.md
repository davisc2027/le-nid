# Strasbourg Mission Trip App: Plan (merged)

## Decisions (Davis)
PWA; Supabase + Vercel, must stay free; email magic-link sign-in; Sainte Bible libre pour le monde (eBible.org id frasbl, public domain, draft: have a French speaker proofread the verses used; convert USFM to JSON; replaces LSG 1910 everywhere below); translate = typed + mic via DeepL free tier. Cut order and timeline: no preference. Opt-in weekly leaderboard; leader core verse set + personal additions; Claude drafts lessons and an Opus agent reviews them internally; grading always lenient (accents/typos accepted).

## Stack (reuse, don't build)
- Supabase free: Postgres, Auth, Storage, pg_cron, Edge Functions. Starter: `npx create-next-app --example with-supabase`, deployed on Vercel.
- PWA + web push: Serwist + `web-push` (VAPID). Refs: magicbell-io/webpush-ios-template, arusak/rockstar-pwa-push.
- Lessons: mechanics from RikhiSingh/Duolingo-Clone (reference only; check licence; skip hearts/Stripe).
- Spaced repetition: `ts-fsrs` (MIT), shared `lib/srs.ts`.
- Scripture: LSG 1910 public-domain JSON seeded once. Drill ideas from Remember Me / Bible Skill Builder (reference only; likely copyleft).
- Translate: DeepL Free (500k chars/mo) via Edge Function, browser speech recognition + TTS (fr-FR); fallback link to Google Translate. Rate-limit per user.
- Admin: forms behind admin role; Supabase Studio as fallback.
- Caveat: free Supabase pauses after ~1 week of inactivity; add a scheduled ping.

## Architecture
Next.js PWA -> Supabase with RLS (roles admin/member). Storage for PDFs via signed URLs. Push: `push_subscriptions` + `send-push` Edge Function triggered by DB webhook on new announcement. Reminders: pg_cron daily 08:00 Paris; open todos due in 5/1/0 days -> push + Resend email backup; `reminder_log` prevents duplicates. Service worker caches itinerary, files, lesson packs for offline.

## Data model
profiles, announcements, push_subscriptions, itinerary_items, meetings(release_at), files(meeting_id, kind, release_at), todos, todo_assignments(status, upload_path), reminder_log.
French: lessons(unit, order), exercises(type mc|wordbank|translate|listen|match), vocab_items, user_progress, streaks(+freezes), xp_events.
Scripture (separate track): verses, verse_sets, verse_set_items. Shared: srs_cards(user_id, item_type vocab|verse, item_id, fsrs_state, due, ladder_stage).

## Conversational track (Duolingo mechanics)
Linear unit/lesson tree with unlocks; 5 exercise types (no speaking in MVP); wrong answers repeat at end; 10 XP/lesson; daily streak in user's timezone, 1 freeze/week; 7pm nudge push; typo/accent-tolerant grading (edit distance <= 1); no hearts.

## Scripture track (Bible-memory mechanics)
Ladder per verse: read+listen -> reveal word by word -> cloze 30% then 60% -> first-letter hints -> reorder chunks -> type from memory with word diff. Pass full recall = Good, with hints = Hard (FSRS). Leader core set + personal verses; English shown alongside.

## Milestones
- M0 setup (1-2 evenings): Supabase, starter, Vercel, auth, roles, manifest.
- M1 core MVP (~1 wk, before first prep meeting): announcements + push, itinerary, files by meeting with timed release, admin forms, install/push onboarding page.
- M2 todos + reminders (3-4 days): assignments, uploads (private bucket), cron, admin completion view.
- M3 conversational French (~9 days): lesson player, 5 exercises, XP/streaks, FSRS practice, ~10 units seed.
- M4 scripture French (~1 wk): LSG seed, ladder, review queue, verse sets.
- M5 translate (~2 days).
- Stretch: trip-config table, CSV import, offline phrasebook.
- Cut order if needed (suggested): leaderboard, reference drill, streak freezes, listening, then translate.

## Risks
iOS push needs Home Screen install (onboarding + in-person install session + email backup); content authoring effort (keep ~10 units, 20-30 verses, native proofread); hotel Wi-Fi (offline cache, translate needs internet); passport copies (private bucket, admin-only, delete after trip); free-tier limits; solo developer timeline.
