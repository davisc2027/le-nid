# Reliability, performance and quality audit (read-only)

Written 26 Nov 2026 for the Strasbourg trip, March 2027. No app code was changed and nothing was committed. It complements `docs/audit-trip-readiness.md` (features); this one covers failure modes, weak-network behaviour, limits and code health. Severity: H = likely to hurt on the trip, M = real but has a workaround, L = polish.

## 0. Tool results

| Check | Result |
|---|---|
| `npm run build` (Next 16.4.6, Turbopack) | Passes, 37 routes. Turbopack prints no per-route sizes (see section 4). |
| `npx tsc --noEmit` | Clean (exit 0) after a build. On a fresh checkout it reports 8 "Cannot find name PageProps/LayoutProps" errors until `next build` or `next typegen` has generated the global types. |
| `npx eslint .` | **18 errors, 0 warnings** (section 1). |
| `test:speech`, `test:itinerary`, `test:polls`, `test:gospel`, `test:mic` | All pass (exit 0). Each prints a MODULE_TYPELESS_PACKAGE_JSON warning. |
| `check:gospel` | 362 checks, 0 failed. |
| `check-talk`, `check-verses` | 14 groups and 63,972 checks, 0 failed. |
| `check-curriculum` | Passes ("All checks passed") but the default sampling ran more than 10 minutes here; with `1` as the argument it finishes in under 100 s. |
| `e2e` (Playwright) | Not run. It needs Chromium and only covers the speak-lab dev page. |

## 1. Lint (18 errors)

| # | File:line | Rule | Real bug? |
|---|---|---|---|
| 1 | components/french/LessonPlayer.tsx:53 | set-state-in-effect (`setSoundState(soundOn())`) | No. Reads localStorage after mount to avoid a hydration mismatch; costs one extra render. Use `useSyncExternalStore` or a lazy initialiser guarded for SSR. |
| 2 | components/french/LessonPlayer.tsx:80 | set-state-in-effect (`setQueue(q)`) | **Latent.** The effect depends on `cards`, `completed`, `practiceKeys`, `frontier`. Any server re-render that hands new props (a `router.refresh()` from a sibling, or a revalidation) rebuilds the queue mid-lesson while `i` and the `missed` refs stay, so the exercise changes under the learner. It also shows "Loading..." for one frame on every start. Fix: build once with `useState(() => build())`, or key the player on the lesson id. |
| 3 | components/scripture/AddVerse.tsx:43 | set-state-in-effect (`setPreview(null)`) | No (benign reset). Derive the preview instead. |
| 4 | components/french/GentleToggle.tsx:8 | same | No. localStorage read after mount. |
| 5 | components/art/OdileSays.tsx:19 | same | No. |
| 6 | components/art/Backdrop.tsx:44 | same (`setPhase(phaseOf(new Date().getHours()))`) | No, but it causes a day-to-night flash on first paint. |
| 7 | components/InstallBanner.tsx:12 | same | No. Install detection after mount. |
| 8 | components/PushToggle.tsx:25 | same | No. |
| 9 | components/TranslatePanel.tsx:39 | same | No. |
| 10 | app/login/page.tsx:36 | same (`setGate`/`setInApp`) | No. The `checking` gate prevents a flash of the form. |
| 11-18 | InstallBanner:34, PendingScreen:49,50,57, TranslatePanel:149,177,177, AdoptSet:21 | react/no-unescaped-entities | No. Apostrophes and quotes in JSX text. Replace with `&apos;`/`&quot;`. |

Only #2 can misbehave. The rest are style-level because the app reads browser-only state in effects. Quick win: fix the 8 entity errors (mechanical), turn the 10 effect errors into one `useClientValue` hook, so `eslint` can run green and be used as a gate.

## 2. Error handling

