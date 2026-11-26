# Le Nid: security and privacy audit

Date: 2026-11-26. Scope: the whole repo at the current working tree (migrations 0001-0019, `app/`, `lib/`, `components/`, `proxy.ts`, `public/sw.js`, config). The audit was **read-only**: no app code, SQL or settings were changed. The only new file is this one.

Method: every claim below comes from reading the cited file and line. Anything I could not check from the repo (Supabase and Vercel dashboard settings, how a hosted service behaves) is marked **UNVERIFIED**. `npm audit` was run.

Severity scale: **High** = real exposure of passport-type data or account takeover that is plausible for this group. **Medium** = a realistic abuse or outage path, or a missing defence layer. **Low** = needs unusual conditions, or the harm is small. **Info** = checked and fine, or hygiene only.

---

## Summary

The database layer is in good shape. RLS is on for every table (22 tables checked). A restrictive `approved only` policy gates pending and rejected accounts everywhere. Emails are hidden with column grants. Every `security definer` function pins `search_path` and checks `auth.uid()`, `is_approved()` or `is_admin()` itself. The anon grants have been revoked. Every exported admin server action goes through `requireAdmin()`. The cron routes fail closed. No XSS sinks were found. No secrets are in the repo or its git history, and `npm audit --omit=dev` finds 0 vulnerabilities.

The main risks are in what happens **around** the data:

1. Passport scans outlive the person. Deleting a person, re-uploading or un-ticking a to-do leaves the old files in the `todo-uploads` bucket, and nothing ever deletes them (H1).
2. The Safari hand-off link can be used for login CSRF. Another member can make a victim's browser sign in as the attacker, so the victim's passport upload lands in the attacker's folder (M1).
3. `signInCode` lets any admin quietly sign in as anyone, other admins included, and leaves no audit trail (M2).
4. Open sign-up plus the Gmail SMTP sender can be flooded, which would stop codes reaching the group during the trip (M3).
5. The upload buckets have no size or type limits (M4).
6. There are no security headers or CSP, and the Supabase session cookies can be read by JavaScript (M5).

---

## Findings

### H1. Passport uploads are never deleted (person deletion, re-upload, un-complete). No retention plan. HIGH

- `app/(app)/admin/actions.ts:385-395` `deletePerson` calls `auth.admin.deleteUser(id)` only. The cascade removes `profiles` and `todo_assignments` rows (with `upload_path`), but **objects in `storage.objects` under `todo-uploads/<id>/` stay**. The admin sees "Deleted" and the confirm text says "and all their progress", so the admin believes the passport copy is gone.
- `components/TodoItem.tsx:21-23` builds the path from the original file name: `${userId}/${todoId}-${file.name}`. A second upload with a different name (`IMG_0001.jpg`, then `passport.pdf`) creates a **second object**. Only the newest path is kept in `todo_assignments.upload_path`, so the older copy is orphaned and no UI can reach it.
- `components/TodoItem.tsx:33-36` "Mark not done" clears `completed_at` but leaves the file (and `upload_path`) in place.
- No migration, script or cron deletes uploads after the trip (March 2027).
- Rejected accounts (`admin_set_status` to rejected) keep any uploads they made while approved.

**Failure scenario.** A student leaves the trip and asks for their data to be deleted. The leader taps Delete. Their passport scan stays in the bucket for good, and anyone with dashboard or service-role access can still read it. A later leak of the service-role key (see the owner checklist) exposes every passport ever uploaded, including those of people who were "deleted".

**Fix.**
1. In `deletePerson`, before `deleteUser`, remove the person's folder:
   ```ts
   const db = createServiceClient();
   for (;;) {
     const { data: objs } = await db.storage.from("todo-uploads").list(id, { limit: 100 });
     if (!objs?.length) break;
     const { error } = await db.storage.from("todo-uploads").remove(objs.map((o) => `${id}/${o.name}`));
     if (error) throw new Error(`Could not delete their uploads: ${error.message}`);
   }
   const { error } = await db.auth.admin.deleteUser(id);
   ```
