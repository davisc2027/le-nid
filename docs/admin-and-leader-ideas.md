# Admin and leader ideas for Le Nid

Brainstorm only. Nothing here is built. Written Oct 2026 for a 35-person trip to Strasbourg in March 2027.

Legend. Priority: MUST / SHOULD / NICE. Effort: S (under a day), M (1-3 days), L (a week or more). Free tier: OK (fits Supabase free + Vercel Hobby + web push), CAVEAT (works with a limit), NO (do not do it here).
"Quick win" means it sits on top of existing code and touches only the named files.

## What exists today (basis for this list)

- Roles: `profiles.role` is only `admin` or `member` (0001_core.sql). `profiles.team` is a free-text label set on the Admin page (`setTeam` in `app/(app)/admin/actions.ts`). There is no team-leader role.
- Admin page sections (`app/(app)/admin/page.tsx`): access requests, pre-approved emails, to-dos (done counts per to-do, assign missing, view uploads), announcements, itinerary, meetings and files, verse sets, group goal, people and teams, delete person.
- To-dos already support `requires_upload` (private `todo-uploads` bucket, admin can view via `viewUpload`), due dates, push reminders at 5/1/0 days (`app/api/cron/reminders/route.ts`) and a Monday summary email. This is the natural vehicle for most pre-trip paperwork.
- Push: `lib/push.ts` `sendPushToAll`, plus `announceFile`. Announcements push to everyone. No targeted push (by team or person) except to-do reminders.
- Service worker (`public/sw.js`) caches the app shell and pages visited while signed in, so offline already partly works, but nothing guarantees the key trip pages are cached.
- Not present: emergency contacts, medical info, check-ins, prayer, journal, contact log, photo rules, CSV export, per-person progress view for leaders, audit log.

---

## 1. Pre-trip readiness

| Idea | Pri | Effort | Free tier | Notes |
| --- | --- | --- | --- | --- |
| Paperwork checklist via to-dos with upload (passport photo page, signed waiver, medical release, insurance card) | MUST | S | OK | Already works: create a to-do with `requires_upload`. Quick win: no code. Add a "Required paperwork" template list in docs, and a Needs-attention filter (see section 3). |
| Passport expiry check (must be valid 6 months past return date; Strasbourg trip ends March 2027) | MUST | S | OK | Add `passport_expiry` date on the profile. Leader sees red flag if expiry is before Sept 2027. Store only the date and last-name match, not the passport number. |
| Emergency contact (name, relation, phone) per person | MUST | M | OK | New columns or table `emergency_contacts`, own-row RLS plus admin and leaders read. Form in `components/ProfileForm.tsx`, page `app/(app)/me/page.tsx`. |
| Medical, allergy, medication, dietary notes | MUST | M | CAVEAT | Special-category data under GDPR (see section 6). Collect the minimum: allergies, meds that matter, dietary, "anything leaders must know". Free-text, optional, visible only to named medical/lead roles. Strongly consider paper forms for anything beyond allergies (see "should not be in the app"). |
| Waivers and consent forms | MUST | S | OK | Do the legally binding signature on paper or a real e-sign tool. In-app: to-do "Upload signed waiver" and a leader checklist. Do not treat a tap on a checkbox as a legal waiver. |
| Parental consent for anyone under 18 | MUST | S | OK | Same to-do mechanism, with a `birthdate` or `is_minor` flag so minors get extra to-dos automatically (extend `assignMissing` in `actions.ts`). |
| Fundraising and payment tracking (amount owed, paid, due dates) | SHOULD | M | OK | Table `payments(user_id, amount_due, amount_paid, note)`. Admin-only view and edit; each person sees only their own balance. Record payments manually. Never process money or store card data in the app. |
| Packing list (shared, checkable) | SHOULD | S | OK | Static page, checklist state in localStorage or a small table. Content in `content/` like French units. Include France specifics: Type E plug, light layers for March, rain jacket, scarf. |
| Flight info per person (airline, number, arrival time, seat group) | SHOULD | M | OK | Table `travel(user_id, outbound, return, notes)`. Leader view groups by flight for airport pickups and for knowing who arrives separately. Optional paste of confirmation text. |
| Roommates and teams assignment | SHOULD | S | OK | Teams exist (`setTeam`). Add a `room` text next to `team` in People and teams (`admin/page.tsx`, `setTeam`). Show "My team / my room / my leader" on `/me`. |
| Orientation meeting attendance (who showed up) | NICE | S | OK | Add attended checkbox on meetings; uses `meetings` table; shows in leader dashboard. |
| Visa/entry guidance note (US citizens: ETIAS timing) | SHOULD | S | OK | Static content card plus a to-do. Verify current ETIAS rules closer to date; the rule may be in force by March 2027, so a to-do reminder 90 days out is cheap. |

