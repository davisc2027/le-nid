# Launch checklist (owner side)

Everything here is something only the project owner can do: dashboard settings, SQL, environment variables, content reviews and tests on real phones. It consolidates section 4 of `docs/audit-trip-readiness.md`, the "Owner-side settings" and "Could not verify" sections of `docs/audit-security.md`, and the owner items from `docs/audit-reliability.md`. Tick each box as you go. Setup details are in `SETUP.md`; the migration list is in `README.md`.

## 1. Supabase: database
- [ ] Run **every file in `supabase/migrations`, in order** (0001-0019 and any newer, such as the security hardening migration from the security audit). Each is safe to re-run. **0010 contains security fixes: do not skip it.**
- [ ] Confirm they all applied. Missing ones fail quietly (messages like "Run migration 0019 first" in Admin; some code paths fail open). Check with `select proname from pg_proc where proname in ('my_stats','admin_push_status','poll_results');` and `select column_name from information_schema.columns where table_name in ('todos','itinerary_items') and column_name in ('retired_at','everyone','tz','updated_at');`. The Learn page uses `my_stats()` (0010) and falls back to slower queries without it.
- [ ] Make leaders admins: `update profiles set role = 'admin' where email in (...)`.
- [ ] Note the project region and write it in your privacy note (EU for passport or health data; moving later means a new project).
- [ ] Database > Advisors (Security and Performance): re-run after any change; no "RLS disabled", "security definer view" or "function search_path mutable" warnings.
- [ ] Storage: both buckets are **private**. Apply the file size and type limits from the security audit (M4: 10 MB, jpeg/png/heic/webp/pdf for `todo-uploads`). Look for objects outside `<uid>/` and orphaned uploads (H1 in the security audit).
- [ ] Backups: free plan keeps daily backups for 7 days, which also keep "deleted" passports until they age out.
- [ ] Few people have dashboard access, all with 2FA.
- [ ] If the service_role key was ever pasted into chat, a screenshot or a shared script, rotate it.

## 2. Supabase: Authentication
- [ ] Custom SMTP (a dedicated sender mailbox with 2FA, not a leader's personal Gmail). Test with a real Gmail, iCloud and Outlook address.
- [ ] Raise the emails-per-hour limit (Auth > Rate Limits) before sign-up day and test a many-person sign-up; default is about 30 per hour. Keep `signInCode` in Admin handy as the escape hatch.
- [ ] Email templates: both **Confirm signup** and **Magic Link** contain `{{ .Token }}`; OTP length 8.
- [ ] Email OTP expiration 600-900 s. Confirm email on.
- [ ] CAPTCHA (Attack Protection) on, if you adopt the fix in the security audit (M3).
- [ ] URL Configuration: Site URL is the production URL only; Redirect URLs list only `https://<prod>/auth/callback` (remove stale preview and localhost entries before the trip).
- [ ] JWT: expiry 3600 s is fine; signing keys asymmetric so `getClaims()` verifies locally. Consider a longer session lifetime so people stay signed in abroad.
- [ ] Free projects pause after about a week of inactivity. The daily cron keeps it awake only if it succeeds (see Vercel below).

## 3. Vercel and environment variables
Set in Vercel > Project Settings > Environment Variables and mirror in `.env.local`. Mark secrets **Sensitive** and scope them to **Production** unless previews truly need them.
- [ ] `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:`)
- [ ] `CRON_SECRET` (32+ random characters; both crons use it, the routes return 401 without it)
- [ ] `GROQ_API_KEY` (speech to text and translate fallback), `DEEPL_API_KEY` (optional), `DEEPL_GLOSSARY_EN_FR` / `DEEPL_GLOSSARY_FR_EN` (after the glossary review)
- [ ] `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` for the weekly email, or `RESEND_API_KEY`
- [ ] Function region close to the Supabase region (Project Settings > Functions)
- [ ] Cron Jobs: both listed and returning 200 in the logs (reminders at 14:00 UTC, streaks at 17:00 UTC). A failed cron will not keep Supabase awake. Test by hand: `curl -H "Authorization: Bearer $CRON_SECRET" https://<prod>/api/cron/reminders`.
- [ ] Git Fork Protection on; Deployment Protection (Vercel Authentication) on for previews; no log drain ships request URLs (hand-off tokens) to third parties.
- [ ] 2FA on the Vercel and GitHub accounts; GitHub secret scanning, push protection and Dependabot on.
- [ ] Note: Vercel Hobby is for non-commercial use; a church trip app is probably fine.