2. In `TodoItem.tsx`, use one fixed path per to-do so a re-upload overwrites: `upload_path = \`${p.userId}/${p.todoId}\`` with `upsert: true` and `contentType: file.type`. Keep the display name in a separate column if it is needed.
3. In `undo()`, when the to-do requires an upload, also `remove([upload_path])` and set `upload_path: null`.
4. Find the orphans now (read-only query):
   ```sql
   select o.name, o.created_at from storage.objects o
   where o.bucket_id = 'todo-uploads'
     and not exists (select 1 from public.todo_assignments a where a.upload_path = o.name);
   ```
   Delete them through the Storage API or dashboard, **not** with `delete from storage.objects` (a SQL delete leaves the underlying file in object storage).
5. Write down a retention date (for example "all uploads deleted by 30 April 2027"). Put it in the app's privacy note and in the calendar, then empty the bucket from the dashboard on that date.

### M1. Login CSRF through the Safari hand-off link (`/auth/handoff`). MEDIUM

- `app/api/handoff/route.ts:37-42` mints a magic-link `hashed_token` for the caller and returns `…/auth/handoff?th=<token>&next=<path>`.
- `app/auth/handoff/route.ts:20-27` verifies the token **on GET with no confirmation**, sets session cookies and redirects to `next`.