## 2. During the trip

| Idea | Pri | Effort | Free tier | Notes |
| --- | --- | --- | --- | --- |
| Schedule changes with push, marked as changes | MUST | S | OK | Quick win. When an itinerary item is edited, optionally send a push "Schedule change: ..." Touches `updateItineraryItem` in `app/(app)/admin/actions.ts` plus a checkbox in `admin/page.tsx`. Show a "Changed" badge on `app/(app)/itinerary/page.tsx`. |
| Targeted push (one team, or leaders only) | MUST | M | OK | Extend `lib/push.ts` `sendPushToAll` with a filter by team/role. Needed for "Team 3, meet at the bus". |
| Emergency / contacts screen, one tap from home | MUST | S | OK | Static page reading a small config: hotel address and phone, lead phones, French emergency numbers (112, SAMU 15, police 17), US consulate Strasbourg/Paris, embassy, insurer 24/7 line, nearest hospital (Nouvel Hopital Civil). `tel:` links. Cache in the service worker. Also print it. |
| "I need help / I'm lost" button | MUST | M | CAVEAT | Pressing sends a push to all leaders plus shows last-known location only if the user taps "share my location" once. Must also show "if in danger call 112 first". Web push is not guaranteed delivery on iPhone, so it complements, never replaces, a phone call and a leader phone list. |
| Headcount / check-in ("I'm at the meeting point") | MUST | M | OK | Table `checkins(event_id, user_id, at)`. Leader dashboard shows who has not checked in, with phone numbers. One big button on the home screen when a check-in is open. |
| Buddy system | SHOULD | S | OK | Add `buddy_id` pairs (or triples) set by admin, next to `team`. Show on `/me` and in the check-in list so leaders see buddy of any missing person. |
| Offline access to key info | MUST | M | OK | Guarantee the service worker pre-caches itinerary, emergency screen, meeting points, packing list, and key French phrases. Extend `public/sw.js`. Test in airplane mode on an actual iPhone. |
| Maps and meeting points | SHOULD | S | OK | Per-itinerary-item `location` plus a "Open in Apple Maps" link (`maps://` / `https://maps.apple.com/?q=`). No embedded map tiles needed. Add `location_url` column to `itinerary_items`. Screenshots of the area stored as files work offline. |
| Free-time rules and curfew | SHOULD | S | OK | Pinned announcement or static card: pair up, curfew, areas off limits, never leave a drink, phone charged. Make people tap "I've read it" via a to-do. |
| Daily devotion / debrief prompt | SHOULD | S | OK | Content-only: daily card from a JSON file (verse, one question, one action). Show on home by date. Optional push at 21:00 local via the existing cron (note Vercel Hobby cron runs once a day only; see risks). |
| Prayer requests and answered-prayer updates | SHOULD | M | CAVEAT | Table `prayers(user_id, text, visibility, answered)`. Visibility: team or all, never public. Warn against posting other people's private details. Moderation: leaders can hide. Do NOT use real names of people met in France. |
| Testimonies / daily journal (private by default) | NICE | M | OK | Private entries with an opt-in "share with group" switch. Feeds the post-trip testimony compilation. |
| Photo sharing rules and safety | SHOULD | S | OK | Rules card only, no photo hosting. See risks: do not build photo storage. Rules: ask before photographing people, never photograph minors in France without parent permission, no locations or faces of converts/seekers online, no geotags, no posting during the trip that reveals the group's live location. |
| Evangelism contact log | NICE | L | CAVEAT | Strongly privacy-sensitive; see risks. Prefer a minimal "follow-up card" (first name, general area, interest, prayer need, consent yes/no) with a retention limit, leader-only, deleted after hand-off. |
| Follow-up cards for local church/partners | NICE | M | CAVEAT | Same tiny table as above, exported once to the French partner church and then deleted. |
| Daily "who's where" board for leaders | SHOULD | M | OK | One screen: today's itinerary item, check-in status by team, buddy pairs. |
| Quick polls ("Lunch pick", "Who is feeling sick?") | NICE | M | OK | Anonymous count only for health-related ones. |

