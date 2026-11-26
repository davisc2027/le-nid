# Trip-readiness audit (read-only)

Written 26 Nov 2026 for the Strasbourg trip, March 2027 (about 15 weeks away). No app code was changed. Basis: README, SETUP, the two ideas/plan docs, every route under `app/`, and all six Admin tabs (Overview, People, To-dos, Polls, Content, Settings) in `app/(app)/admin/page.tsx`.

Legend: Value H/M/L. Effort S (under a day), M (1-3 days), L (a week+). Free tier: OK / CAVEAT.

## 0. Verdict

The learning side (French, verses, translate, Three Circles, culture, goal) is well ahead of the trip-operations side. Of the 10 leader ideas in `docs/admin-and-leader-ideas.md`, **only #7 is partly done** (schedule-change push and "Updated" tag, plus map links on itinerary items). Nothing a leader needs on a bad day (emergency screen, contacts, headcount, roster export) exists. That is the gap to close before March, and it is mostly small, static work.

What is already built and counts as done: announcements+push, itinerary with time zones/Now-Next/map links/"Updated" push, to-dos with upload, reminders, retire, assign; polls; "who has notifications off" list; per-to-do "waiting on" names; sign-in code generator; access approval; delete person; install-first gate on login; welcome tour; pending screen; weekly Monday email; streak nudge push (daily 17:00 UTC cron).

## 1. View A: first-time student, day 1

Flow today: login in Safari shows the Add-to-Home-Screen steps first (good, `components/InstallFirst.tsx`), then email, 8-digit code, then a "Waiting for a leader" screen unless pre-approved, then Home with install banner, push prompt, name nag, and a walkthrough tour.

| Finding | Value | Effort | Files |
| --- | --- | --- | --- |
| No emergency/contacts/"who do I call" anywhere in the app. A lost student on day 1 has nothing. | H | S | new `app/(app)/emergency/page.tsx`, `components/BottomNav.tsx` or home link, `public/sw.js` SHELL |
| No privacy notice and no consent text on sign-in or `/me`. Needed before you hold any emergency/health data; also expected for people entering emails. | H | S | `app/login/page.tsx`, `app/(app)/me/page.tsx`, static page |
| Sign-in depends on an emailed code. Gmail/Outlook delay, spam folder, and abroad with no data it fails. Mitigations exist (admin "Make a sign-in code", 5/hr Safari handoff) but a student cannot self-serve: no "didn't get it" hint beyond the cooldown. Add "check spam; ask a leader" text and a pre-trip rule "be signed in on the Home Screen app, never sign out". | M | S | `app/login/page.tsx`, SETUP "roaming" to-do |
| Waiting screen is fine if approvals are fast. Pre-approve the roster (Admin > People > Pre-approved emails, paste all 35) so nobody waits. Owner task, no code. | H | S | Admin UI only |
| Empty states: Home "Nothing yet.", Todos "Nothing assigned to you.", Files likely empty. Passable but dead on day 1 if you have not seeded content. Seed before invite: a welcome announcement, 1 to-do ("Turn on notifications"), the itinerary skeleton, one verse set, one poll. Cheap code option: a first-run card on Home ("3 things to do today") replacing "Nothing yet." | M | S | `app/(app)/page.tsx` |
| Real-iPhone behaviour is unverified (SETUP section 7 checklist is unticked as far as the repo shows). Install, push, audio with silent switch, mic in standalone app, Safari backup. Biggest risk of all; cheaper to find now than in March. | H | S | owner task |
| Placeholder icons (README says generated; `public/` still has default Next SVGs). Visible on the Home Screen of every phone. | M | S | `app/icons/[size]/route.tsx`, `app/apple-icon.tsx` |
| Offline: service worker caches only `/`, itinerary, files, todos, learn, three-circles. Not translate, French lessons list, culture, or an emergency page. Offline page says "Can't reach Le Nid" with a data tip (good). | M | S-M | `public/sw.js` |

## 2. View B: admin and leaders

### 2.1 Status of the 10 ideas (section 10 of `docs/admin-and-leader-ideas.md`)