**Exploit.** Mallory (an approved member) calls `/api/handoff` and gets a link for **her own** account. She sends it to Alice: "here is the to-do link". Alice taps it, her browser is now signed in as Mallory (her own cookies are overwritten), and it lands on `next=/todos`. Alice sees a "Passport copy" to-do (Mallory's own assignment), uploads her passport, and it goes to `todo-uploads/<mallory-id>/…`. Mallory can read it. The only visible clue is the initial in the header.

A second path: link-preview bots (iMessage, WhatsApp, Slack) that fetch a pasted hand-off URL use up the token and may receive a valid session cookie for that user. The code already notes that Safari pre-fetches pasted addresses (`route.ts:28-29`).

**Fix.**
- Make `GET /auth/handoff` render a page with a "Continue in Safari" button that POSTs the token. Do the `verifyOtp` only in a `POST` handler. This defeats previewers and one-click CSRF.
- After any hand-off sign-in, show an interstitial before redirecting: "Signed in as **<email/name>**. Not you? Sign out". Ignore `next` on that first hop.
- Shorten Supabase's Email OTP expiry from 1 hour to 10-15 minutes (owner checklist).
- Optional: restrict `safeNextPath` for hand-off to `/translate/talk*` only, since that is the only reason the link exists (`lib/talk/safe-next.ts:7`).

### M2. `signInCode` gives silent impersonation of any account, admins included, with no audit log. MEDIUM

`app/(app)/admin/actions.ts:405-415`:
- It is properly behind `requireAdmin()` (through `run`) and the service role is used only after that check.
- It accepts **any** email. There is no check that the target exists, is approved or is not an admin. Any admin can sign in as another leader or as any student, see their to-dos and votes, and act as them.
- It writes **no audit record**. The only trace is the Supabase auth log entry for the later sign-in.
- The code is shown in the admin's browser and then "sent privately" (in practice probably over SMS or WhatsApp). Anyone who reads that message within the hour owns the account.
- **UNVERIFIED:** whether `generateLink({type:"magiclink"})` for an email with no account creates a new user. If it does, the new account still goes through `handle_new_user` (pending unless pre-approved).
- Making a code replaces the person's outstanding emailed OTP (same token slot), so a code the student is waiting for stops working.

**Abuse scenario.** One leader's phone is left unlocked, or their session is stolen. The attacker opens Admin, then Make a sign-in code, for each student in turn, and nobody can later tell this happened.

**Fix.**
```sql
create table if not exists public.admin_audit (
  id bigint generated always as identity primary key,
  actor uuid references public.profiles(id) on delete set null,
  action text not null,
  target uuid,
  detail jsonb,
  at timestamptz not null default now()
);
alter table public.admin_audit enable row level security;
create policy "audit admin read" on public.admin_audit for select to authenticated
  using (public.is_admin() and public.is_approved());
revoke insert, update, delete, truncate on public.admin_audit from anon, authenticated;
```
```ts
// in signInCode, before generateLink
const db = createServiceClient();
const me = await getProfile();
const { data: target } = await db.from("profiles").select("id, role, status").eq("email", email).maybeSingle();
if (!target) throw new Error("No account with that email yet. Ask them to request a code once first.");
if (target.role === "admin") throw new Error("Codes can't be made for leaders.");
await db.from("admin_audit").insert({ actor: me?.id, action: "sign_in_code", target: target.id });
// after success: tell the person, so misuse is visible
await sendPushToAll({ title: "A leader made a sign-in code for you", body: "If you didn't ask for one, tell a leader.", url: "/me" }, [target.id]);
```
Log `deletePerson`, `setAccess` and `viewUpload` (each time an admin opens a passport) to the same table.

### M3. Open sign-up can flood the shared Gmail SMTP and pending queue (availability during the trip). MEDIUM

- `app/login/page.tsx:58` `signInWithOtp` creates an account for any email (by design since 0008, see `supabase/migrations/0008_access_requests.sql:14-15`, and `SETUP.md:8`).
- Codes go out through a custom SMTP account, which `SETUP.md:10` and `.env.example:28-34` recommend be a Gmail app password.
- Each new pending account triggers a push to every admin, once per account (`app/(app)/layout.tsx:19`, `lib/notify.ts:5-20`). The push text includes the self-chosen name, so it is attacker-controlled text on leaders' lock screens.

**Exploit.** A script uses the public anon key (it is in the client bundle by design) to call `/auth/v1/otp` for thousands of random addresses. The result: Gmail's daily send limit is hit, or the account is flagged as a spammer and locked. Students in Strasbourg then cannot get codes. Admins also get a push per fake account and a long pending list.

**Fix.**
- Supabase, Auth, then Attack Protection: enable CAPTCHA (Cloudflare Turnstile is free) and pass `options.captchaToken` in `signInWithOtp` (a small change in `app/login/page.tsx`).
- Supabase, Auth, then Rate Limits: keep "emails sent per hour" low (for example 30) and the OTP per-IP limits at their defaults or stricter.
- Consider a dedicated sending mailbox (not a leader's personal Gmail), or Resend/Brevo with a domain.
- In `notifyAdminsOfRequest`, cap pushes (for example at most 10 per day in total) and strip URLs from `name`.

### M4. Storage buckets have no file-size or MIME limits. MEDIUM

`supabase/migrations/0001_core.sql:110` and `0002_todos.sql:47` create the buckets with only `public = false`. There is no `file_size_limit` and no `allowed_mime_types`. `components/TodoItem.tsx:60` uses `<input type="file">` with no `accept`.

**Exploit scenarios.**
- An approved member loops `storage.upload("<own-uid>/x-N", 50 MB)` (allowed by `0002_todos.sql:49-51`, own folder) and fills the free plan's storage quota. Admin file uploads then fail.
- A member uploads an `.html` or `.svg` as their "passport". The admin opens it through `viewUpload` (signed URL on `*.supabase.co`). **UNVERIFIED:** whether Supabase Storage serves user HTML/SVG inline. If it does, this is a phishing page on a trusted-looking domain. It is not the app's origin, so app cookies are safe either way.

**Fix (SQL):**
```sql
update storage.buckets
   set file_size_limit = 10 * 1024 * 1024,
       allowed_mime_types = array['image/jpeg','image/png','image/heic','image/heif','image/webp','application/pdf']
 where id = 'todo-uploads';
update storage.buckets set file_size_limit = 50 * 1024 * 1024 where id = 'files';
```
Also add `accept="image/*,application/pdf"` to the input, and pass `contentType` on upload.

### M5. No security headers and no CSP. Auth cookies can be read by JavaScript. MEDIUM

`next.config.ts:1-14` has no `headers()`. The repo sets no CSP, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`, `Permissions-Policy` or `X-Content-Type-Options`. `@supabase/ssr` keeps the session in cookies that browser JS must read (`lib/supabase/client.ts`), so a single XSS would let an attacker steal sessions. No XSS sink exists today (see I3), but there is no second line of defence. The admin console could also be framed for clickjacking. Its destructive buttons use a confirm, which reduces but does not remove the risk.

**Fix** (pattern from `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`, section "Without Nonces"). Ship it as `Content-Security-Policy-Report-Only` first and check Conversation mode, push and file downloads:
```ts
const SUPA = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",          // inline next/script id="sw" in app/(app)/layout.tsx:55
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "media-src 'self' blob:",
  "font-src 'self'",                             // next/font/google is self-hosted
  `connect-src 'self' ${SUPA} ${SUPA.replace(/^https/, "wss")}`,
  "worker-src 'self'",
  "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  turbopack: { /* unchanged */ },
  async headers() {
    return [{ source: "/(.*)", headers: [
      { key: "Content-Security-Policy", value: csp },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
    ] }];
  },
};
```
**UNVERIFIED:** Vercel adds HSTS on its domains by default. Confirm with `curl -I` on the production URL.

### M6. Push subscriptions: any https endpoint, no per-user cap, direct table writes. LOW-MEDIUM

- `supabase/migrations/0001_core.sql:92-93` `"push own"` is `FOR ALL`, so members can INSERT rows directly, not only through `claim_push_subscription`. The only checks are `0010_access_gaps.sql:15-16` (`^https://host/.+`, at most 1000 characters).
- `lib/push.ts:48-61` POSTs to every subscription in parallel with `Promise.all` and no concurrency limit.

**Exploit.** A member inserts 20,000 rows with endpoints such as `https://victim.example/…` or `https://10.0.0.5/…`. Every announcement, to-do or reminder then makes the Vercel function send 20,000 outbound POSTs. That is blind SSRF and traffic amplification, and the action or cron run times out, so real pushes are not delivered.

**Fix (SQL):**
```sql
drop policy if exists "push own" on public.push_subscriptions;
create policy "push own read"   on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy "push own delete" on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());
revoke insert, update on public.push_subscriptions from authenticated, anon;   -- claim_push_subscription (definer) still inserts
alter table public.push_subscriptions add constraint push_endpoint_known_host check (
  endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/'
) not valid;
```
In `claim_push_subscription`, also delete the caller's oldest rows past 5 devices. `components/PushToggle.tsx:13` only deletes, and `lib/push-client.ts:120` already uses the RPC, so the app keeps working.

### L1. Per-user budgets: a single user can use up the shared monthly DeepL quota, and the budgets fail open on errors. LOW

- `0010_access_gaps.sql:206-223` allows 15,000 translate characters per user per UTC day. DeepL Free allows 500,000 per month (`.env.example:13`), so **one** user at the cap uses ~450k/month. Charges are taken before the provider call, so failed translations count too.
- `0010_access_gaps.sql:225-240` allows 120 STT clips per user per day, up to 2 MB each (`lib/talk/api.ts:39-43`). With 35 users that is ~4,200 clips/day against one shared Groq free key. The group limiter (`app/api/stt/route.ts:21`) is per instance and in memory only.
- `app/api/stt/route.ts:113-114` and `app/api/translate/route.ts:44-45` block only on the "limit" message. **Any other RPC error (timeout, paused DB) fails open**, but the comments say only a missing function should.
- In-memory limiters (`lib/talk/rate-limit.ts`, `app/api/translate/route.ts:13`) are per instance and reset on cold start.

**Fix.** Add a group-wide daily counter (a table keyed by `day, kind` with no user FK) checked inside `use_translate_chars` and `use_stt_clip`, for example 25k characters/day for the group. Lower the per-user translate cap to ~5k/day. After the migrations are confirmed applied, fail closed: `if (quotaError) return isLimitError(...) ? 429 : 503`.

### L2. User-writable rows have no size or count caps (DB quota DoS). LOW

`vocab_cards.key` and `state` (`0009_vocab_cards.sql:4-10`), `srs_cards.state` and `ref` (`0004_scripture.sql:15-22`; only `progress` is capped, in 0011), and `profiles.name` (`0001_core.sql:7`, writable through the column grant in `0007_hardening.sql:41`) have no length limits or row caps. A member can upsert millions of `vocab_cards` rows and push the free-plan database toward its size limit, which can force the project into read-only mode for everyone. A very long `name` also bloats every leaderboard, admin page and push.

**Fix:**
```sql
alter table public.vocab_cards add constraint vocab_cards_small check (length(key) <= 200 and pg_column_size(state) <= 2048) not valid;
alter table public.srs_cards  add constraint srs_cards_small  check (length(ref) <= 40 and (state is null or pg_column_size(state) <= 2048)) not valid;
alter table public.profiles   add constraint profiles_name_len check (length(name) <= 80) not valid;
```
Add a `before insert` trigger on `vocab_cards` and `srs_cards` that raises once a user has more than ~3,000 rows.

### L3. The service worker keeps one user's pages after a session ends without "Sign out" (shared devices). LOW

`public/sw.js:9,55-63,146-158` caches the authenticated HTML of `/`, `/itinerary`, `/files`, `/todos` and `/learn…`. These caches are cleared only by the Sign out button (`components/ProfileForm.tsx:20-25`; `components/PendingScreen.tsx:35-40` posts `"clear"`).

If the session ends any other way (refresh token expired, admin deleted or rejected the person, cookies cleared) and someone else signs in on the same phone or church iPad, then the next time the device is offline it shows the **previous person's** cached `/todos` (their to-do titles and done states) and their initial.

Separately, the Translate history is kept in `localStorage` (`components/TranslatePanel.tsx:26,39`) and is never cleared, even on Sign out. The same applies to push: the old person's subscription keeps receiving their pushes on that device until the new person turns notifications on (`claim_push_subscription` re-points the endpoint).

**Fix.** After a successful `verifyOtp` in `app/login/page.tsx:71`, and in a client component that compares a stored user id with the current one, call `navigator.serviceWorker.controller?.postMessage("clear")` and `localStorage.removeItem(<translate history key>)`. Alternatively, name the cache `pages-v7-<userId>`. On Sign out, also clear the translate history.

### L4. The hand-off token travels in a URL. LOW

`app/api/handoff/route.ts:41` puts `hashed_token` in the query string. Query strings land in Vercel request logs (**UNVERIFIED** whether full query strings are kept on Hobby), in Safari history and in any app the link is pasted into. It is single-use and expires (1 h by default). The M1 fix (POST with the token in the body) also fixes this, together with a shorter OTP expiry.

### L5. Auto-approve when no admin exists. LOW

`0013_todo_audience.sql:9` (and 0008/0010): `ok := … or not exists (select 1 from public.profiles where role = 'admin')`. If the last admin row is ever removed (for example an admin deleted from the Supabase dashboard; `deletePerson` stops self-deletion but not deleting the *other* admin), **every** new sign-up is auto-approved and auto-assigned to-dos. The bootstrap phase is over, so remove the clause:
```sql
-- in handle_new_user():
ok := exists (select 1 from public.allowed_emails where email = lower(coalesce(new.email, '')));
```

### L6. XP time-zone gaming. LOW

`0010_access_gaps.sql:99,131` accept any valid `p_tz`. Switching between `Pacific/Pago_Pago` (UTC-11) and `Pacific/Kiritimati` (UTC+14) moves "today", so a user can earn the 300 XP daily cap about twice per real day and keep streaks alive. This only affects the leaderboard. Fix: `tz text := case when p_tz in ('Europe/Paris','America/Chicago') then p_tz else 'Europe/Paris' end;`

### L7. Approved members can see pending and rejected applicants. LOW

`0001_core.sql:82` `"profiles read" using (true)` plus `0008_access_requests.sql:16` (status is granted). Any approved member can `select id,name,status,created_at from profiles` and see every stranger or rejected applicant and their status. Emails are correctly hidden. If that matters, add `status = 'approved' or id = auth.uid() or public.is_admin()` to the read policy.

### L8. "Anonymous" polls are only anonymous in the UI. INFO/LOW

`0014_polls.sql:101-107` stores `user_id` for every vote, including on anonymous polls. Anyone with dashboard or service-role access can see who chose what. In a 35-person group, the admin's non-voter list (`0014_polls.sql:212-217`) together with live percentages can reveal individual answers (for example, when only one person has voted). Tell users "anonymous to leaders in the app", or store anonymous votes without `user_id` (use a salted hash only for de-duplication).

---

## Verified OK (Info)

- **I1. RLS coverage.** RLS is enabled on all 22 tables: profiles, announcements, push_subscriptions, itinerary_items, meetings, files, todos, todo_assignments, reminder_log, lesson_progress, xp_events, streaks, verse_sets, verse_set_items, srs_cards, trip_goal, allowed_emails, vocab_cards, usage_daily, polls, poll_votes, app_content. `reminder_log` and `usage_daily` have no policies (service role and definer only). The restrictive `approved only` policy is in `0008_access_requests.sql:28-37`, `0009`, `0014:115-120` and `0017:71-73`. On `storage.objects` it covers both buckets (`0008:43-46`).
- **I2. todo-uploads read access.** `0002_todos.sql:49-51`: members can read, list and sign URLs **only under `<own uid>/`**. Admins can read all. Nobody can write into someone else's folder (the `with check` requires own folder, admins included). `upload_path` must start with the user's uid (`0007_hardening.sql:60-62`). The admin `viewUpload` link lasts 60 s and runs with the admin's own RLS client (`actions.ts:284-295`). A member cannot read another member's passport.
- **I3. XSS.** There is no `dangerouslySetInnerHTML`, `innerHTML`, `eval` or `new Function` in `app/`, `components/`, `lib/` or `public/sw.js`. Announcements, polls, to-do titles, descriptions, names and notes are rendered as React text. `map_url` is normalised to `http(s)` on save (`actions.ts:39-43`) and prefixed with `https://` on render (`components/itinerary/ItineraryView.tsx:31-35`), so `javascript:` becomes a broken https link. The sources links in `CardBody.tsx:54` come from repo content.
- **I4. Security-definer functions.** All of them `set search_path = public`, check identity or role inside the function, and are revoked from `public, anon` (`0007:172-175`, `0008:223,277,288`, `0010:32-33,87-88,166-167,242-245`, `0014:221-224`, `0015:9-12`, `0016:48`, `0019:97-98`). Only `poll_options_ok` (immutable, not definer) remains callable by anon, which is harmless. Hygiene: Postgres still searches `pg_temp` first for relations unless it is listed. Supabase's linter prefers `set search_path = ''` with qualified names. PostgREST callers cannot create temp tables, so this is not exploitable here.
- **I5. Admin server actions.** Every exported action in `app/(app)/admin/actions.ts` goes through `run()` and then `requireAdmin()` (`:14-18`), or calls `requireAdmin()` directly (`viewUpload :286`, `announceFile :400`). The role is read from the DB, not the JWT. The service role is used only in `deletePerson` and `signInCode`, after the check. `/admin` itself redirects non-admins (`admin/page.tsx:67`). Next's server-action Origin check guards against CSRF. Gap: `requireAdmin` does not check `status === 'approved'`, but RLS does (`is_approved()`), so only the two service-role actions would work for a pending admin. Add `|| profile.status !== "approved"` to the check.
- **I6. Cron.** `app/api/cron/reminders/route.ts:20-22` and `streaks/route.ts:11-13` **fail closed** when `CRON_SECRET` is unset. The comparison is not constant-time, which is negligible over HTTPS. `crypto.timingSafeEqual` is optional hardening.
- **I7. proxy.ts.** The `/dev/` bypass (`proxy.ts:8`) depends on `process.env.NODE_ENV !== "production"`, which `next build` inlines as `"production"` on every Vercel build (preview and prod). `app/dev/speak/page.tsx:7` also calls `notFound()` in production. Public paths are `/login*`, `/auth*` and `/api/cron*`; each `/auth` route handles a missing session itself, and the cron routes check the secret. Static exclusions in the matcher (`:36`) cover only public assets. `/files/[id]` and all `/api/*` routes do their own auth checks.
- **I8. Open redirect.** `/auth/callback` ignores `next` and always goes to `${origin}/` (`app/auth/callback/route.ts:10`). `/auth/handoff` uses `safeNextPath` (rejects `//`, `/\`, control characters and lengths over 512) and always prefixes `origin` (`app/auth/handoff/route.ts:23,27`). `originOf` in `api/handoff` trusts `x-forwarded-host`. On Vercel the platform sets it, and the link only ever goes back to the caller, so it is not exploitable.
- **I9. File downloads.** `app/(app)/files/[id]/route.ts` uses the cookie client, so `files` RLS (`release_at <= now() or is_admin()`, `0001_core.sql:104-105`) and the storage policy (`0001:117-119`, which also checks `release_at`) both enforce the release time. Signed URLs last 120 s and responses are `no-store`. The service worker skips `/files/` (`sw.js:142`).
- **I10. API auth.** `stt`, `translate` and `handoff` all call `requireApprovedUser()` (`lib/talk/server-auth.ts`). It returns 401/403/503 and fails closed on errors other than "missing column". Outbound hosts are fixed (Groq, DeepL), so there is no SSRF there. The handoff email comes from the JWT, never from the request body.
- **I11. Secrets.** Only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_VAPID_PUBLIC_KEY` are public, and all are meant to be. `.env*` is git-ignored. A regex scan of the full git history for JWTs, Groq/Resend/DeepL keys, SMTP and VAPID secrets found nothing. Hardening: add `import "server-only";` to `lib/supabase/server.ts`, `lib/push.ts`, `lib/email.ts` and `lib/notify.ts`. Next handles this import internally (`node_modules/next/dist/docs/01-app/02-guides/data-security.md`).
- **I12. Dependencies.** `npm audit --omit=dev` finds 0 vulnerabilities. The full audit finds 7 moderate, all in dev-only `typescript-eslint`/`minimatch` (ReDoS-type, GHSA-g3hv-75wg-m249) and none in the runtime. Fix with `npm audit fix` when convenient.
- **I13. Emails.** The `profiles.email` column has no select grant (`0007:38-39`, `0008:16`). Admins read it only through `admin_list_people()` (definer with an `is_admin()` filter). `profiles insert own` cannot set role, status or a foreign email (`0010:36-42`).

---

## GDPR and privacy notes (not legal advice)

- **Who is covered.** The group is US-based (the `America/Chicago` itinerary zone; `0016_itinerary_tz.sql:21`). GDPR may still apply to processing during the trip, and certainly to **French residents whose voices and words go through Conversation mode** (`/api/stt` to Groq in the US; `/api/translate` to DeepL in Germany, or Groq). Recording and transcribing strangers needs, at minimum, telling them, and ideally asking. Add a one-line on-screen notice in Conversation mode ("I'm using a translator app; your words are sent to a translation service"). US state breach-notification laws (for example Texas) cover passport numbers whatever the GDPR position.
- **Special-category data.** To-dos with `requires_upload` are free-form. If leaders collect medical forms, insurance cards or allergy notes, that is health data. Keep health data off the app, or limit it to a minimum with explicit consent, and delete it on the H1 schedule.
- **Third parties.** Groq (US; audio and text) and DeepL (DE; text). **UNVERIFIED:** DeepL **Free** API terms may allow DeepL to keep and use texts for training (the Pro plan does not), and Groq's retention policy. The "Open in Google Translate" link (`components/TranslatePanel.tsx:14,162`) sends the text to Google in a URL. Gmail or Resend receive names and to-do titles (`app/api/cron/reminders/route.ts:92`). Push providers (Apple, Google, Mozilla) receive encrypted payloads, but notification text shows on lock screens. Announcement and to-do titles should never contain personal details.
- **Region.** **UNVERIFIED:** the Supabase project region (`SETUP.md:6` says "Note its region") and the Vercel function region (`SETUP.md:34`). For EU-facing data, `eu-central-1` (Frankfurt) or `eu-west-3` (Paris) is preferable. Moving a project means a migration, so at least write the region down in a privacy note.
- **Retention and deletion.** There is no data-retention schedule anywhere. Suggest: uploads deleted by 30 April 2027 (H1). Accounts, XP and votes deleted, or the project paused and deleted, by summer 2027. Rejected and pending accounts purged monthly. `deletePerson` should remove uploads (H1). Members have no self-service "delete my account"; a leader can do it, so say so in the privacy note.
- **Transparency.** Add a short privacy page (what is collected, who sees passports: leaders only; which providers are used; when it is deleted; who to contact). Link it from `/login` and `/me`.

---

## Prioritised top-10 fix list

1. **H1.** `deletePerson` removes `todo-uploads/<id>/` first. Fixed upload path per to-do (re-upload overwrites). "Mark not done" removes the file. Purge the current orphans through the Storage API.
2. **M1.** `/auth/handoff` confirms with POST plus a "Signed in as X, not you?" interstitial. Shorten Email OTP expiry to 10-15 min.
3. **M4.** Bucket limits SQL (10 MB; jpeg/png/heic/webp/pdf for `todo-uploads`).
4. **M2.** `admin_audit` table. `signInCode` refuses admins and unknown emails, logs, and notifies the target. Also log `viewUpload` and `deletePerson`.
5. **M3.** Turn on Supabase CAPTCHA (Turnstile) and pass `captchaToken`. Keep the email rate limit low. Use a dedicated sending mailbox.
6. **M5.** Security headers plus CSP (report-only first) in `next.config.ts`.
7. **M6.** Push: drop direct INSERT/UPDATE, add the endpoint host allowlist, cap at 5 devices per user.
8. **Retention.** Publish a privacy note with deletion dates, and put "empty todo-uploads" in the calendar for April 2027.
9. **L1 + L2.** Group-wide daily translate/STT budget and fail closed on RPC errors. Size and row caps on `vocab_cards`, `srs_cards` and `profiles.name`.
10. **L3 + L5.** Clear the SW caches and translate history when a different user signs in. Remove the "no admin, so auto-approve" clause from `handle_new_user`.

---

## Owner-side settings to check (dashboards)

**Supabase**
- Project region (Settings, then General). Write it down for the privacy note.
- Auth, Providers, Email: **Email OTP Expiration** (shorten to 600-900 s); OTP length 8 (the app expects 8); "Confirm email" on.
- Auth, Attack Protection: **CAPTCHA** on; leaked-password protection is not relevant (OTP only).
- Auth, Rate Limits: emails sent per hour, OTP verifications per IP, token refreshes. Keep the defaults or stricter.
- Auth, SMTP: a dedicated sender (not a leader's personal Gmail), with 2FA on that mailbox.
- Auth, URL Configuration: Site URL = production URL only. Redirect URLs list only `https://<prod>/auth/callback` (remove stale preview or localhost entries before the trip).
- Auth, JWT: "JWT expiry" (default 3600 s is fine). Signing keys: asymmetric (so `getClaims()` verifies locally).
- Storage, Buckets: both **private**. Apply the size and MIME limits (M4). Check for objects outside `<uid>/` in `todo-uploads`, and for orphans (H1 query).
- Database, then Advisors (Security and Performance linter): re-run it after any fix and confirm there are no "RLS disabled", "security definer view" or "function search_path mutable" warnings.
- Check the migration history so 0001-0019 are all applied (several code paths fail open when a migration is missing: `lib/supabase/server.ts:27-33`, `lib/talk/server-auth.ts:22`).
- API keys: rotate the **service_role** key if it was ever pasted into chat, a screenshot or a non-Vercel place. Make sure no one uses it in the SQL editor history or scripts that are shared.
- Backups (Free plan: daily, 7 days). Know that backups also keep "deleted" passports until they age out.
- Team members with dashboard access: as few as possible, all with 2FA.

**Vercel**
- Environment variables: `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` (32+ random characters), `VAPID_PRIVATE_KEY`, `GROQ_API_KEY`, `DEEPL_API_KEY`, `SMTP_PASS` marked **Sensitive** and scoped to **Production** only (not Preview) unless previews truly need them.
- **Git Fork Protection** on (Settings, then Git). With a public repo, a fork's PR must not deploy with your secrets.
- **Deployment Protection**: Vercel Authentication on for Preview deployments.
- Function region close to the Supabase region (`SETUP.md:34`).
- Log retention and drains: make sure no drain ships request URLs (hand-off tokens) to third parties.
- Cron Jobs: both jobs listed and succeeding. `CRON_SECRET` is set (the routes return 401 without it).
- Account: 2FA on the Vercel and GitHub accounts that own the project. GitHub: secret scanning and push protection on for the public repo. Dependabot alerts on.

---

## Could not verify (needs the dashboards or a live test)

- Whether `auth.admin.generateLink({type:"magiclink"})` creates a user for an unknown email.
- Whether Supabase Storage serves uploaded HTML/SVG inline on signed URLs.
- Whether `auth.admin.deleteUser` is blocked by `storage.objects.owner` references (current Supabase is believed not to block it).
- Supabase region, Auth rate limits, OTP expiry, CAPTCHA status, SMTP provider in use.
- Vercel HSTS header, env var scoping, fork and preview protection, whether logs keep query strings.
- DeepL Free and Groq data-retention terms.
- That all 19 migrations have actually been applied to the live database.