## 3. Leader dashboards

Today the Admin page shows done counts per to-do only. Leaders need the inverse, a per-person view.

| Idea | Pri | Effort | Free tier | Notes |
| --- | --- | --- | --- | --- |
| "Needs attention" list: who has not done what (overdue to-dos, missing uploads, no push enabled, never signed in) | MUST | S | OK | Quick win. New section in `app/(app)/admin/page.tsx` using data it already loads (`todo_assignments`, `push_subscriptions`, `profiles`). Group by person, sorted by number overdue. One-tap "Remind" using existing push helper. |
| Per-person profile card for leaders (team, room, buddy, flight, readiness %, last seen) | SHOULD | M | OK | New route `app/(app)/admin/people/[id]/page.tsx`. Medical info shown only if role allows. |
| Readiness score per person and per team | SHOULD | S | OK | Percent of required to-dos done. Reuse the to-do query. Shown in People and teams rows. |
| Engagement and learning progress (French lessons, verses, streak, XP) by person and team | SHOULD | S | OK | Quick win. Data already in `lesson_progress`, `xp_events`, `streaks`, `srs_cards`. Read-only table in Admin (needs admin-read RLS check on those tables). Frame it as encouragement, not ranking; see risks about public shaming. |
| "Who is struggling" signal (no activity in 7+ days, streak lost, behind on lessons) | NICE | S | OK | Derived from the table above; show to leaders only, never in the leaderboard. |
| To-do completion export to CSV | SHOULD | S | OK | Quick win. New route `app/(app)/admin/export/route.ts` (admin-checked) returns CSV of person x to-do status. No library needed. Add a link in the To-dos section of `admin/page.tsx`. |
| Full roster CSV (name, email, team, room, flight, emergency contact) | MUST | S | OK | Same route pattern. Needed as a printable list in case the app is down. Log each export (who, when) because it contains personal data. |
| Weekly leader digest email (extend existing Monday email) | NICE | S | OK | Add an admin-only block to the weekly summary in `app/api/cron/reminders/route.ts` and `lib/email.ts`: top 5 overdue people, new access requests. |
| Audit trail of admin actions (who deleted/changed what) | NICE | M | OK | Table `admin_log`, written from `actions.ts`. Useful with more than two admins. |

## 4. Safety, privacy and legal

Treat this as a checklist for leaders, not just developers. None of this is legal advice; have the sending church or organisation's counsel or insurer review it.

- Minors: confirm whether anyone is under 18. If so, you need signed parental consent, a two-adult rule, a minor-specific photo/communication policy, and a decision on whether a minor's data lives in the app at all. Safest: no minors' health or location data in the app; paper forms held by the lead.
- GDPR: the trip is in the EU and you will collect data (health, contacts) from people in the US. GDPR applies to processing aimed at people in the EU and likely to the French partners' data; US residents' data is mostly outside it, but follow its principles anyway: collect minimum, say why, allow deletion. Health data is special-category and needs explicit consent.
  - Add a plain-language privacy notice (what we collect, who sees it, how long, how to be deleted) linked from the sign-in page and `/me`.
  - Add explicit consent tick for health and emergency-contact data, recorded with a timestamp.
  - Supabase free-tier project region matters: choose an EU region (e.g. Frankfurt) for a new project if health data will be stored. Moving regions later means a rebuild.
  - Supabase free has no point-in-time backups and Vercel Hobby is not for commercial use (this is non-commercial, so fine; check the terms if donations flow through).