| # | Idea | Status now | Value now | Effort | Free tier |
| --- | --- | --- | --- | --- | --- |
| 1 | Paperwork as to-dos with upload + "Needs attention" list | Upload to-dos work. "Needs attention" **partly**: per-to-do "Waiting on" names and "notifications off" list exist, but no per-person view (who is overdue across all to-dos). | H | S | OK |
| 2 | Emergency/contacts screen, cached offline | **Unbuilt** | H | S | OK |
| 3 | Roster and to-do CSV export (+ export log) | **Unbuilt** (no `export` route) | H | S | OK |
| 4 | Privacy notice, consent tick, retention plan, EU region | **Unbuilt**; region decision unknown | H | S | OK (region fixed at project creation, see 5) |
| 5 | Emergency contact + allergy/dietary on profile | **Unbuilt** | H | M | OK |
| 6 | Leader role (and medic flag) | **Unbuilt**: `profiles.role` check is only `admin`/`member` (0001). Every admin sees everything, including passport uploads. | M (H if health data collected) | M | OK |
| 7 | Schedule-change push + "Changed" badge; targeted push | Change push **done** (`updateItineraryItem` sends "Schedule updated"; "Updated" tag from 0016). Targeted push by team **unbuilt**, but `sendPushToAll(payload, ids)` already accepts an id list so it is a small step. | M | S | OK |
| 8 | Headcount check-in + buddy pairs | **Unbuilt** | H on the trip | M | OK (button + table, no cron) |
| 9 | Offline pre-cache + real-iPhone dry run | SW caches 7 shell routes; no dry run recorded | H | S-M | OK |
| 10 | "I need help" button + post-trip cleanup | **Unbuilt** (SETUP section 8 gives manual SQL only) | M (help), H (cleanup, legal hygiene) | M / S | CAVEAT: push is best-effort on iPhone |

### 2.2 Specific items you asked about

| Item | Today | Recommendation | Value | Effort | Files |
| --- | --- | --- | --- | --- | --- |
| Emergency/contacts screen | none | Static page: 112, SAMU 15, police 17, US consulate, hotel/hostel address+phone, 3 leader phones as `tel:` links, insurer line, nearest hospital, "call 112 first". Content in `content/emergency.json` so leaders edit without code. Pre-cache. Also print one page per student. | H | S | `app/(app)/emergency/page.tsx`, `content/emergency.json`, `public/sw.js`, `app/(app)/page.tsx` or `BottomNav` |
| Headcount check-in | none | Admin opens a check-in ("Meeting point 14:00"), students tap one big button on Home, leaders see not-yet-checked list with team. One table, one RPC. Cheaper alternative if time is short: a poll "Are you at the bus?" (polls already exist, with voter list `admin_poll_voters`). Use that as the trip-week stopgap. | H | M (poll stopgap: none) | new migration, Admin tab, Home card |
| Buddy pairs | none | Add `buddy_id` and `room` next to `team` in People rows; show on `/me`. Or simply put pairs and rooms in a pinned announcement and the emergency page. | M | S | migration, `setTeam` in `admin/actions.ts`, `admin/page.tsx`, `me/page.tsx` |
| Roommate/room info | none | Same as above (`room` text). | M | S | same |
| Flight info | none | A leader spreadsheet is enough. In-app only if you do airport pickups: `travel` table. Otherwise a to-do "Send flight details" with upload/text and an offline sheet. | L-M | M | skip in app |
| Packing list | none (no hits in code) | Static checklist page from `content/packing.json`, ticks in localStorage. Or a pinned announcement + a to-do "Pack by date". | M | S | `app/(app)/packing/page.tsx`, content JSON |
| Emergency info offline | partial (7 shell routes cached, no emergency page) | Add emergency page to `SHELL` in `public/sw.js`; test in airplane mode on a real phone. | H | S | `public/sw.js` |
| Leader role vs admin | binary admin/member | Do **not** build full role system now. Alternative: 2-3 named admins only, and keep medical data out of the app (paper forms). Revisit only if you add health fields. | M | M | migration, `lib/supabase/server.ts`, `admin/page.tsx` |
| CSV export of people and to-do status | none | `admin/export/route.ts` (admin-checked, returns CSV). Two links in Admin > People and To-dos. Needed as printed backup roster. | H | S | new route, `admin/page.tsx`, `admin_list_people` RPC data |
| Post-trip cleanup/data deletion | manual SQL in SETUP section 8; `deletePerson` exists; passports live in `todo-uploads` | Add "Post-trip cleanup" action with typed confirmation: empty `todo-uploads`, null `upload_path`, delete `push_subscriptions`. Put the date in the calendar now. Also decide about deleting all non-admin profiles. | H (data hygiene) | S | `admin/actions.ts`, `admin/page.tsx` Settings tab |
| Leader progress view (lessons, verses, streaks) | none (admin cannot see who is stuck) | Read-only table with last-active date; encouragement not shaming (see risk 7 in ideas doc). Needs admin-read RLS on `lesson_progress`/`xp_events`/`streaks`; none yet (policies are own-rows). | M | S-M | migration, `admin/page.tsx` |
| Per-person "Needs attention" | partial | One list of people with overdue/missing uploads/no push, sorted by count, "Remind" button reusing `remindTodo`. | H | S | `admin/page.tsx` (data already loaded) |
| Weekly leader digest in Monday email | none | Add admin block (overdue top 5, pending requests). | L | S | `app/api/cron/reminders/route.ts`, `lib/email.ts` |