## 4. Content reviews (native French speaker; pastor for faith content)
- [ ] `docs/curriculum-review-list.md`: 20 simplified phrases, the faith unit and conversation skills.
- [ ] Culture cards and Joshua Project cards in `content/french/culture.json` (source check against `docs/joshua-project-culture.md`).
- [ ] `content/talk/glossary.json` (all entries are `reviewed: false`); then `DEEPL_API_KEY=... node scripts/sync-deepl-glossary.mjs` and put the printed ids in Vercel (redeploy).
- [ ] Three Circles French: Admin > Content > Three Circles, mark reviewed (removes the "Draft French" note).
- [ ] Bible text: `public/bible/fr` and `/en` committed and spot-checked (John 3:16, Psalm 23:1, Romans 8:38-39); `node scripts/check-verses.mjs`.

## 5. Real-iPhone tests (2-3 phones: one older iOS, one cellular-only)
- [ ] Install to Home Screen, sign in inside the app, push arrives, lesson audio with the silent switch on, Translate typing and dictation, Conversation mode in the installed app, the Safari backup link, bottom nav over the home bar, light and dark mode.
- [ ] Sign out and back in; deny notifications then re-enable; two accounts on one phone; a very slow connection (the saved itinerary, to-dos and Home should appear after about 4 seconds); airplane mode after opening each page once online; check the "Larger text" setting.
- [ ] Open the Itinerary, To-dos, Files and Home pages online once after install so they work offline. Files themselves need a connection.

## 6. Before inviting people
- [ ] Pre-approve the emails (Admin > Pre-approved emails), post a welcome announcement, add the itinerary, to-dos, a verse set and a first poll.
- [ ] Decide whether to reset XP earned during testing (`delete from xp_events where ...`) before the goal starts.
- [ ] Replace the placeholder icons with real art (`app/icons/[size]/route.tsx`, `app/apple-icon.tsx`).
- [ ] Privacy note: what is collected, who sees passports (leaders only), providers used (Groq, DeepL, Gmail or Resend, push services), deletion dates, who to contact. Link it from `/login` and `/me`. Delete passport uploads by the date you set (suggested 30 April 2027).
- [ ] Time behaviour to tell leaders: reminders run at 14:00 UTC; "Overdue" is judged on the Paris date; the weekly leaderboard rolls over Monday 00:00 Paris (Sunday evening in Texas); streak days follow each phone's local date.

## 7. Operational (non-code; see `docs/admin-and-leader-ideas.md` section 9)
- [ ] Name the trip lead, tech contact, safeguarding lead and who holds medical information.
- [ ] Decide the data policy and retention date, and whether anyone is under 18.
- [ ] Ask the insurer or church about waiver wording and whether health information may be stored digitally.
- [ ] Printed emergency card and leader binder; an official fallback chat; eSIM decision (the app has no emergency-contacts page yet).
- [ ] Calendar: forms 8 weeks out, passports verified 12 weeks out, weekly manual backup, clean-up 30 days after return.

## 8. Still unverified (needs dashboards or a live test)
- [ ] Whether Supabase Storage serves uploaded HTML or SVG inline on signed URLs.
- [ ] Whether `auth.admin.deleteUser` is blocked by storage object owner references.
- [ ] Supabase Auth rate limits, OTP expiry, CAPTCHA status and the SMTP provider actually in use.
- [ ] Vercel HSTS header, env var scoping, fork and preview protection, whether logs keep query strings.
- [ ] DeepL Free and Groq data-retention terms.
- [ ] That all migrations are applied to the live database.