| Sev | Where | Evidence | Fix |
|---|---|---|---|
| H | app/(app)/itinerary/page.tsx:7-9, files/page.tsx:7-10, page.tsx (Home) 11-22, learn/page.tsx:13-18 | Supabase `error` is never read. `data ?? []` renders "Nothing yet", "No files yet" or an empty itinerary when Supabase is paused, slow or returns an error. A student at the meeting point sees an empty schedule, not an error. | `if (error) throw error` (the `(app)/error.tsx` boundary has a Try again button) or render an inline "Could not load" card. Do it for itinerary, todos, files first. |
| H | app/(app)/todos/page.tsx:8-18 | Fallback query runs on any error, and if both fail the page shows "Nothing assigned to you." | Same fix; only fall back on code 42703. |
| M | todos/page.tsx:12,28, together/page.tsx:17 | `user!.id`. `getProfile()` returns null when the profile read fails (server.ts treats non-42703 errors as "no profile"), which throws a TypeError into the error boundary. Message is generic, no retry state beyond the button. | Guard with `if (!user) redirect("/login")` or show the load-failed card. |
| M | No timeouts anywhere on Supabase calls | Server pages and all browser `createClient()` calls use plain fetch with no `AbortSignal`. On weak Wi-Fi a request can hang for the OS timeout (60-120 s). Buttons then sit in busy state. The only timeouts are in `/api/stt` (30 s), `/api/translate` providers and `lib/talk/client.ts`. | Pass `global: { fetch: (u, o) => fetch(u, { ...o, signal: AbortSignal.timeout(15000) }) }` to `createBrowserClient`/`createServerClient`. 8-10 s for reads. |
| M | components/TodoItem.tsx:19-36 | `complete()` shows raw `error.message` ("TypeError: Failed to fetch") when offline; `undo()` ignores its error and refreshes, so Mark not done silently does nothing; the file upload (up to Supabase's 50 MB limit) has no progress, timeout or size check. | Map network errors to "No connection. Try again.", check `undo` error, cap upload size client-side (e.g. 10 MB) and resize photos. |
| M | admin/actions.ts:168-190 `addTodo` | Inserts the to-do, then the assignments, with no transaction. If the second insert fails the to-do exists with zero assignments, and a retry within 120 s answers "Already created" (the dedupe at lines 172-174), so the admin thinks it worked. `assignMissing` repairs it later. | Delete the to-do on assignment failure, or do both in one RPC. |
| M | admin/page.tsx:47-67 `loadPolls` | Any exception (including one transient RPC failure) returns `missing: true`, which the UI presents as "migration 0014 not run". Also 2 RPCs per poll for up to 30 polls (see section 4). | Distinguish 42P01 from other errors. |
| M | french/[lesson]/page.tsx:17-30, practice/page.tsx | If `vocab_cards` fails transiently, `cards = null`; the player silently skips review and card saving, so spaced-repetition data for that session is lost with no message. | Surface a "progress won't be saved for review" notice, or retry once. |
| L | public/sw.js:15 | `event.data.json()` is unguarded. A non-JSON push throws before `showNotification`, and iOS counts a silent push against the subscription (it can be revoked after a few). Our server always sends JSON, so this is defensive only. | `try { ... } catch { data = {} }` and always show a notification. |
| L | lib/email.ts:32, lib/push.ts | Resend `fetch` has no timeout; `webpush.sendNotification` has no `timeout` option. Both run inside 60 s crons. | Add `signal: AbortSignal.timeout(8000)` and `{ timeout: 8000 }`. |
| L | components/scripture/BibleNotice.tsx:9, AddVerse.tsx:37,45 | `.then()` without `.catch()`. `load.ts` swallows fetch errors, so rejection is unlikely; `loadVerse` JSON parse errors would be unhandled. | Add `.catch(() => {})`. |

Good: admin actions all go through `run()` which returns errors to the form; LessonPlayer retries only the failed half of its save (`saved` ref); ReviewSession and LearnFlow show "Couldn't save... tap again" messages; login catches network errors; `FileLink` maps TypeError to "No connection". `(app)/error.tsx`, `admin/error.tsx`, `global-error.tsx` use the documented `retry` prop (verified against `node_modules/next/dist/docs/.../error.md`). There is no `not-found.tsx`; a bad URL gets the default Next 404, which has no way back to the app. Add one.

## 3. Offline and PWA (public/sw.js)

What the worker does: precaches nothing at build time; on install it fetches 7 shell pages (`SHELL`, line 9) into `pages-v6` if signed in; hashed `/_next/static` files are cache-first and kept across deploys (`static-v1`, max 120 entries); Bible JSON cache-first (`bible-1`, max 140); reference audio cache-first. Navigations are network-first with a cache fallback, and `skipWaiting` plus `clients.claim` make updates immediate.

| Sev | Finding | Evidence | Fix |
|---|---|---|---|
| H | **No network timeout in the navigation handler.** On weak or captive-portal Wi-Fi `fetch(req)` hangs until the OS gives up (often 30-60 s), so the cached itinerary never appears. "Offline" only works when the connection fails fast (airplane mode). | sw.js:147-160 | Race the fetch against a 3-4 s timer for SHELL pages and serve the cached copy; let the network response update the cache in the background (stale-while-revalidate for shell pages). |
| H | **Emergency/contact info does not exist** (see audit-trip-readiness). Nothing to cache for the "no signal, lost student" case. | no route; SHELL line 9 | Build a static page, add it to `SHELL`, link from Home. |
| M | **Files are online-only.** `FileLink` fetches `/files/{id}?json=1` for a 120 s signed URL, and `/files/` is excluded from the worker (line ~141). The list shows offline but every file fails ("No connection"). Itinerary PDFs and handouts are unreachable without signal. | components/FileLink.tsx:22, files/[id]/route.ts | For the few key files, let admins mark "available offline" and store the blob in Cache Storage via the client, or tell students to open the key ones on Wi-Fi first. At minimum show "Needs a connection" on the card when `!navigator.onLine`. |
| M | **Shell pages cached at install have no JS chunks.** Install fetches HTML only. Pages the user has not opened online have no cached chunks, so they render static HTML but do not hydrate offline. Interactive parts (itinerary Now/Next highlighting, ItineraryView) depend on those chunks. | sw.js:58-62 | Open the 4 key pages once after install (or precache `/_next/static` URLs found in the fetched HTML). |
| M | **Not available offline:** `/me`, `/together`, `/translate`, `/french` and lessons, `/scripture*`, `/culture*`. Learning offline (the plane ride) fails with "Can't reach Le Nid". Verses work only if their Bible book JSON was already fetched. | SHELL list, sw.js:129-133 | Add `/french`, `/scripture`, `/culture` and `/translate` (which needs network anyway) to SHELL; lessons are server-rendered per user, so cache on visit only. Lessons use `lesson_progress` data per user; offline completion has no queue, so rewards would be lost. |
| M | **No update prompt and no stale-content signal.** Updates apply silently on the next navigation (network-first HTML). Old tabs keep old chunks (fine). Cached itinerary offline shows no "last updated" time, so a student cannot tell it is stale. | sw.js:55-57 | Store `Date.now()` with the page (header or a client write in ItineraryView) and show "Saved copy from 25 Mar 14:02" when offline. |
| L | **Cache bump is manual and easy to forget.** `PAGES = "pages-v6"`, `STATIC = "static-v1"`, `BIBLE_VERSION = "1"` are hand-edited. `STATIC` trimming (120 entries, ~50 chunks per build) evicts the oldest chunks after about 2 deploys, while a cached shell page from before may still reference them. | sw.js:3-10, 98 | Raise `MAX_STATIC` to 300, or key the cache by build id. Add a comment or a script check in `prebuild`. |
| L | SW is registered from three places (layout Script, PushToggle, push-client) with `register("/sw.js")`; harmless but redundant. `Script strategy="afterInteractive"` is skipped for pending users because the layout returns early, which is intended. | layout.tsx:56, PushToggle.tsx:26 | Keep one. |
| L | Install flow: iPhone gate on the login page is solid (`InstallFirst`, in-app browser detection, 60 s resend timer). `manifest.ts` has no `id`, no `scope`, and only two PNG icons (non-maskable); `background_color` is the light colour so dark-mode phones flash white on launch; `themeColor` is fixed light. | app/manifest.ts, layout.tsx:15 | Add `id: "/"`, a maskable icon, and `theme-color` media variants. |
| OK | Logout/clear: ProfileForm and PendingScreen purge caches so a shared phone does not show another person's cached todos. | ProfileForm.tsx:23 | Keep. |

Verdict for trip use: **itinerary, todos (read only) and the Home page work offline if the phone is truly offline and each was opened online at least once**; a flaky connection (the common case abroad) makes them hang instead of falling back (the first finding above). Files do not work offline. Emergency info does not exist.

## 4. Performance and limits

Bundles (`.next/static/chunks`, 50 files): total 1.72 MB raw, 561 KB gzip across the whole app (not per route). Largest chunks: 259 KB (Supabase JS: gotrue/postgrest/realtime, about 65 KB gzip), 233 KB (React DOM), 132 KB, 113 KB, 82 KB, 67 KB (contains French phrases and Bible helpers), 58 KB and 56 KB (course data: "phrases" appears 72 times). `public/bible` is 8.4 MB across 132 files (biggest 243 KB); it loads one book at a time and is cached, so this is fine. SVG art is inline; no large images; `public/*.svg` (file, globe, next, vercel, window) are unused create-next-app leftovers.

| Sev | Finding | Evidence | Fix |
|---|---|---|---|
| M | Cron fan-out is N+1: one `sendPushToAll` per assignment row, each re-running `setVapidDetails`, a `push_subscriptions` select and an upsert, all in a single `Promise.all`. With about 35 users and several to-dos that is 100-200 concurrent queries. | app/api/cron/reminders/route.ts:40-57 | Group rows by user, send one push per user (summarise "3 to-dos due"), batch the `reminder_log` upsert. |
| M | Admin page loads polls with 2 RPCs per poll for up to 30 polls (60 round trips), plus unbounded `files`, `verse_set_items`, `todo_assignments` (35 x to-dos). Acceptable now; it will slow as content grows. | admin/page.tsx:47-60, 95-112 | `limit(10)` on polls, or one aggregate RPC `admin_poll_summary()`; lazy-load each tab. |
| M | Learn page selects every `xp_events` row to sum in JS, every `lesson_progress` and `srs_cards` row to count. Grows with use (cap is 300 XP per day per user). `my_stats()` already exists in migration 0010. | learn/page.tsx:13-18 | Use `rpc("my_stats")` and a `count` query. |
| L | Every page runs `getClaims` in the proxy, then `getProfile` plus the todo count in the layout, then the page queries. The Home page also fetches the full leaderboard (limit 50) just to find the viewer's rank. | proxy.ts, layout.tsx:21-40, page.tsx | Add a `my_rank()` RPC; verify the Vercel function region matches the Supabase region (`vercel.json` sets none, default iad1). |
| L | `xp_events` index is `(user_id)` only; the daily-cap sum and weekly leaderboard filter on `created_at`. Irrelevant at 35 users (a few thousand rows). | migrations 0003, 0015 | `create index on xp_events (user_id, created_at)` when convenient. |
| L | Backdrop SVG (fixed, 52vh, animated, optional blur) is on every page; older iPhones may drop frames. `/dev/speak` and `app/dev` ship in the production build. | components/art/Backdrop.tsx, app/dev | Honour `prefers-reduced-motion`/low-power; exclude `app/dev` from production. |
| L | Streak and daily caps trust the client time zone: `award_xp` accepts `p_amount` up to 30 per call and 300 per day, so any signed-in user can call the RPC directly to take the daily cap (leaderboard inflation). Low stakes. | migrations/0010:94-125 | Accept as is, or derive the amount server-side. |

Platform limits against 35 users:
- **Vercel Hobby:** 2 crons, both daily (allowed: 2 max, once per day; timing is only guaranteed within the hour, so "07:00" can fire up to 08:00). `maxDuration` 60/30/30 s is within limits. Bandwidth (100 GB) is a non-issue: app plus Bible is a few MB per user. Hobby is for non-commercial use; a church trip app is probably fine but note it. No spend cap risk.
- **Supabase free:** 500 MB database (the app stores a few MB), 1 GB storage (watch to-do photo uploads: no size cap in `TodoItem`), 5 GB egress, 50k MAU. The project pauses after about 7 days of inactivity; the daily cron queries the DB, so it should stay awake, but a failed cron (CRON_SECRET missing, 401) will not wake it. Check once that the Vercel cron log shows 200.
- **Auth email:** custom SMTP (Gmail) is required; once configured Supabase still enforces an emails-per-hour limit (default about 30 per hour). If all 35 students request a sign-in code in the same hour at kickoff, some will be told to wait. Raise it in Supabase Auth, Rate limits, before sign-up day, or stagger sign-ups. `signInCode` in admin is the escape hatch (good). Gmail caps at about 500 per day.
- **Groq/DeepL:** in-memory per-instance rate limiters (`api/translate/route.ts:13`, `lib/talk/rate-limit.ts`) reset on each cold start and are not shared between serverless instances, so the "120 per hour" limit is soft; the daily DB-backed limits are real. The shared Groq key (about 20 requests/minute, 8 hours of audio per day) is the real ceiling for 35 people talking at once.

## 5. Accessibility (iPhone)

Contrast, computed from `app/globals.css` tokens (WCAG AA needs 4.5:1 for text under 18 px):

| Pair | Ratio | Verdict |
|---|---|---|
| muted on background / surface / tint (light) | 5.50 / 5.92 / 4.75 | pass |
| primary on background / tint (light) | 5.64 / 4.87 | pass |
| white on primary; ink on accent | 6.07; 6.03 | pass |
| good on background (light) | 4.59 | pass (barely) |
| `--accent-ink` on background (light) | 4.77 | pass |
| muted on background / surface (dark) | 7.46 / 6.76 | pass |
| primary on background (dark) | 5.20 | pass |
| **primary on tint (dark)**: `.tag`, badges, Next chip | **4.12** | **fail** for small text |
| accent border vs background (light) | 2.43 | below the 3:1 for UI boundaries (the Now highlight relies on border plus a badge, so OK) |
| card border vs background | 1.26 | decorative only |

| Sev | Finding | Evidence | Fix |
|---|---|---|---|
| M | Dark primary on tint is 4.12:1. Lighten `--primary` in dark mode to about `#e07a62`, or use `--foreground` for tag text. | globals.css:35,38 | token change |
| M | Dynamic Type is not supported. Sizes are rem/px, and 11 px labels (BottomNav, badges: 94 uses of `text-xs`/`text-[1xpx]`, 14 at 10-11 px) do not follow iOS text-size settings in the standalone app. Layout was not tested with large text. | BottomNav.tsx:36, various | Use `font: -apple-system-body` as the base on body, or `text-size-adjust`; raise minimum label size to 12 px. Test at "Larger text". |
| L | Tap targets are good: `.btn` and `.input` min-h-12, nav links min-h-16, most links min-h-11. Exceptions: `text-sm underline` text buttons ("Mark not done" in TodoItem, "Turn off" has `min-h-11` already). | TodoItem.tsx:57 | add `min-h-11` |
| L | Focus: no global `:focus-visible` style (browser default only; custom `outline-none` on inputs in Drills has a border substitute). Matters for keyboard users of iPad only. | globals.css | add a global `:focus-visible` outline |
| L | Aria is decent (188 `aria-label`/`role` uses, `aria-current` on nav, `role="dialog" aria-modal` on sheets, `lang="fr"` on French text, headings focused after steps). Modal sheets do not trap focus or close on Escape. | gospel/shared.tsx:78, TranslatePanel.tsx:116 | use `<dialog>` or add a focus trap |
| OK | Reduced motion is handled for stork, clouds, cathedral and Three Circles; `smooth()` in the itinerary checks it. Dark mode follows `prefers-color-scheme`; viewport does not disable zoom. | globals.css:237,262,296,336 | none |

## 6. Code health, tests, docs

| Sev | Finding | Evidence | Fix |
|---|---|---|---|
| H | **No tests for the server-side critical paths.** XP awarding and streaks (`award_xp`, `complete_lesson`), to-do assignment (`addTodo`, `updateTodo`, `assignMissing`, the sign-up trigger in 0013), access approval (`admin_set_status`, `is_approved`, the allowlist trigger), RLS on files and `release_at`. They exist only as SQL functions and server actions that nothing exercises. Polls have unit tests for tally and time logic only (`cast_vote` and `poll_results` are SQL). | lib/*.test.mjs, e2e/ | Add pgTAP or a script against a throwaway Supabase project covering: cap 300/day, streak across days and time zones, bad lesson id, pending user rejected, vote edit and close. |
| M | Grading is well covered only through `check-curriculum` and `check-verses`; `grade()` in lib/french/exercises.ts has no direct unit test of edge cases (accents, apostrophes, lost spaces). | lib/french/exercises.ts:89 | Table-driven test file. |
| M | No CI and no aggregate `npm test`; scripts are split across `test:*`, `check:*`, `scripts/check-*.mjs` (4 of which are not in package.json: check-curriculum, check-talk, check-verses, make-reference-list). `lint` fails, so it cannot gate. | package.json:6-18 | Add `"test": "npm-run-all ..."` or a shell script, plus a GitHub Action running lint, tsc, build and the checks. Add `"type":"module"` or rename `.test.mjs` imports to remove the warning. |
| M | **Docs drift.** README and SETUP say run migrations `0001` through `0009` (lines README 7, SETUP 7); there are 19 (0010 access gaps, 0013 todo audience, 0014 polls, 0016 itinerary tz, 0017 app_content, 0018 todo retired, 0019 push status). The code is full of "before migration NNNN" fallbacks because of this. README says nothing about 0010-0019. `.env.example` is complete (every `process.env` use in the code is listed) except `VERCEL_PROJECT_PRODUCTION_URL`, which is Vercel-provided (fine). | README.md:7,10; SETUP.md:7 | Say "run all files in `supabase/migrations` in order". |
| M | Migration-compat fallbacks are everywhere (`select("*")`, 42703 handling, retired_at retries, double queries in layout, todos, admin, cron). They hide errors (section 2) and double queries on failure. Once production has all 19 migrations, delete them. | layout.tsx:28-40, todos/page.tsx, reminders route, admin/page.tsx | Confirm prod schema, then remove. |
| L | No TODO/FIXME markers in code (clean). Dead assets: 5 unused `public/*.svg`; `app/dev/speak` and `e2e` dev harness ship in the prod route table; `lib/odile.ts` and `lib/odile-motion.ts` are both in use. | public/, app/dev | delete the SVGs |
| L | Duplicated logic: the `"before migration X"` retry pattern, the `Intl.DateTimeFormat(...Europe/Paris)` today helpers (cron x2, TodoItem, polls), and the `award_xp` plus streak body copied in `complete_lesson` (SQL). | see list | one `parisToday()` helper in lib |

## 7. Date, time zone and DST hazards

| Sev | Finding | Evidence | Fix |
|---|---|---|---|
| M | **The reminders cron fires at 01:00-02:00 Texas time** (07:00 UTC = 02:00 CST / 01:00 CDT) and, with Hobby's up-to-an-hour slack, up to 03:00. Until departure the group is in Texas, so "due today" pushes arrive in the middle of the night. README says "08:00-09:00 Paris", which is right only on the trip. | vercel.json:3, README:27 | Move to `0 14 * * *` (08:00/09:00 Texas, 15:00/16:00 Paris). The Monday-digest check uses Paris weekday, which stays Monday at 14:00 UTC. |
| M | Todo "overdue/due today" is computed in Paris time for everyone (`TodoItem.tsx:39`, cron `parisToday`). A Texas student at 6 pm on the due date is already "Overdue" because it is the next day in Paris. | TodoItem.tsx:39-41 | Compute "today" from the device time zone in the client (`Intl.DateTimeFormat().resolvedOptions().timeZone`), keep Paris for the cron. |
| L | Leaderboard week starts Monday 00:00 Paris, so in Texas it rolls over Sunday 17:00-18:00 (and is still Paris after landing, fine). | migrations 0005/0007/0008 | Document it, or accept. |
| L | Streak day uses the client time zone passed to `award_xp`. Flying Paris to Texas can make `today` earlier than `last_day`, which falls into the `else` branch and resets the streak to 1. The streak nudge cron compares against Paris yesterday, which is fine at 17:00 UTC. | migrations/0010:109-116 | Treat `last_day > today` as "already counted today". |
| OK | DST: Texas moves to CDT on 14 Mar 2027 and Strasbourg to CEST on 28 Mar 2027, so the gap is 6 h for two weeks. `lib/itinerary.ts` uses Intl per item and is tested for exactly those dates (`itinerary.test.mjs:15-30`). `parisEndOfDay` for polls picks the offset at 23:59:59Z, which is right on DST days. No hard-coded trip dates exist in code (only a 2026-08-16 comment about Groq models and an example date in a migration comment). Year rollover is safe (ISO date strings, `date_trunc('week')`). Cron times are UTC, so they do not move at DST; they shift by one Paris hour on 28 Mar. | lib/itinerary.ts, polls.ts:54-68 | none |
| L | Announcement timestamps are always shown in Paris time with "(Paris time)" appended, correct on the trip and labelled before it. | page.tsx:44 | none |

## 8. Prioritised top 10

1. **SW navigation timeout** (sw.js:147): serve the cached shell after 3-4 s so the itinerary, todos and Home load on bad Wi-Fi. (H, small)
2. **Show errors instead of empty states** on itinerary, todos, files, Home, Learn (section 2, first two rows). (H, small)
3. **Emergency/contacts page, cached offline** and added to `SHELL`. (H, small-medium)
4. **Move the reminders cron to 14:00 UTC** and fix the README time. (M, one line)
5. **Supabase fetch timeouts** (browser and server clients) plus friendly offline messages in TodoItem. (M, small)
6. **Offline story for Files**: mark key files, cache their blobs, otherwise say "needs a connection" clearly. (M, medium)
7. **Raise the Supabase Auth email-per-hour limit** (and test a 35-person sign-up) before kickoff; keep `signInCode` handy. (M, config)
8. **Tests for XP/streak, assignment and approval SQL** plus one CI workflow running lint, tsc, build and the checks. (M, medium)
9. **Fix lint to green** (8 entity fixes, one hook for the browser-only effects, and the LessonPlayer queue-rebuild bug) so lint can gate CI. (M, small)
10. **Docs drift and fallback cleanup**: README/SETUP migration list, then delete "before migration" fallbacks once prod has all 19. (M, small)

## 9. Quick wins that are safe to build

- Change `vercel.json` reminders schedule to `0 14 * * *`; update README line 27.
- `app/not-found.tsx` with a link back to Home.
- `error` checks plus a "Could not load" card on itinerary, todos, files (about 10 lines each).
- Timeout wrapper in the SW navigation branch (about 10 lines; keep the cache name and bump `PAGES` to `pages-v7`).
- Try/catch around `event.data.json()` in the SW push handler.
- Map network errors to a friendly message in `TodoItem`, check the `undo` error, and cap upload size at 10 MB.
- Escape the 8 apostrophes and quotes flagged by eslint.
- Dark-mode `--primary` lightened to reach 4.5:1 on `--tint`; `min-h-11` on the text-button links.
- `limit(10)` on admin polls; use `my_stats()` in Learn.
- Delete the 5 unused `public/*.svg` files.
- README/SETUP: "run every file in `supabase/migrations` in order".
- Raise `MAX_STATIC` to 300 and add `id`, a maskable icon and dark `theme-color` to the manifest.
- Add `"test"` and `"typecheck"` scripts to `package.json` (and `"type": "module"` check) plus a small CI workflow.
