# Launch checklist (owner side)

Everything here is something only the project owner can do: dashboard settings, SQL, environment variables, content reviews and tests on real phones. It consolidates section 4 of `docs/audit-trip-readiness.md`, the "Owner-side settings" and "Could not verify" sections of `docs/audit-security.md`, and the owner items from `docs/audit-reliability.md`. Tick each box as you go. Setup details are in `SETUP.md`; the migration list is in `README.md`.

## 1. Supabase: database
- [ ] Run **every file in `supabase/migrations`, in order** (0001-0021 and any newer). Each is safe to re-run. **0010 contains security fixes: do not skip it.**
- [ ] Confirm they all applied. Missing ones fail quietly (messages like "Run migration 0019 first" in Admin; some code paths fail open). Check with `select proname from pg_proc where proname in ('my_stats','admin_push_status','poll_results');` and `select column_name from information_schema.columns where table_name in ('todos','itinerary_items') and column_name in ('retired_at','everyone','tz','updated_at');`. The Learn page uses `my_stats()` (0010) and falls back to slower queries without it.
- [ ] Make leaders admins: `update profiles set role = 'admin' where email in (...)`.
- [ ] Note the project region (Project Settings > General) and write it in the privacy notice (Admin > Settings > Privacy notice, the `[REGION]` placeholder). EU for passport or health data; moving later means a new project.
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
- [ ] Privacy notice (built in, `/privacy`; everyone sees a one-time consent screen after migration 0021). Admin > Settings > Privacy notice: replace every `[bracketed]` placeholder (the editor lists what is left): **region** (Supabase project region), **email provider** (Gmail SMTP or Resend), **deletion date** (30 days after we return; write the real date), **contact** (a leader's name and phone or email). Read the whole page once as a student would. The sign-in page does not link to it (the notice needs a sign-in to load); it is on Me and on the consent screen.
- [ ] Admin > Settings > Emergency info: fill in **leader names and phone numbers** (Label | role | phone), the **lodging address and map link**, the **meeting point**, the embassy or consulate, the insurance 24-hour line and policy number, and the group-chat fallback under Notes. Replace every "Ask your leader" line. Then check it as a student: open `/emergency`, turn on airplane mode, reload (it must still show the numbers; open it once online first).
- [ ] Ask everyone to add their emergency contact on Me (optional medical notes). Check Admin > Overview > Needs attention for "No emergency contact" and "Privacy not accepted".
- [ ] Time behaviour to tell leaders: reminders run at 14:00 UTC; "Overdue" is judged on the Paris date; the weekly leaderboard rolls over Monday 00:00 Paris (Sunday evening in Texas); streak days follow each phone's local date.

## 7. Operational (non-code; see `docs/admin-and-leader-ideas.md` section 9)
- [ ] Name the trip lead, tech contact, safeguarding lead and who holds medical information.
- [ ] Decide the data policy and retention date, and whether anyone is under 18.
- [ ] Ask the insurer or church about waiver wording and whether health information may be stored digitally.
- [ ] Printed emergency card and leader binder; an official fallback chat; eSIM decision. Print the roster (Admin > People > Roster > Download roster CSV) the week before departure and keep a copy offline with the trip lead; every download is logged.
- [ ] Calendar: forms 8 weeks out, passports verified 12 weeks out, weekly manual backup (the two CSV downloads), clean-up 30 days after return.

### After the trip: export, then delete
1. Within the retention date in the privacy notice: Admin > People > Roster, **Download roster CSV** and **Download to-dos CSV** (Admin > To-dos has the second one too). Store them with one named leader, encrypted, only if the church needs a record. Delete them from phones and downloads folders afterwards.
2. Delete each person with Admin > People > People and teams > **Delete person**. This removes their account, progress, emergency contact, medical notes and uploaded files, and says how many files went.
3. Empty the `todo-uploads` bucket from the Supabase dashboard for anything left (see `docs/privacy-and-retention.md`), then clear `push_subscriptions` if you keep the project.
4. Backups keep a copy for up to 7 days (free plan); pause or delete the Supabase project after that if you will not use it again.
5. `admin_audit` (who exported or viewed what) holds no medical data; keep it until the project is deleted.

## 8. Still unverified (needs dashboards or a live test)
- [ ] Whether Supabase Storage serves uploaded HTML or SVG inline on signed URLs.
- [ ] Whether `auth.admin.deleteUser` is blocked by storage object owner references.
- [ ] Supabase Auth rate limits, OTP expiry, CAPTCHA status and the SMTP provider actually in use.
- [ ] Vercel HSTS header, env var scoping, fork and preview protection, whether logs keep query strings.
- [ ] DeepL Free and Groq data-retention terms.
- [ ] That all migrations are applied to the live database.
