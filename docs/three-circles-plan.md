# Three Circles: learn it, say it, show it (plan only, nothing built)

Status: **plan and mockup**. Mockup: `docs/three-circles-mockup.html` (open it in a browser; screen 2 is interactive).


## 1. What the owner asked for

Add a "Share the gospel: Three Circles" resource under **Learn**:

1. **Learn to say it** (verbally): the words and phrases that help us share it in French, with the phone's French voice.
2. **Show it**: a visual demonstration of the three circles on the phone that toggles **English / Français**, which a team
   member can hold up to someone.
3. **Admins can tweak** all the wording and verses from the admin page.

## 2. Research summary (and its limits)

**Verification gap.** The session's network blocked `namb.net` and `eastwest.org`, so no official page was opened. This
section comes from search-result excerpts plus general knowledge of the method. **The official Life on Mission /
"3 Circles: Life Conversation Guide" is the authority; compare every sentence below with it before shipping.**

* **What it is.** A conversation framework, usually drawn on paper (napkin-style) in about five minutes, by Jimmy Scroggins
  and Steve Wright (*Turning Everyday Conversations into Gospel Conversations*), distributed free by the North American Mission
  Board (NAMB) as a book/print guide and the free "Life Conversation Guide" / "Life on Mission" iPhone app. Southern Baptist
  origin; widely reused by other groups (e.g. the EPC). Described by practitioners as "a framework, not a method".
* **The drawing** (from the excerpts): a circle for **God's Design**, a circle for **Brokenness**, a circle for the
  **Gospel**; an arrow from the Gospel circle labelled **Repent and Believe** (brokenness to gospel), and an arrow labelled
  **Recover and Pursue** (gospel back up toward God's design). Cues: cracked lines in the brokenness circle, a cross by the
  gospel arrow.
* **How a conversation goes** (general knowledge, to confirm): start from a normal conversation and a question that opens a
  faith topic; draw God's design (relationship with God and people, purpose, rest, peace); draw brokenness (sin, and the ways we
  try to fix it ourselves); draw the gospel (Jesus: lived, died for our sin, rose); explain repent and believe; then ask where
  the person would put themselves, and what would be a next step. Scripture references commonly paired: Genesis 1-2, Romans 3:23,
  Romans 6:23, Romans 5:8, Romans 10:9, Ephesians 2:8-9.
* **French.** No French-language edition was found. A Spanish edition exists. So the French here is **our own draft** and needs
  review by a native speaker and the partner pastor. French Protestant vocabulary matters (Bible words, "brisure" vs "brisement",
  "projet de Dieu" vs "dessein de Dieu").
* **Licence.** The guide is free to use but is NAMB's copyrighted material; no reuse terms for the text were found. Plan: write
  **our own wording** (we are not copying the guide), credit "Based on the Three Circles conversation framework (Life on Mission /
  NAMB)", draw our own circles, and **email NAMB for permission/confirmation** before release. Scripture text comes from the app's
  own Bible files (frasbl / English), not from the guide.

## 3. What it looks like (see the mockup)

1. **Learn tab**: a new featured card "Share the gospel: Three Circles" above the lessons.
2. **Page `/learn/three-circles`** with three parts (tabs: Watch, Words, Practice) and an EN / FR toggle on every part.
   * **Watch**: the circles build up step by step (Start, 1 Design, 2 Brokenness, 3 Gospel, Repent and believe, Recover and
     pursue). Each step has the short sentence to say, a verse reference (tap to read it), Back / Next, progress dots.
     **Show them**: full-screen mode (no app chrome, huge circles and text, language toggle, screen stays awake) to hold up to
     someone, like Translate's "Show them".
   * **Words**: the sentences and key words per step with the phone's French voice (normal and slow, existing `lib/french/speech.ts`),
     optional "Say it" mic step using the existing speaking checks (never blocks, no grades), glosses in English.
   * **Practice**: put the steps in order, fill-in-the-word cards, "Pick the next sentence", a role-play that walks the learner
     through saying the whole flow (tap to reveal each sentence), small XP once per day like the culture quiz.
3. **Admin** (Content tab): a "Three Circles" editor for everything (section 5).

## 4. Content and data

* Defaults ship in `content/gospel/three-circles.json`: per language (`en`, `fr`) the page title, circle labels, arrow labels,
  six steps (title, what to say, verse refs), the vocabulary list (`fr`, `en`, step), the conversation openers and closing
  questions, and a `reviewed` flag. Verse text is **not** stored: it is read from `public/bible/{en,fr}` by reference so
  it matches the Bible chosen elsewhere in the app.
* Admin edits are stored as overrides in one new table `app_content (slug text primary key, data jsonb, reviewed boolean,
  updated_at, updated_by)` (migration `0017_app_content.sql`): approved people read, only admins write (restrictive approved-only
  policy plus an admin write policy, same pattern as announcements). The page loads defaults, then deep-merges the override.
  If the table is missing or empty the defaults show and the admin editor shows "Run migration 0017" (the app never breaks).