- Least access: the admin role sees everything. Introduce narrower roles (section 7) so medical info is visible to 2-3 named people, not all admins.
- Data minimisation list: store allergies and "must-know" medical flags; do not store diagnoses, insurance numbers, passport numbers, or scans of IDs in the app. Passport photo pages are the most sensitive upload on the to-do list; either skip uploading them (leaders carry a paper/encrypted copy) or auto-delete after the trip.
- Retention and deletion: set dates in advance (see section 5). `deletePerson` exists; add "delete all uploads and health data" as a single post-trip action.
- Host-country sensitivities: the app lists evangelism activity. In France, door-to-door evangelism is legal, but publishing names of contacts is a GDPR problem and a safety problem for the contacts. Keep contact info off the app (see risks).
- Local-safety: avoid app screens that show the whole group's live location. Keep the daily schedule for members only (already behind login).
- Device security: advise a phone passcode and that lost phones can still open an installed PWA; add a "sign out of all devices" instruction and a leader-triggered "revoke access" (exists as set-access / delete person).

## 5. Post-trip

| Idea | Pri | Effort | Free tier | Notes |
| --- | --- | --- | --- | --- |
| Thank-you and follow-up announcement with push, plus a final "how to keep the French going" card | SHOULD | S | OK | Quick win with announcements only. |
| Debrief survey (what worked, what to change, spiritual takeaways) | SHOULD | M | OK | Short form table or a Google Form link in a to-do. A link is fine and cheaper. |
| Testimony compilation (opt-in entries to one export) | NICE | M | OK | If journal built: export of opted-in text to Markdown/CSV for a church newsletter. Photos shared separately by leaders. |
| Prayer-partner / supporter updates (outside the app) | NICE | S | OK | Draft a template email; the app should not hold supporters' emails. |
| Data cleanup runbook (30 days after return) | MUST | S | OK | Checklist in `docs/`: delete medical/emergency data, delete `todo-uploads` bucket contents, delete contact log, clear `push_subscriptions`, export a roster CSV for the church's records, then optionally delete non-admin profiles. Quick win: add a "Post-trip cleanup" admin action in `admin/actions.ts` that runs these deletes after a typed confirmation. |
| Archive mode (read-only, hide check-in/help features, keep verses and French for those who want to continue) | NICE | M | OK | Feature flag read by the layout. |
| Free-tier pause awareness | SHOULD | S | OK | Supabase pauses a free project after about a week of inactivity. After the trip, either let it pause deliberately or keep it alive. Back up before pausing. |

## 6. Operations