### 2.3 Operational gaps to decide before code

- **No back-up channel written down.** Push is best effort on iPhone. Decide the official fallback (group text/WhatsApp) and put it in the emergency page and the printed card.
- **Roaming.** Decide eSIM vs Wi-Fi only; sign-in and translate need data. Add as a to-do with a due date in January.
- **Minors.** Confirm no one is under 18; if any are, stop and follow section 4 of the ideas doc before collecting more data.
- **Passport uploads are the most sensitive data in the system** and sit in a free-tier project of unknown region. Either stop collecting passport photo pages in the app (leaders carry paper copies) or accept it and schedule the cleanup action.
- Supabase free projects pause after about a week of inactivity; the daily cron prevents this while Vercel is running. Check after the trip.
- Back up the roster weekly once data exists (CSV export covers this).

## 3. View C: engagement for the next 4 months

### 3.1 What exists
Streak push (only for people with a 2+ day streak whose last day was yesterday), Monday summary email (to-dos only), leaderboard (opt-in), teams, cathedral spire goal, Odile reactions, end-of-lesson review, FSRS verse reviews, culture quiz. Completion screen shows "+XP, N-day streak".

### 3.2 Gaps

| Idea | Value | Effort | Free tier | Files |
| --- | --- | --- | --- | --- |
| **Re-engagement push for lapsed learners** (3+ days with no XP, max 1 per week). Today nudges only protect streaks of 2+; people who never started or who fell off get nothing. Add a second pass in the existing streaks cron. | H | S | OK | `app/api/cron/streaks/route.ts` |
| **Weekly learning recap in the Monday email/push** ("You earned 80 XP; the team added 640; spire is at 62%"). Reuses existing cron and email. | H | S | OK | `app/api/cron/reminders/route.ts`, `lib/email.ts` |
| **Goal milestones with push** (25/50/75/100%), announced to everyone once. SpireGoal already draws stages from `cathedralPlan.ts`; add a one-time announcement/push when a stage is crossed. | H | S | OK | `app/api/cron/streaks/route.ts` (or new), `components/art/cathedralPlan.ts` |
| **Daily verse / phrase on Home** from a JSON by date. Gives a reason to open the app that is not a task. Cheap, content only. | M | S | OK | `content/daily.json`, `app/(app)/page.tsx` |
| **Weekly team challenge** (team XP this week vs last, or "everyone does 1 lesson"). `team_totals` RPC exists (all-time); add a weekly version and a banner. | M | S-M | OK | migration (RPC), `app/(app)/together/page.tsx` |
| **Personal milestones** (first lesson, 7-day streak, first verse mastered, unit done) as one-line toasts at the completion screen. No badge system needed. | M | S | OK | `components/french/LessonPlayer.tsx`, `components/scripture/LearnFlow.tsx` |
| **Unit/course completion celebration** (finishing a unit, all 72 lessons). Lesson summary exists; no unit-level moment. | M | S | OK | `LessonPlayer.tsx` |
| **Streak freeze / grace day**, so one missed day over 4 months does not kill motivation. Needs SQL change in `complete_lesson`/`award_xp`. | M | M | OK | new migration |
| **Leader tool: who has gone quiet** (7+ days) for a personal text, never public. | M | S-M | OK | `admin/page.tsx`, RLS |
| Live conversation drills / "phrase of the week" tied to the itinerary. | L | M | OK | content |

### 3.3 Group goal pacing (15,000 XP)

