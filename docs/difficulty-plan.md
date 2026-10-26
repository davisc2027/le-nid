# Difficulty plan: limiting typed production

Status: built (see docs/curriculum.md section 3 for the shipped rules). Original build order: section 8. Scope: `lib/french/exercises.ts`,
`lib/french/lexicon.ts` (read only), `components/french/ExerciseViews.tsx`, `components/french/LessonPlayer.tsx`,
`app/(app)/french/practice/page.tsx`, `scripts/check-curriculum.mjs`, `docs/curriculum.md`.

**The owner's complaint.** Early on, learners are asked to type whole sentences ("Translate into French: Have you lived
here long?", hint `V___ h______ i__ d_____ l________ ?`). They have no grammar yet, and most of the 35 have no
French at all. They practise on iPhones before a March 2027 trip.

## 1. Audit (measured with the real engine)

Method: a scratch script imported `lib/french/exercises.ts` through the same loader hooks as
`scripts/check-curriculum.mjs`. It built every lesson 150 times, built a 3-phrase review tail at every course position
(drawn from all earlier lessons) and built a 10-phrase practice set at every position. "Typed" means `type` (English
to typed French) plus `listen` (typed dictation). Word counts use the engine's `nWords`; characters are counted after
`normalize`. Units are listed in course order.

### 1.1 How the engine decides today

* `stageOf(i)` splits the course by position: stage 0 is lessons 1 to 18 (index < 18), stage 1 is lessons 19 to 39
  (from u2-l2) and stage 2 is lessons 40 to 60 (from u15). The split falls in the middle of u2.
* A lesson has a match round, a first pass (`FIRST[stage]`) and a second pass (`SECOND[stage]`). Stage 0's second
  pass already includes `type` (1) and `listen` (1.5).
* Typing length caps (`TYPE_MAX`) are 4, 6 and 8 words. Listening caps (`LISTEN_MAX`) are 5, 7 and 8 words.
* In stage 0 the letter hint is open from the start. It covers the **whole sentence**.
* **`buildReview` and `buildPractice` always use stage 1, whatever the learner's level.** So from lesson 2 on, a
  review can ask them to type a 6-word sentence or take a 7-word dictation, and the hint stays closed.
* `noAudioFallback` turns a `listen` item into a `type` item with no length check.

### 1.2 Ramp per unit (mean per lesson; core lesson + review tail)

| Unit (lessons) | Phrase words median/max | Typed per lesson (core + review) | Of which dictation (core) | Typed words mean / max | Typed chars max | Typed items ≥4 words per lesson |
|---|---|---|---|---|---|---|
| u0 (1-2) | 1/4 | 2.3 + 1.2 = **3.5** | 1.3 | 1.4 / 4 | 15 | 0.2 |
| u1 (3-6) | 2/6 | 1.6 + 1.0 = **2.6** | 1.0 | 2.2 / 5 (review: **6**) | 33 | 0.2 |
| u11 (7-8) | 4/5 | 1.3 + 1.0 = 2.3 | 0.9 | 3.3 / 5 (review 6) | 35 | 0.6 |
| u12 (9-10) | 4/7 | 1.0 + 0.9 = 1.9 | 0.6 | 3.5 / 5 (review 6) | 36 | 0.7 |
| u5 (11-15) | 1/6 | 2.3 + 0.9 = 3.2 | 1.2 | 1.5 / 5 (review 7) | 36 | 0.4 |
| u13 (16-17) | 2/4 | 1.9 + 0.9 = 2.8 | 1.1 | 1.8 / 4 (review 6) | 36 | 0.3 |
| u2 (18-21) | 6/8 | 1.8 + 0.9 = 2.7 | 0.9 | 4.3 / 7 | 42 | 1.3 |
| u3 (22-25) | 5/7 | 2.4 + 0.9 = 3.3 | 1.2 | 3.7 / 7 | 42 | 1.8 |
| u9 (26-29) | 3/5 | 2.2 + 0.9 = 3.1 | 1.0 | 3.4 / 7 | 37 | 1.1 |
| u4 (30-33) | 5/8 | 2.0 + 0.9 = 2.9 | 1.0 | 4.6 / 7 | 43 | 1.9 |
| u14 (34-37) | 5/7 | 2.3 + 0.9 = 3.2 | 1.1 | 4.4 / 7 | 41 | 1.7 |
| u6 (38-39) | 5/7 | 2.3 + 0.8 = 3.1 | 1.1 | 4.2 / 7 | 42 | 1.9 |
| u15-u18 (40-60) | 4-6/9 | 3.5-3.8 + 0.8 = **4.3-4.7** | 0.9-1.0 | 4.2-6.1 / 8 | 45 | 2.6-3.9 |