- Roles beyond admin (SHOULD, M, OK). Extend `profiles.role` check to `admin | leader | member` and add `is_leader()` in a new migration (0012). Leaders: read their own team's readiness, check-ins and emergency contacts, send team push, post announcements to their team. Admins: everything. Optional `medic` flag for medical read access. Touches: new migration, `lib/supabase/server.ts` helpers, `app/(app)/admin/page.tsx` split into leader vs admin view. Do this before collecting health data.
- Backups (MUST, S, CAVEAT). Supabase free has no automated downloadable backups beyond a short daily one; take a weekly manual export: roster CSV, to-do status CSV, and `pg_dump` via the Supabase CLI, stored in an encrypted location by one named leader. Add a calendar reminder; no code needed.
- If the app is down (MUST, S, OK). Make a one-page printable PDF per person and a leader pack: itinerary by day, lodging address and phone, meeting points, emergency numbers, leader phone numbers, team and buddy list, key French phrases. Generate it from the same data (a `/print` route styled for A4/Letter) so it stays current. Also keep the same info in a shared Notes or Apple Notes list and as a WhatsApp/iMessage group. Use a group chat as the official fallback for urgent messages, since push on iPhone can be silent after a force quit.
- Status page and "Is it just me?" (NICE, S). Static card on the login page: if sign-in fails, call/text a leader; here are the numbers.
- Support during the trip (SHOULD, S). Name one tech contact in the group with a phone number; add a "Report a problem" link in `/me` that opens a pre-filled `mailto:` or a simple `problems` table that admins can see.
- Roaming and connectivity (MUST, S). Decide before departure: eSIM or Wi-Fi only? The app needs data for push, translate and sign-in codes. Add to the pre-trip to-do list with a recommended eSIM. Sign-in uses an emailed 8-digit code, which is a problem with no connection: advise everyone to be signed in on the Home Screen app well before travel and to never sign out.
- Sign-in codes abroad (SHOULD, S). Sign-in needs email access; remind people to keep email working abroad. Consider extending session length in Supabase auth settings.
- Vercel Hobby cron limits (CAVEAT). Only daily crons. The current 07:00 UTC reminder is fine. Anything needing "run every 15 minutes" (check-in nudges, timed devotion push) cannot be scheduled on Hobby. Instead trigger such pushes by hand from the Admin page, or use a free external scheduler (cron-job.org) calling a secured route.
- Web push limits (CAVEAT). iPhone push requires Add to Home Screen, iOS 16.4+, and notifications permission; it is best-effort. All critical safety messages need a second channel (group chat or SMS).
- Cost watch (SHOULD, S). Free Supabase DB is 500 MB and storage 1 GB; uploads of photos of passports and waivers for 35 people fit, but compress images client-side. DeepL free is 500k characters per month; Groq fallback has its own limits. Watch `usage_daily`.
- Accessibility of the leader flow (NICE, S). Leaders will use the Admin page on a phone under stress; keep the check-in and help screens to one screen with big buttons.

## 7. Should NOT be in the app, or risky to build

1. Full medical records, diagnoses, insurance numbers, passport scan archives. Collect only allergy/meds flags in the app; keep the rest on paper or in an encrypted leader-only store. Health data on a free tier with no DPA, no audit and no EU residency guarantee is the biggest compliance risk.
2. Live location tracking of members. Battery drain, iOS background limits (a PWA cannot track in the background), privacy and a false sense of security. Offer a one-shot "share my location" in the help button instead.
3. Evangelism contact database with names, phone numbers, photos or religious beliefs of people in France. Religious belief is special-category data under GDPR, and a leak could endanger the person. If anything, record only first name or nickname, general area, a prayer need, and a consent flag, leader-only, deleted after hand-off to a local church. Prefer paper cards.
4. Photo and video hosting. Storage on the free tier fills quickly, photos of minors and of French citizens raise consent issues, and metadata leaks locations. Use a shared album managed by leaders, with the rules in section 2.
5. Payments, card numbers or bank details. Use the church's existing giving system; the app only shows "paid / not paid" if built at all.
6. Legally binding e-signatures. Use paper or a proper e-sign provider.
7. Public leaderboard shaming. The leaderboard exists; make sure "who is struggling" lives only on the leader dashboard, and consider hiding XP ranks of people who opt out.
8. Chat/DM features. Moderation, safeguarding (adult-to-minor private messaging) and retention burden. Use a group chat run by leaders.
9. Anything that relies on timely push as the only safety channel (see web push limits above).
10. Quiz or "readiness" scores that are shown to the group, which can embarrass slower learners; keep them private.
11. Tracking attendance by automatic geofence or Bluetooth. Not reliable in a PWA on iPhone.

## 8. Quick wins on existing code