XP in code (read from SQL and components):
- Lesson first completion 10 XP, repeat 5 (`complete_lesson`); 72 lessons = a fixed pool of **720 XP per student**.
- End-of-lesson/practice review: 2 per passed card, capped at 20 per session (`LessonPlayer.tsx`).
- Verse learn: 15 first time, 8 repeat (`LearnFlow.tsx`); verse review session 3 per passed card, capped 30 (`ReviewSession.tsx`).
- Culture quiz 2 per right answer (max 10 a round); Three Circles practice 5, once a day per device.
- Server caps: 30 XP per single `award_xp` call, 300 XP per person per day.

Rough per-student weekly XP:
- Light user (2 short sessions): about 40 XP/week.
- Regular (4 sessions plus a verse review): about 100 XP/week.
- Committed (daily, 25-30 XP): about 150-200 XP/week.

Roster scenarios (35 people, 15 weeks to mid-March):

| Mix | XP/week | XP by trip | Reaches 15,000 |
| --- | --- | --- | --- |
| Pessimistic: 5 regular, 10 light, 20 inactive | about 900 | about 13,500 | misses by about 10% |
| Plausible: 10 regular, 12 light, 13 inactive | about 1,500 | about 22,000 | around week 10 |
| Strong: 20 regular, 10 light, 5 inactive | about 2,400 | about 36,000 | around week 6 |

Conclusions:
1. 15,000 equals about 430 XP per student, or about 29 per student per week over 15 weeks. That is modest: **it will be hit early if half the group engages and missed only if the group largely ignores the app.** Real risk is a goal that completes in January and then has no pull.
2. Fix with milestones (one-time pushes at 25/50/75%) and consider a second, later target (for example "Stretch 30,000, unlocks something on the cathedral/at a meeting") that is revealed once 15,000 is reached. Decide the reveal in advance; target is editable in Admin > Settings > Group goal (`updateGoal`), no code.
3. **Fixed pool is small.** First-time lessons plus verses top out near 1,500 XP per student; after that XP comes from repeatable reviews (3 per card, up to 300 per day). One enthusiast can farm 300 XP/day (2,000 a week) and carry the goal alone. Consider a weekly per-person cap or count only a person's first 600 review XP per week toward the group total if fairness matters. Low urgency.
4. Team totals are all-time only; weekly team ranking would keep it fresh.
5. Targets assume goal is cumulative from 26 Nov. XP earned during beta testing by admins also counts; decide whether to reset (`delete from xp_events where ...`) before launch.

## 4. Owner-side checklist (one place)

Everything below is something only you can do. "Where" says where.

### Database (Supabase SQL editor)
- [ ] Confirm which migrations are applied. **SETUP.md and README only mention 0001-0009 (+0011); 0010 and 0012-0019 are undocumented there.** Run in order; each is safe to re-run. Check by running `select proname from pg_proc where proname in ('my_stats','admin_push_status','poll_results');` and `select column_name from information_schema.columns where table_name in ('todos','itinerary_items') and column_name in ('retired_at','everyone','tz','updated_at');`
  - 0010 access gaps (security fixes; **run first, it is not optional**)
  - 0011 verse progress, 0012 delete users, 0013 to-do audience, 0014 polls, 0015 linter cleanup, 0016 itinerary tz + Updated, 0017 app_content (Three Circles editor), 0018 retire to-do, 0019 push status
  - The code degrades silently when they are missing (labels such as "Run migration 0019 first"), so a missing one will not show up as an error; look for those messages in Admin.
- [ ] Make leaders admin: `update profiles set role = 'admin' where email in (...)` (SETUP section 5).
- [ ] Decide Supabase region (EU for health/passport data); changing it later means a new project.

### Vercel / env (Vercel > Project Settings > Environment Variables; mirror in `.env.local`)
- [ ] `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:`)
- [ ] `CRON_SECRET` (both crons in `vercel.json` use it; verify by curl, SETUP section 6)
- [ ] `GROQ_API_KEY` (speech-to-text and translate fallback), `DEEPL_API_KEY` (optional)
- [ ] `DEEPL_GLOSSARY_EN_FR`, `DEEPL_GLOSSARY_FR_EN` (after the glossary review, below)
- [ ] `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` for the weekly email; or `RESEND_API_KEY`
- [ ] Function region close to the Supabase region (Project Settings > Functions)