Practice (10 items) holds about 2 typing and 1 dictation items at **every** level (typed words max 6 to 7, from lesson 2).

```
Typed answers per lesson today (core + review), one # = 0.25
u0   ##############   3.5   <- lesson 1 already has a dictation
u1   ##########       2.6
u11  #########        2.3
u12  ########         1.9
u5   #############    3.2
u13  ###########      2.8
u2   ###########      2.7
u3   #############    3.3
u9   ############     3.1
u4   ############     2.9
u14  #############    3.2
u6   ############     3.1
u15+ ##################  4.4 (average over u15-u18)
```

**Findings.**

1. **The ramp is flat.** Brand-new learners type about as much as learners in the middle of the course (2 to 3.5
   answers per lesson), and lesson 1 already has a dictation. Only the length grows, and slowly. Nothing ever
   rises gently from zero.
2. **Review and practice ignore the learner's level.** They are where the owner's example comes from. *Vous habitez ici
   depuis longtemps ?* (u1-l3, 5 words) is never a typing item inside its own lesson (stage 0 caps typing at 4
   words). But when it comes up in review it is a typing item 15% of the time, and in practice 17%, from lesson 5 on.
3. **The hint shows the shape of the whole sentence,** which says "write all of this". Underscores also run together
   on a phone screen, so `l_________` cannot be counted.
4. **Dictation is the hardest typed task** (hear it, segment it, spell it), and it starts in lesson 1.
5. **Grading bugs.** `normalize` strips `œ`, so *coeur* is marked **wrong** for *cœur* (and *oeuvres* for *œuvres*),
   although `docs/curriculum.md` says `oe` is accepted. The one-typo rule accepts *Dieu nous aime* for *Dieu vous
   aime*, a listed `NEAR_MISS` whose meaning differs. On the other side, a 33-character sentence with two small
   slips is rejected (*vous habites ici depuis longtemp*).
6. **Wrong options include words not yet taught:** 21% of gap-fill wrong options and 14% of word-bank decoys are words
   the learner has not met by that lesson (*Une* and *Le* in u0-l2, *Où* in u11-l1).

## 2. Learning science applied