* Offline: the page and its content are cached (add `/learn/three-circles` to the service-worker shell), the circles are inline
  SVG, no images, so it works in Strasbourg without data. Admin edits appear on next online load.

## 5. Admin editing

Admin, Content tab, new section "Three Circles" (reuses `AdminTabs`, `ActionForm`, the pattern of the verse-set editor):

* Sub-tabs: Intro, 1 Design, 2 Brokenness, 3 Gospel, Arrows, Words, Questions.
* Per field, two boxes (English, Français): circle label, what to say, verse reference, arrow labels, openers; Words tab: add /
  remove / reorder rows (fr, en, step).
* Buttons: **Save**, **Reset this step to the original**, a **Reviewed by a native speaker** checkbox (until ticked, learners see
  a small "Draft French" note on French text; the mockup shows it).
* A live preview link ("Open Watch") and character limits so text fits the circles (labels 24 characters, step text 320).
* Server action `saveGospelContent(slug, patch)` with `requireAdmin()`, validated shape and lengths (zod-like checks in code),
  revalidates `/learn/three-circles`.

## 6. Build plan (ordered, for a Sonnet builder; Opus plans, Sonnet builds)

1. **B0 Review gate**: owner compares section 2 with the official guide and confirms the six steps and verses; get native
   review for the French draft (or build first and review in parallel).
2. **B1 Content**: write `content/gospel/three-circles.json` (our own wording, en and fr), plus
   `scripts/check-gospel.mjs` (both languages complete, lengths within limits, every verse ref resolves in `public/bible`,
   no empty strings, French vocab all have glosses).
3. **B2 Diagram**: `components/gospel/CirclesDiagram.tsx` (inline SVG, props: `step`, `lang`, `labels`; animated build with
   reduced-motion fallback; colours from tokens; high-contrast labels; 390px and landscape; aria-label per step).
4. **B3 Watch + Show them**: page `app/(app)/learn/three-circles/page.tsx`, `components/gospel/CirclesWatch.tsx` (steps, EN/FR
   toggle persisted in localStorage, verse bottom sheet using the Bible loader, full-screen "Show them" with wake lock where
   available, immersive route so the bottom nav hides like lessons).
5. **B4 Words**: `components/gospel/CirclesWords.tsx` reusing `speak()` (slow/normal) and the optional Say-it recorder
   (`components/speech`, `lib/speech`), glosses, Draft-French note.
6. **B5 Practice**: ordering, fill-in, role-play; XP via `award_xp` (source `review`, small, once a day, like the culture quiz).
7. **B6 Learn entry**: featured card on `app/(app)/learn/page.tsx`; add the route to the offline shell in `public/sw.js`
   (bump the cache version); walkthrough step text mention (optional).
8. **B7 Admin editor + migration 0017**: table, RLS, `saveGospelContent`, editor UI, merge logic in `lib/gospel.ts`, tests for
   the merge (defaults, partial override, missing table).
9. **B8 Tests and docs**: Playwright at 390px (all three parts, EN/FR toggle, Show them, admin edit then see it change),
   `docs/three-circles.md` for leaders (how to use it face to face, in 5 minutes), update README/SETUP.
10. **B9 Release checks**: native-speaker review done, `reviewed` flag set, permission email to NAMB sent/answered, pastor sign-off.

Estimated size: about one full Sonnet build session (similar to the polls feature plus the diagram).

## 7. Risks and decisions

* **Accuracy and theology**: this is the heart of what the team says to people. Pastor sign-off on the six steps and the exact
  wording is required; the admin editor lets leaders adjust without a code change.
* **French quality**: our draft is not reviewed. "Draft French" note stays until a native speaker ticks Reviewed.
* **Licence/permission**: see section 2. Our wording and drawing only; email NAMB.
* **Cultural fit in Alsace**: many people are Catholic or Protestant by background; the opener questions should ask about
  background rather than assume unbelief (the neighbours culture cards already cover this). Offer a gentle "next step" close,
  not a pressure close; avoid mission-speak ("target", "lost") in French.
* **Not a substitute for relationship**: the Words tab should include listening phrases ("Racontez-moi...", "Qu'en pensez-vous ?"),
  not only the presentation.
* **Phone as a tool**: holding a phone up is fine for a short moment; also give a "draw it on paper" practice tip.

## 8. Open questions for the owner

1. Is this a tool for all 35 or for a smaller team of "sharers"? (Changes XP and prominence.)
2. Include the "broken behaviours" list (the ways people try to fix brokenness) as a card, or keep to the three circles only?
3. Which French Bible text for the verses: the app's current choice (Sainte Bible libre) or Louis Segond for this section?
4. Should the Show-them screen include a short closing question and a "Plus d'infos" contact line for the partner church?
5. Who reviews the French (native speaker name) and who signs off theologically?