| # | Quick win | Files it would touch |
| --- | --- | --- |
| 1 | "Needs attention" section: people with overdue/missing to-dos, no push, never signed in | `app/(app)/admin/page.tsx` (new Section, reuse the queries already there) |
| 2 | CSV export of to-do status and of the roster | new `app/(app)/admin/export/route.ts`; link in `app/(app)/admin/page.tsx` |
| 3 | Push on itinerary change with a checkbox, "Changed" badge | `app/(app)/admin/actions.ts` (`updateItineraryItem`), `app/(app)/admin/page.tsx`, `app/(app)/itinerary/page.tsx`, `lib/push.ts` |
| 4 | Paperwork as to-dos with upload (passport page, waiver) | no code; create to-dos on the Admin page |
| 5 | Emergency and contacts page | new `app/(app)/emergency/page.tsx` (static content), link from `components/BottomNav.tsx` or `app/(app)/page.tsx`, cache in `public/sw.js` |
| 6 | Learning-progress table for leaders (lessons, verses, streaks) | `app/(app)/admin/page.tsx`; check admin read policies in `supabase/migrations` |
| 7 | Room and buddy next to team | new migration `0012_*.sql`, `setTeam` in `app/(app)/admin/actions.ts`, People row in `admin/page.tsx`, `app/(app)/me/page.tsx` |
| 8 | Map links on itinerary items | migration adding `location`/`map_url`, `addItineraryItem` and `updateItineraryItem`, `itinerary/page.tsx` |
| 9 | Pre-cache key pages for offline | `public/sw.js` |
| 10 | Post-trip cleanup action with typed confirmation | `app/(app)/admin/actions.ts`, `app/(app)/admin/page.tsx` |
| 11 | Extra admin block in the Monday digest email | `app/api/cron/reminders/route.ts`, `lib/email.ts` |
| 12 | Daily devotion card driven by a JSON file | new `content/devotions.json`, `app/(app)/page.tsx` |

## 9. What we need on our side (non-code)

- Name roles: one trip lead, 2-3 team leaders, one tech contact, one person who holds medical info, one safeguarding lead (especially if any minors).
- Decide data policy: what we collect, who sees it, delete date. Write it in one page and give it to everyone.
- Ask the sending church or insurer: required waiver wording, minors rules, travel insurance with medical evacuation, whether health info may be stored digitally.
- Confirm Supabase region before storing anything sensitive (EU region recommended).
- Paper/offline kit: laminated emergency card per person, leader binder with copies of forms, a printed roster, and a spare battery pack and a local SIM or eSIM plan.
- Dry run in the winter: a full test of push, offline mode, check-in and "help" on real iPhones, ideally at the last prep meeting, including someone on cellular only and someone in airplane mode.
- Partner contacts in Strasbourg: lodging, local church lead, a French speaker's phone number, the nearest hospital and pharmacy, a taxi number.
- Set the calendar: forms due 8 weeks before, passports verified 12 weeks before, payments due dates, cleanup 30 days after return.

## 10. Recommended top 10, in order

1. Paperwork as to-dos with upload, plus a "Needs attention" leader list (items 8.4 and 8.1). Cheapest way to get passports, waivers and consent done on time; builds on existing to-dos. MUST / S.
2. Emergency and contacts screen, cached offline, plus a printed one-pager (8.5, section 6 "If the app is down"). MUST / S.
3. Roster and to-do CSV export, with an export log (8.2). MUST / S.
4. Privacy notice, consent tick and data-retention plan, including EU region decision before collecting health data (section 4). MUST / S.
5. Emergency contact plus allergy/dietary fields on the profile, visible to a small named set of people (section 1). MUST / M.
6. Leader role (and optional medic flag) so not every admin sees sensitive data and team leaders can see their team (section 6). SHOULD / M.
7. Schedule-change push and "Changed" badge, then targeted push by team (8.3, section 2). MUST / S then M.
8. Headcount check-in and buddy pairs, with room and flight info on the leader view (section 2, 8.7). MUST / M.
9. Offline pre-cache of key pages and a real-iPhone dry run (8.9, section 9). MUST / M.
10. "I need help" button that pushes leaders and always shows "call 112 / call lead" plus post-trip cleanup action (section 2, 8.10). SHOULD / M.

Next tier if time remains: prayer requests, daily devotion/debrief cards, payment tracking, learning-progress table for leaders, testimony journal, debrief survey.