### Supabase Auth
- [ ] Custom SMTP (Authentication > SMTP Settings). Built-in mail allows a few emails per hour; 35 sign-ins will fail without it. Test with a real Gmail, an iCloud and an Outlook address.
- [ ] Email templates: both Confirm signup and Magic Link contain `{{ .Token }}`; OTP length 8.
- [ ] URL Configuration: Site URL plus `/auth/callback`.
- [ ] Consider longer session lifetime so people stay signed in abroad.

### Content review (needs a native French speaker, plus pastor for faith content)
- [ ] `docs/curriculum-review-list.md`: 20 new simplified phrases, plus the faith unit and conversation skills (curriculum.md section 8.5).
- [ ] Culture cards and JP cards in `content/french/culture.json` (facts from `docs/joshua-project-culture.md` need a source check).
- [ ] `content/talk/glossary.json`: all 51 entries are `reviewed: false`. Then `DEEPL_API_KEY=... node scripts/sync-deepl-glossary.mjs` and put the two printed ids in Vercel (new ids each run; redeploy).
- [ ] Three Circles French: Admin > Content > Three Circles, mark reviewed when done (the "Draft French" note disappears; `app_content.reviewed`).
- [ ] Bible text: confirm `public/bible/fr` and `/en` are committed and spot-checked (John 3:16, Ps 23:1, Rom 8:38-39); `node scripts/check-verses.mjs`.

### Real-iPhone checklist (SETUP section 7; do on 2-3 phones, one older iOS, one cellular-only)
- [ ] Install, sign in inside the app, push arrives, lesson audio with silent switch, translate typing and dictation, Conversation mode in the installed app, Safari backup link, airplane mode, light/dark, bottom nav over home bar.
- [ ] Add: sign out and back in; deny notifications then re-enable; two accounts on one phone; a very slow connection.

### Operational/non-code (docs/admin-and-leader-ideas.md section 9)
- [ ] Name trip lead, tech contact, safeguarding lead, who holds medical info.
- [ ] Decide data policy, retention date, and whether anyone is under 18.
- [ ] Insurer/church: waiver wording and whether health info may be stored digitally.
- [ ] Printed emergency card and leader binder; official fallback chat; eSIM decision.
- [ ] Calendar: forms 8 weeks out, passports verified 12 weeks out, weekly manual backup, cleanup 30 days after return.
- [ ] Replace placeholder icons with real art.
- [ ] Seed content before invites: pre-approved emails, welcome announcement, itinerary, to-dos (notifications, paperwork), verse set, first poll.

## 5. Recommended order for the next 2 weeks

Principle: finish what is cheap, static and high-stakes first; then verify on real phones; then add engagement hooks that reuse existing crons.

**Week 1 (trip safety and onboarding, all S)**
1. Owner day 1 (no code): confirm migrations 0010-0019, SMTP, env vars, pre-approve all 35 emails, make leaders admins. Without these nothing else matters.
2. Real-iPhone pass on 2 phones with the SETUP checklist; log bugs. (Owner)
3. Emergency/contacts page + `content/emergency.json` + add to service worker cache + link from Home. (H, S)
4. Privacy notice and consent line on login and `/me`; decide about passport uploads and EU region. (H, S)
5. CSV export (roster, to-do status) with a log line. (H, S)

**Week 2 (leader tools and engagement, mostly S)**
6. "Needs attention" per-person list on Overview (overdue, no uploads, no push). (H, S)
7. Post-trip cleanup action (so the data rule is true from day one). (H, S)
8. Re-engagement push for lapsed learners + goal milestone pushes (25/50/75%) in the streaks cron; add a stretch target plan for the goal. (H, S)
9. Weekly learning recap added to the Monday email. (H, S)
10. Native-speaker review kickoff: send the curriculum review list, glossary and Three Circles French to the reviewer now (they are the long pole, outside your control).

**Leave for February or later (or never)**
- Headcount check-in, buddy/room fields and the "I need help" button: build in January (M); until then use a poll as check-in and a pinned announcement for pairs/rooms.
- Targeted push by team: January, only if teams will be used on the trip.
- Leader role / medic flag: skip unless you decide to store health data (better: keep health data on paper).
- Flight info table, payments tracking, prayer requests, testimony journal, evangelism contact log, photo hosting, live location, chat, e-signatures: leave out (see risks in the ideas doc, section 7).
- Streak freeze, weekly team challenge, daily verse card: nice, schedule after the above if engagement data shows drop-off.
- Leaders' learning-progress table: only after RLS is reviewed; frame as private encouragement.