| Principle (by name) | What it says | Consequence for this app |
|---|---|---|
| Comprehension before production (Krashen's input hypothesis; VanPatten's input processing; the "silent period") | Beginners need lots of understood input before output pays off | Tiers 0 and 1 are almost all recognition and assembly |
| Receptive-to-productive hierarchy (Nation; Laufer and Goldstein's levels of vocabulary knowledge) | Recognising a word < recognising it from its meaning < recalling it from a cue < recalling it from meaning alone | The ladder runs pick/choose → tiles → one typed word with its first letter shown → short sentence with a hint → sentence |
| Scaffolding and fading (Wood, Bruner and Ross; Vygotsky's zone of proximal development; completion problems and fading worked steps in van Merriënboer, Renkl and Atkinson) | Give support, then remove it bit by bit | Tiles → first-letter cloze (fill in the blank) → partial typing → full typing, per unit, with the hint reduced at each stage |
| Cognitive load theory (Sweller) and the expertise reversal effect (Kalyuga) | Novices' working memory is quickly overloaded; what helps experts can swamp novices | No spelling, segmenting and grammar at the same time early on; long items stay on tiles |
| Desirable difficulties (Bjork) | Difficulty helps only when the learner can still succeed | Raise difficulty only after the easier rung is mastered; step down after misses |
| Errorless learning (Baddeley and Wilson) | Early errors get rehearsed | In tier 0 a miss is close to impossible: 3 options and 1 decoy tile, so no free recall |
| Generation effect (Slamecka and Graf) | Producing an item beats reading it | Generating one key word (cloze) gives most of the benefit at a fraction of the load |
| Retrieval practice and spacing (Roediger and Karpicke; Cepeda et al.; FSRS via ts-fsrs) | Testing and spacing beat restudying | Keep FSRS. Review difficulty follows the learner's tier, never a fixed stage |
| Interleaving (Rohrer and Taylor) | Mixed practice helps discrimination | Keep mixed kinds and the no-repeat rule; review mixes units |
| Formulaic sequences (Pawley and Syder; Wray; Lewis's lexical approach) | Adults gain fluency from memorised chunks before grammar | Phrases are taught as chunks: build them from tiles, type only a key word inside the chunk |
| Transfer-appropriate processing (Morris, Bransford and Franks) | Practise the way you will use it | On the trip the team will listen and speak, not write French. Typing stays limited; listening and Say-it (shadowing) steps carry production |
| Output hypothesis (Swain) | Production pushes noticing | Full production does arrive, in tiers 3 and 4, once there is something to produce |
| Shadowing (interpreter training and EFL practice) | Repeating audio aloud builds sound and rhythm | Existing speak steps; open question 3 |
| Self-determination theory (Ryan and Deci) | Competence, autonomy and relatedness drive motivation | Early wins (competence); a "Use tiles" escape (autonomy). Odile and the team context (relatedness) stay |
| Loss aversion (Kahneman and Tversky) | Losses loom larger than gains | Streaks motivate but punish; no new loss mechanics, and no hearts or lives |
| Feedback research (Hattie and Timperley; Kluger and DeNisi; Lyster and Ranta) | Feedback on the task helps; feedback on the self hurts; a pointed prompt beats a bare "wrong" | Name the one wrong word and why; "Almost"; never a score of the person |
| Short sessions + spacing | Attention drops; spacing beats massing | Keep 12-15 + 3 per lesson; limit how often misses come back (5.4) |
| What Duolingo does | Beginner lessons default to word-bank translation, matching and tap-what-you-hear; on mobile, typing is opt-in through a keyboard toggle; word banks are withdrawn only in harder modes | Same shape: tiles by default early, typing late, a toggle to switch |

**Phone and adult context.** On an iPhone with an English keyboard, accents need a long press, and autocorrect fights
French. Grading already ignores accents, and it must say so (it does: "Accents and small typos are fine"). Every
typed item costs far more time and frustration than a tap, so each one has to earn its place. Adults with no French
want to understand *why*, so short glosses ("habitez = live") help more than letter shapes.

## 3. Rules

### 3.1 Tiers (by unit, in course order)

Add `UNIT_TIER` in `lib/french/exercises.ts` and replace `stageOf` with `tierOf(lessonIndex)`, which returns the tier of
that lesson's unit. A unit missing from the map falls back to the tier of the unit before it. The check script fails on
a unit missing from the map.

| Tier | Name | Units | Lessons (1-based) |
|---|---|---|---|
| 0 | Recognise | u0, u1 | 1-7 |
| 1 | Build | u11, u13, u12, u5 | 8-20 |
| 2 | Short recall | u2, u3, u9 | 21-33 |
| 3 | Supported sentences | u19, u4, u14, u6 | 34-46 |
| 4 | Free recall | u15, u20, u8, u16, u7, u17, u10, u18, u21 | 47-72 |

(After the simplification pass of [curriculum-simplification-plan.md](curriculum-simplification-plan.md): 72 lessons, with
the part-2 units u19 and u20 and the optional end unit u21. The table in the original plan was 1-6, 7-17, 18-29, 30-39,
40-60 with 60 lessons.)

```ts
export const UNIT_TIER: Record<string, Tier> = { u0: 0, u1: 0, u11: 1, u13: 1, u12: 1, u5: 1, u2: 2, u3: 2, u9: 2,
  u19: 3, u4: 3, u14: 3, u6: 3, u15: 4, u20: 4, u8: 4, u16: 4, u7: 4, u17: 4, u10: 4, u18: 4, u21: 4 };
```

### 3.2 Typed-production limits (the immediate rule set)

Words are counted with `nWords` and characters with `normalize(fr).length`. "Typed items" counts `type`, `cloze` and
`listen` together.

| Rule | T0 | T1 | T2 | T3 | T4 |
|---|---|---|---|---|---|
| Typed items per core lesson (max) | **0** | 2 | 3 | 4 | 5 |
| Typed items in the review tail (max) | 0 | 1 | 1 | 1 | 2 |
| Typed items per 10 practice items (max) | 0 | 2 | 3 | 3 | 4 |
| `cloze`: blanks per item | - | 1 | 1 (2 if the phrase has ≥5 words) | 1-2 | 1-2 |
| `type` (full typing): max words / max chars | **none** | 1 / 12 (single-word phrases only, e.g. *Trois*, *Lundi*) | 3 / 18 | 4 / 24 | 6 / 32 |
| `listen` (typed dictation): max words / max chars | **none** | **none** | 3 / 18 | 4 / 24 | 5 / 28 |
| `bank` with audio ("tap what you hear"): max words | 4 | 6 | 8 | any | any |
| `bank`: max answer tiles / decoy tiles | 6 / 1 | 8 / 2 | any / 2 | any / 2 | any / 2 |
| Wrong options per choose/hear/pick | 2 | 3 | 3 | 3 | 3 |
| Audio-only choose | 0% | 0% | 25% | 35% | 50% |
| Gap and bank decoys must be words already taught | yes | yes | no | no | no |

Phrases above a cap are never typed; they use bank (or cloze from T1). Data check: under these caps, the share of
phrases taught so far that can be full-typed is 0/44 at the end of T0, 37/131 at the end of T1 (numbers and one-word
faith words), 120/226 at the end of T2, 183/299 at the end of T3 and 384/468 by the end. Cloze works on 446 of the 451
multi-word phrases. The other 17 phrases (*Il y a*, *La Bible*, *Pouvez-vous m'aider ?*, *Le Saint-Esprit*...) have no
usable word to blank, so they fall back to bank.

**Where full typing first appears:** 1-word answers in lesson 7 (T1), sentences of up to 3 words in lesson 18 (T2),
4 words in lesson 30 (T3), 5 to 6 words in lesson 40 (T4). Dictation first appears in lesson 18. (In the 72-lesson course after the simplification pass these are lessons 8, 21, 34 and
47.) The owner's example
becomes a bank item in T0, `Vous h······ ici depuis longtemps ?` (one word typed) from lesson 7, a two-blank cloze in
T3, and a full sentence only from lesson 40.

### 3.3 New exercise forms

* **`cloze`** (typed blank in a frame):
  `{ kind: "cloze"; en: string; fr: string; tokens: string[]; blanks: number[]; shapes: string[] }` plus `Base`.
  `tokens = tokenize(fr)`. The UI renders the tokens with an inline `<input>` for each index in `blanks`. The
  placeholder is that token's shape (3.4), and any trailing punctuation shows after the input. Blank candidates:
  the token core (`TAIL` stripped) is 2 to 12 letters, letters only (no `'` or `-`), not capitalised unless it is the
  first word, not in `TU_WORDS`, and not in the stop list `le la les un une des de du et en ou je il on ce se ne pas
  que qui me vous nous est ai au aux y a à`. Prefer words with a `GLOSS` entry or a verb family (70%), else the longest
  word. Two blanks are never next to each other. The English prompt is shown above the frame.
* **`bank` with `audio: true`:** the English is hidden, a `Speaker` plays the French (autoplay as in `Listen`), and the
  English shows in the feedback card. `noAudioFallback` turns it into a plain bank.
* **"Use tiles instead"** (a small link under the input on `type`, `cloze` and `listen`) swaps the item for its
  step-down (5.4), with no penalty. It is always offered (autonomy).

### 3.4 Hint format

1. **New `shapeOf(word)`**: the first letter, then `·` (U+00B7) for each further letter, keeping `'` and `-` with the
   letter after them restarting the count. Examples: `m'a·····` (m'appelle), `h······` (habitez), `Q·'e··-c·` (Qu'est-ce). It replaces `letterHint`'s
   underscores, which merge on a phone. Keep `letterHint` exported (now built on `shapeOf`), because a build in progress
   elsewhere may import it.
2. **Cloze**: the shape is the input's placeholder. There is no other hint; the rest of the sentence is visible.
3. **`type`** gets two-step hints instead of one string: `gloss?: string` (from `glossHint`, for example
   `habitez = live · ici = here`) and `shapes: string[]` (one per token). The first tap shows the gloss, the second
   shows the shapes as chips (`font-mono`, `flex-wrap`, one chip per word). If there is no gloss, the first tap shows
   the shapes.
4. **Open by default:** T1 and T2 `type` items show the shapes (they are one to three words). In T3, the first `type`
   item of a lesson shows them. T4 hides them behind the taps.
5. Using a hint is never a miss. The player records it (`hinted` set) for the adaptation in section 6.
6. `listen` keeps no letter hint; its help is the Slow button (already in `Speaker`).

## 4. Lenient grading

Replace the body of `isCorrect` with a richer `grade` and keep `isCorrect(given, expected) = grade(given, expected).ok`
so callers keep working.

```ts
export type Grade = { ok: boolean; fixed?: string; wrong?: { given: string; expected: string; why?: string } };
```

1. **Do not touch `normalize`**: `phraseKey` is built on it, and the two `œ` phrases (*Cela ne vient pas des œuvres*,
   *Si vous croyez dans votre cœur*) would get new keys, orphaning saved cards. Add
   `normalizeAnswer(s) = normalize(s.replace(/œ/gi, "oe").replace(/æ/gi, "ae"))` and use it only in grading.
2. **Exact after normalising:** `ok`. Set `fixed = expected` when the raw input differed beyond case and punctuation
   (missing accents, a typo), so the card can show "Watch the spelling: **première**".
3. **Ignore spaces:** if `g.replace(/ /g, "") === e.replace(/ /g, "")`, it is `ok` with `fixed` (*mappelle*, *sil vous
   plait*).
4. **Same number of words:** compare word by word.
   * If the given and expected words are different members of the same family, and that family is one of the **meaning
     families** `subject, number, day, time, direction, weather, family, body, question`: **wrong**. Set
     `wrong = { given, expected, why: NEAR reason or FAMILY_NOTE }`. This makes *Dieu nous aime* wrong for *Dieu vous
     aime*.
   * Otherwise each word may be off by 1 edit if the expected word has at least 5 letters, and by 0 edits if shorter.
     The whole answer may have at most `max(1, floor(e.length / 12))` edits in total. If it fits, it is `ok` with
     `fixed`. Verb endings, articles and agreement slips are forgiven this way (*habites* for *habitez*), but shown.
   * The first word over its budget becomes `wrong` (for the "One word to fix" feedback).
5. **Different number of words:** keep the old rule (`e.length > 6 && distance ≤ 1`), which catches a lost or extra
   space.
6. **Never accept another course phrase:** if `g` equals `normalize` of any other phrase's `fr` (not this phrase's `tu`
   form), the answer is wrong.
7. The `tu` form is still accepted, with the existing reminder.
8. **Cloze** grades each blank with `grade(word, expectedWord)`. All blanks must pass.
9. **Inputs** get `spellCheck={false}`, `autoComplete="off"` and `enterKeyHint="done"`, and Enter submits. Keep
   `autoCapitalize="none"` and `autoCorrect="off"`.
10. **Feedback card:**
    * `ok` with `fixed`: "Bien ! Watch the spelling: <b>fixed</b>".
    * Wrong with `wrong`: "Almost. One word to fix: you wrote <i>nous</i>, it's <b>vous</b>." and then `why`.
    * Otherwise: the answer, as today.

    No new error sound for typed misses (the current one stays), and no red styling beyond the current `border-primary`.

## 5. Kind mix, review and practice

### 5.1 Weights per tier (replace `FIRST`, `SECOND`, `REVIEW`)

| Tier | First pass | Second pass | Review and practice |
|---|---|---|---|
| T0 | choose 4, hear 3, pick 3 | bank 3.5, gap 2.5, bankAudio 2, pick 2, register 2 | pick 3, choose 2, hear 2, bank 2, gap 1.5, register 1 |
| T1 | choose 3.5, hear 3, pick 3, gap 1.5 | bank 3.5, gap 2.5, cloze 2, bankAudio 2, register 2, pick 1 | pick 2, bank 2.5, gap 2, cloze 1.5, bankAudio 1, hear 1, choose 1, register 1 |
| T2 | choose 3, pick 3, hear 2.5, gap 2.5, bank 1.5 | bank 3, cloze 2.5, gap 2, register 2, type 1.5, listen 1, bankAudio 1 | pick 2, gap 2, bank 2, cloze 2, type 1, listen 0.5, hear 1, choose 1, register 1.5 |
| T3 | choose 2.5, pick 2.5, gap 3, hear 2, bank 2 | bank 3, type 2.5, cloze 2, gap 1.5, listen 1.5, register 2, choose 0.7 | pick 2, gap 2, bank 2, cloze 2, type 1.5, listen 1, hear 1, choose 1, register 1.5 |
| T4 | gap 3, bank 2.5, pick 2, choose 1.5, hear 1.5, cloze 1.5, type 1.5 | type 3.5, bank 3, listen 2, register 2, gap 1.5, cloze 1.5, choose 0.7 | pick 2, gap 2, type 2, bank 2, cloze 1.5, hear 1, listen 1, choose 1, register 1.5 |

`bankAudio` stands for `bank` with `audio: true`. Make it a separate weight key in `pickKind`, and give `make` the case
`"bankAudio"` that returns `{ ...mkBank(...), audio: true }`. The per-kind caps in `CAP` stay as they are. Add the
typed cap from 3.2: once a session reaches its typed maximum, `type`, `cloze` and `listen` are no longer eligible.
`eligible()` takes the tier caps from 3.2. A kind that is not in a tier's weights is never picked, including by the
fallback in `pickKind`, whose fallback list becomes `["pick", "choose", "bank"]`.

### 5.2 Review tail (`buildReview`)

New signature: `buildReview(phrases, prev?, opts?: { frontier?: number; cards?: CardMap | null })`.

* `frontier` is the index of the lesson being played (LessonPlayer passes `ALL_LESSONS.findIndex(l => l.id ===
  lesson.id)`). The context becomes `{ tier: tierOf(frontier), review: true, anchor: undefined }`, so wrong options
  stay anchored to each phrase's own lesson, as today.
* The kind weights come from that tier's review column, and the caps and the typed maximum are the "review tail" row.
* **Per-phrase rule:** full `type` or `listen` only when the phrase's card has `state.reps ≥ 2` and `state.lapses < 2`
  (when `cards` is given). Otherwise use cloze at most.
* `frontier` missing: fall back to tier 1 (safe default), never tier 4.

### 5.3 Practice (`buildPractice`)

New signature: `buildPractice(phrases, opts?: { frontier?: number; cards?: CardMap | null })`. Export
`frontierFromCards(cards)`: the largest home lesson index over the keys in `cards` (via `PHRASE_BY_KEY` and `HOME`),
or 0. `app/(app)/french/practice/page.tsx` needs no change: LessonPlayer already has `cards` and computes the frontier.
Same rules as 5.2, with the practice row of 3.2.

### 5.4 Step-down ladder (used by misses, "Use tiles instead" and adaptation)

`export function stepDown(ex: Exercise, tier: Tier): Exercise` rebuilds the item for the same phrase, one rung down:

| From | To |
|---|---|
| type | cloze (1 blank); if no cloze is possible, bank |
| listen | bankAudio; if the tier does not allow it, hear |
| cloze | bank |
| bankAudio | hear |
| bank | pick |
| gap | pick |
| others | unchanged (returns the same item) |

The result keeps `key`, `review` and `note`. `noAudioFallback` applies to the result as before.

### 5.5 No-audio fallback

`listen` → `cloze` in T2 (keep the cloze caps) and `type` with the shapes open in T3 and T4, but only when the phrase
fits that tier's `type` cap; otherwise `cloze`. `bankAudio` → `bank`. To do this, `noAudioFallback(ex, tier = 4)` gets a
tier parameter, and LessonPlayer passes the session tier.

## 6. Learner-state adaptation (kept simple)

1. **A miss steps down on its retry.** In `LessonPlayer.report`, on a miss, push `stepDown(cur, tier)` instead of
   `q[i]`. Each key is requeued at most twice per session. After the second miss of the same key, show the answer and do
   not requeue it again (the phrase is still rated `Again` in FSRS). Also cap the whole queue at `total + 4`.
2. **Session easing.** Track misses on typed items (type, cloze, listen) in this session. After 2 of them, set
   `eased = true`: every remaining queued typed item is replaced by `stepDown(e, tier)`. Show once, inside the next
   feedback card: "Let's use tiles for the rest of this lesson." This is session-only; nothing is stored.
3. **Lapse-aware review.** This is rule 5.2: phrases with 2 or more FSRS lapses are not full-typed in review or practice.
4. **No automatic step-up.** The tier itself is the step-up. Hint use and "Use tiles" do not change FSRS ratings
   (open question 5).

## 7. Tests to add to `scripts/check-curriculum.mjs`

Add a section "Difficulty ramp". It reuses the generation loops; N defaults to 40. `TYPED = type, cloze, listen`.

1. **Tier map:** every unit in `UNITS` has a `UNIT_TIER` entry; tiers never decrease in course order; the first unit
   is tier 0; tier 4 starts at u15-l1 (lesson index 39 in the original 60-lesson course, 46 now).
2. **Core lessons:** for every lesson and N builds, with `t = tierOf(li)`:
   * typed count ≤ the cap in 3.2;
   * T0 has no `type`, `cloze` or `listen`; T1 has no `listen`, and its `type` items are single words of ≤12 chars;
   * each `type` and `listen` item is within its word and character caps;
   * each cloze has 1 blank (T1), or 1 to 2 blanks with 2 only when the phrase has ≥5 words;
   * each blank is a valid candidate (3.3) and no two blanks are adjacent;
   * the cloze tokens rebuild `fr` exactly when the blanks are filled with their answers;
   * bank decoys and audio-bank caps hold;
   * T0 and T1 gap and bank decoys are words already taught (every normalized word appears in a phrase of a lesson
     ≤ the anchor).
3. **Review at every position:** for `li` from 1 to 59, `buildReview(pickReviewPhrases(lessons before li, …, 3),
   undefined, { frontier: li })`. Typed items ≤ the review-tail cap; word and character caps from `tierOf(li)`;
   every item has `review: true`.
4. **Practice at every position:** for `li` from 0 to 59, build `buildPractice` from 10 random phrases of lessons ≤ li
   with `{ frontier: li }`. Same caps, with the practice row.
5. **Lapse rule:** with fake `cards` where every key has `lapses: 2, reps: 5`, review and practice contain no `type` or
   `listen` items.
6. **Owner regression:** *Vous habitez ici depuis longtemps ?* is never a `type` or `listen` item in any build with a
   frontier index < 39, and never anything typed with a frontier < 6.
7. **No-audio:** `noAudioFallback(e, tierOf(li))` never returns an item over the tier's `type` caps, and never needs audio.
8. **Step-down:** for every kind on the ladder, `stepDown` returns the kind in 5.4 (or its stated fallback) with the
   same `key`, and a T0 step-down never yields a typed item.
9. **Grading table** (exact expectations):
   * `ok`: `coeur`/`cœur`; `si vous croyez dans votre coeur`/`Si vous croyez dans votre cœur`; `je mappelle
     marie`/`Je m'appelle Marie`; `vous habites ici depuis longtemp`/`Vous habitez ici depuis longtemps ?`;
     `un cafe sil vous plait`/`Un café, s'il vous plaît`; `ca va`/`Ça va ?`.
   * wrong: `dieu nous aime`/`Dieu vous aime` (with `wrong.given === "nous"`); `cinq`/`Cent`; `bonjour`/`Bonsoir`;
     `a gauche`/`À droite`; `lundi matin`/`Mardi matin` (if the phrase exists, otherwise a synthetic pair).
   * No two distinct course phrases are accepted for each other (pairwise over all 468; today exactly 1 pair fails).
   * `phraseKey` is unchanged: the two `œ` phrases still have the keys `cela ne vient pas des uvres` and
     `si vous croyez dans votre c ur` (guards against someone "fixing" `normalize`).
10. **Report:** print a per-unit table of typed items per lesson (core, review) and mean/max typed words, like 1.2,
    so the ramp stays visible. Replace the "course third" mix with a mix per tier.

Keep the existing checks; "12 to 18 exercises" still holds (the step-down retries happen in the player, not the
builder). Run `node lib/speech/phase1.test.mjs` too: `withSpeakSteps` must still pass through the new kinds unchanged.

## 8. Build tasks (in order)

1. **`lib/french/exercises.ts`, tiers:** add `type Tier = 0 | 1 | 2 | 3 | 4`, `UNIT_TIER` and `tierOf`; add a `RULES`
   table holding the rows of 3.2 (indexed by tier); change `Ctx` to `{ tier; anchor?; review?; budget: "lesson" |
   "review" | "practice" }`; remove `stageOf`, `TYPE_MAX` and `LISTEN_MAX` (grep first: today only this file uses them).
   Replace `FIRST`, `SECOND` and `REVIEW` with the tier tables in 5.1. Update `eligible`, `pickKind` (typed budget,
   fallback list) and `make` (option counts, audio-only rate, decoys per tier).
2. **`exercises.ts`, cloze and audio bank:** add the `cloze` variant to `Exercise`, `clozeBlanks(p, n)`, `shapeOf`,
   `letterHint` rebuilt on `shapeOf`, and `audio?: boolean` on `bank`. In T0 and T1, `mkBank` and `mkGap` keep only
   decoys that were taught at or before the anchor (take the set of normalized words from `ALL_LESSONS[0..anchor]`); if
   too few remain, use fewer decoys (min 1 for bank). For gap, fall back to `pick` when fewer than 2 options remain.
3. **`exercises.ts`, the `type` item:** replace `hint` and `hintOpen` with `gloss?`, `shapes` and `shapesOpen` per
   3.4, and update `noAudioFallback(ex, tier)` per 5.5.
4. **`exercises.ts`, grading:** `normalizeAnswer`, `grade`, and `isCorrect` as a wrapper,
   per section 4. Export `MEANING_FAMILIES` (names) and make sure `familyOf` gives the family name (it already
   returns `Family` with `name`).
5. **`exercises.ts`, review and practice:** add the `buildReview` and `buildPractice` options, `frontierFromCards`,
   the lapse rule and `stepDown`, per 5.2 to 5.4.
6. **`components/french/ExerciseViews.tsx`:**
   * a new `Cloze` view: inline inputs, shapes as placeholders, inputs at least 2ch wider than the word
     (`size = word length + 2`) and wrapping as a flex row;
   * `Type`: two-step hint and shape chips;
   * `Bank` with audio: `Speaker`, the English hidden until the feedback;
   * the "Use tiles instead" link on Type, Cloze and Listen, which calls a new `swap()` prop;
   * the input attributes in 4.9;
   * `report` passes `fixed` and `wrong` through (extend the `Report` type with an optional 5th argument
     `extra?: { fixed?: string; wrong?: {...} }`).
7. **`components/french/LessonPlayer.tsx`:**
   * the session `tier` (from the lesson index, or `frontierFromCards(cards)` in practice);
   * pass `{ frontier, cards }` to `buildReview` and `buildPractice`, and the tier to `noAudioFallback`;
   * add `case "cloze"` to the view switch;
   * on a miss, requeue `stepDown` with the requeue caps; the `eased` flag and its one-time line;
   * `swap()` replaces `queue[i]` with `stepDown(cur, tier)` and does not mark a miss;
   * the feedback card shows "Watch the spelling" and "One word to fix".

   Do not change how XP, streaks or cards are saved.
8. **`scripts/check-curriculum.mjs`:** add the section 7 tests. The `isMC` and `checkSequence` helpers must accept
   `cloze` (no choices) without failing.
9. **`docs/curriculum.md`:** in section 3, replace the stage table with the tier tables and the caps, add `cloze` and
   the audio bank to the kinds table, and update "Lenient means..." to match section 4. Link this file.
10. **Verify:** run `node scripts/check-curriculum.mjs 80` and `node lib/speech/phase1.test.mjs`, then `npm run lint`
    and `npx tsc --noEmit`, then click through u0-l1, u11-l1, u2-l1 and u15-l1 on a phone-width viewport (375 px):
    the cloze inputs wrap, the shape chips are readable, and the keyboard does not hide Check. Before writing code,
    read the Next.js 16 guide in `node_modules/next/dist/docs/` for anything touching pages (AGENTS.md); these tasks
    are almost entirely client and library code.

## 9. Open questions for the owner

1. **Zero typing in u0 and u1 (lessons 1 to 6):** is that right, or do you want one-word answers (*Oui*, *Merci*)
   typed from lesson 3?
2. **"Use tiles instead":** keep it in tier 4 too (the default here), or hide it there so the late units really
   practise recall?
3. **Speaking:** since the trip is about speaking and listening, should the Say-it (shadowing) steps be on by default
   for everyone? Today they are opt-in.
4. **Pace:** how many lessons will most of the 35 finish by March? If it is about 30, nobody will reach full-sentence
   typing (tier 4, lesson 40). That is fine for speaking, but tell us if you want tier 3 to start sooner.
5. **Hints and FSRS:** should a hint or the tile swap make the card *Hard* instead of *Good*? The default here is no,
   which keeps the pressure low; the cost is slightly less accurate scheduling.
6. **Keyboard challenge:** do keen learners want an opt-in "Typing practice" mode (tier 4 rules at any level)?
7. **Streaks:** keep them as they are, or add a weekly "streak freeze" so a missed day on the trip prep does not feel
   like a loss?
