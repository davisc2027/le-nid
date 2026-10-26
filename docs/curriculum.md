# French curriculum: evaluation and design

Scope: `content/french/units.json`, the exercise engine in `lib/french/exercises.ts` (with the word families in
`lib/french/lexicon.ts`), and the lesson player in `components/french/`. Checks: `node scripts/check-curriculum.mjs`.
The course order and the language load per lesson were reworked in the simplification pass (section 2.1); the current
course is 22 units, 72 lessons and 488 phrases.

## 1. Evaluation (before this change)

I went through the course the way an 18-to-22-year-old beginner who is used to Duolingo would, then measured the
engine by generating every lesson 60 times.

**Testing came before teaching.** A lesson opened with a matching round on phrases the learner had never seen.
Lesson one asked them to match *Bonsoir*, *Salut*, *Au revoir* and *À bientôt* to English with no introduction at all.

**Wrong options were random phrases from the whole course,** so the answer could be found by elimination:

| Measure (lesson exercises) | Before | After |
|---|---|---|
| Wrong options from the same lesson | 0% | 49% |
| ... from the same unit | 8% | 17% |
| ... from units the learner has not reached yet | 46% | 1% |
| Wrong sentence options sharing a French word with the answer | 19% | 41% |
| Answer is the only option with its end punctuation (the lone `?`) | 18% | 0% |
| Answer is the longest option (tie-aware; chance about 25 to 28%) | 25% | 26% |
| Answer is the shortest option | 25% | 26% |
| Matching rounds containing two near-synonyms | 29% | 0% |
| Options that were also a correct answer | about 41 per 2,000 lessons | 0 |

A typical old item: *Où sont les toilettes ?* with the options "Where is the restroom?", "I am allergic to penicillin",
"It's snowing!" and "Shall we take a boat tour?". Only one option is a question about a place, so nobody has to think.
Length was not a tell only because the choice was random. That randomness is also what made items trivially easy.

**Wrong options could be right.** *Salut* also means bye, so "See you later" and "Goodbye" were defensible; the same
went for *Pardon* next to "Excuse me", *À bientôt* next to "See you later", and *Merci* next to "Thank you very much".
In u1-l1 almost every matching round put Salut, Bonsoir, Au revoir and À bientôt side by side.

**Word-bank decoy tiles were random leftovers** from anywhere in the course ("Kehl", "parapluie"). Because they were
unrelated, they were obvious and taught nothing.

**No variety, no progression.** Every lesson in every unit ran match, then about 8 choose, then about 8 word bank,
then 3 listen, in blocks of the same kind (choose 40%, bank 40%, listen 15%, match 5% everywhere). That made 16 to 22
exercises plus 4 review, so up to 26. Unit 10 was exactly as easy as unit 1, and the learner never had to produce
French without tiles.

**Content order.** Numbers came in unit 5, after cafés ("Une table pour quatre"), directions ("à cinq minutes",
"la deuxième rue") and the faith unit. There was no gentle start: lesson one began with full greetings and notes about
register. "Appelez les secours !" sat in the tram-ticket lesson. Key survival words were missing (oui, non,
s'il vous plaît, d'accord, je ne sais pas), as were *Bonne nuit*, *Je vous en prie* (mentioned in a note but never
taught), madame and monsieur, and the numbers 11, 16, 30, 40, 60 and 80 that prices need. Earlier words were rarely
recycled inside new phrases. The u4 to u10 phrases are well chosen and well annotated; the notes are a real strength.

## 2. Content changes

* **New unit u0 "Premiers pas"** (first in the course):
  * u0-l1 "Survival words": oui, non, s'il vous plaît, d'accord, bien sûr, voilà, je ne sais pas.
  * u0-l2 "Sounds and accents": très, un peu, la rue, moi, tu, vous, vous avez, il y a.

  Each note teaches one sound: nasal vowels, silent final letters, è, eu, the French r, oi = "wa", and liaison.
  The unit has its own illustration (a ringing bell) in `components/art/LandmarkArt.tsx`.
* **Numbers moved** to right after greetings (unit order then: u0, u1, u5, u2, u3, u4, u6, u7, u8, u9, u10; see 8.3 for the current order).
  New lesson **u5-l5 "Numbers in real life"**: onze, seize, trente, quarante, soixante, quatre-vingts,
  *Ça fait vingt euros*, *J'ai dix-neuf ans*.
* **Added phrases**, which recycle earlier words and fill gaps for the trip:
  * *Bonjour, madame* and *Bonne nuit* (u1-l1)
  * *C'est à droite ou à gauche ?* (u2-l2)
  * *Deux cafés, s'il vous plaît* (u3-l1)
  * *Je vous en prie* (u3-l2)
  * *Excusez-moi, vous avez un moment ?* (u4-l1)
  * *Venez à notre église dimanche* (u4-l2)
* **Moved**: *Appelez les secours, s'il vous plaît !* from u2-l1 to u8-l3 (emergencies). Its key is unchanged.
* **Gloss sharpened**: *De rien* is now "You're welcome (casual)" (was "You are welcome"), so it cannot be confused with
  *Je vous en prie*, "You're welcome (polite)".
* **`tu` field**: 40 vous phrases now carry their informal version (for example *Pouvez-vous m'aider ?* has
  *Tu peux m'aider ?*). It is shown on the intro card ("With a friend your age"), drives the tu/vous exercise, and is
  accepted when typed, with a reminder to use vous with strangers. It never appears as a wrong option anywhere else.

Totals: 11 units, 37 lessons, 288 phrases (was 10, 34 and 258). **No existing `fr` text or lesson id changed, so no
phrase key changed.**

**Unlock order.** Progress is stored by lesson id, and the French page used to open a lesson only when *every* lesson
before it was finished. Inserting u0 (and moving u5) would therefore have locked existing learners out. The rule is now
"open up to one past the furthest finished lesson" (`app/(app)/french/page.tsx`). For someone going in order this is
the same as before. Existing learners keep everything up to where they were, and u0 shows as open for them, but it is
not required. A learner who had finished only u1 now meets numbers (u5) before directions (u2).

### 2.1 Simplification pass: less complex French early on

Plan, reasoning and measurements: [curriculum-simplification-plan.md](curriculum-simplification-plan.md). The 35 learners
met 10 to 19 new words per lesson from lesson 1 and a 5-word sentence with *depuis* in lesson 5, so the course was
**re-sequenced, not rewritten**:

* No existing `fr` or `en` text and no lesson id changed. The 468 shipped phrase keys and 60 lesson ids are frozen in
  `content/french/shipped.json`; the check fails if one disappears, so saved cards and finished lessons stay valid and no
  database migration was needed.
* Long phrases moved later (96 moves, listed in [curriculum-review-list.md](curriculum-review-list.md)), to a later lesson
  or to two new part-2 units: **u19 Bavarder** (longer small talk, tier 3, after u9) and **u20 En ville, la suite** (longer
  sentences for trams, time and food, tier 4, after u15). 20 short new phrases fill the gaps and four lessons were
  added to existing units (u0-l3, u13-l3, u5-l6, u9-l5).
* **u13 (faith words) now comes before u12 and u5**: Jésus, the Bible, prayer and *Vous êtes invité* are lessons 10 to 12,
  *Dieu vous aime* and *Puis-je prier pour vous ?* are lessons 13 and 14, testimony (*Jésus a changé ma vie*) is lesson 39.
  *Je peux vous parler de ma foi ?* stays early (u12-l2, lesson 14) as a fixed formula and is exempt from the length cap.
* The Christmas-market lines moved to **u21 Marché de Noël (optional)**, the last unit; it is seasonal and not needed for
  the March trip. u10-l2 is now "Alsatian food".
* Basic politeness (*Merci*, *Pardon*, *Excusez-moi*, *De rien*, *Merci beaucoup*) is lesson 3.
* Loads, measured by the check (new words per lesson, a formulaic chunk counting once): T0 mean 6.4 / max 7, T1 7.7 / 9,
  T2 8.8 / 11, T3 9.1 / 13, T4 8.4 / 14 (was 10.5 / 16, 11.6 / 18, 10.9 / 15, 9.5 / 15, 9.1 / 15).
* A lesson of 5 phrases now gets a second turn on its least-recognised phrases, so it still has 12 to 15 exercises.
* **Unlocking** is unchanged ("one past the furthest finished lesson"): lessons inserted before a learner's frontier show
  as open and unfinished, never locked. **Practice** takes its tier from the furthest finished lesson
  (`practiceFrontier`, from `lesson_progress`), not from the cards, because a moved phrase keeps its card and its far-away
  home lesson; **review** draws only phrases that have a saved card.
* The Say-it selection counts the u0 lessons (`U0_COUNT` in `lib/speech/select.ts`) instead of assuming two.

### 2.2 Optional end unit

u21 (id fits the database pattern `u0`-`u30`) is the one unit nobody has to finish. It sits at the very end, is labelled
optional in its title and blurb, and its tier is 4. Its culture card (`christmas-market`) points at u21-l1.

## 3. Lesson flow

1. **Meet the phrases** (`components/french/MeetPhrases.tsx`): one card per phrase with the French, Listen and Slow
   audio, the English, the tu form and the note. Next speaks the following phrase; Back and *Skip intro* are there
   too. Lessons only; review and practice skip it.
2. **Matching round** on up to 5 of the phrases just met: shorter ones first, never two near-synonyms.
3. **First pass**, every phrase once. The first two are warm-ups with 3 options instead of 4, wrong options from
   the lesson that *contrast* with the answer, and a tap-to-reveal hint (word glosses such as "où = where",
   or "It means ..." for listening).
4. **Second pass** on production: the phrases first seen through recognition come back as word bank, audio word bank,
   gap-fill, tu/vous and, by tier, a typed blank (cloze), typing or dictation.
5. **Review**: up to 3 phrases from earlier lessons, continuing the sequence, at the tier of the lesson being played.

How much the learner types, and how much help they get, follows the difficulty tier of the unit
(see [difficulty-plan.md](difficulty-plan.md) for the reasoning and the audit behind it).

Size: 12 to 15 exercises plus up to 3 review, so **18 at most** (missed items still come back at the end). The same
kind never appears twice in a row, and the same phrase never appears twice in a row.

### Exercise kinds

| Kind | Task | Grading |
|---|---|---|
| choose | Read French, pick the meaning. Some are audio-only (hear it, pick the meaning) from tier 2 on | exact |
| hear | Hear French, pick the written phrase among sound-alikes | exact |
| pick | Read English, pick the French among near misses | exact |
| gap | Pick the missing word; options from the same family (articles, verb endings, numbers, days...) | exact |
| register | A situation ("To a shopkeeper", "To a French student your age"): pick the tu or vous version | exact |
| bank | Build the French from tiles, including same-family decoys (1 in tier 0, 2 after) | exact (through `grade`) |
| bank, `audio` | "Tap what you hear": the French is spoken and the English is hidden until the feedback card | exact |
| cloze | The French sentence with one or two words to type (inline inputs; the placeholder shows the first letter and length, `h······`) | lenient |
| type | Type the French for an English prompt; two-step help (word glosses, then letter shapes) | lenient, tu form accepted |
| listen | Type what you hear | lenient |
| match | Tap pairs | - |

"Use tiles instead" is offered under every type, cloze and listen item in every tier, with no penalty: it swaps the
item for tiles. Opening a hint is recorded but never lowers the review rating or counts as a miss.

### Lenient grading

`grade(given, expected)` returns `{ ok, fixed?, wrong? }`; `isCorrect` is `grade(...).ok`. `normalize` and `phraseKey`
are unchanged (saved cards depend on them); grading uses `normalizeAnswer`, which also turns `œ`/`æ` into `oe`/`ae`.

1. Same after normalizing: right. If the raw text differed beyond case and punctuation (a missing accent, a typo),
   the card adds "Watch the spelling: ...".
2. Same once spaces are ignored (*mappelle*, *sil vous plait*): right, with the spelling shown.
3. Same number of words: compared word by word. Swapping two words of the same **meaning family** (subject, number,
   day, time, direction, weather, family, body, question: *nous* for *vous*, *lundi* for *mardi*) is wrong, and the
   card names the word and why. Otherwise a word of 5 or more letters may be off by one edit, shorter words by none,
   and the whole answer by at most `max(1, floor(length / 12))` edits (*habites* for *habitez*).
4. A different number of words keeps the old rule: over 6 letters and one edit (a lost or extra space).
5. Another course phrase is never accepted for this one. The tu form is still accepted, with its reminder.
6. Cloze grades each blank as a word; all blanks must pass.

### Difficulty tiers

`tierOf(lessonIndex)` returns the tier of the lesson's unit (`UNIT_TIER` in `lib/french/exercises.ts`; a missing unit
takes the tier of the one before it, and the check script fails on a missing unit).

| Tier | Name | Units | Lessons |
|---|---|---|---|
| 0 | Recognise | u0, u1 | 1-7 |
| 1 | Build | u11, u13, u12, u5 | 8-20 |
| 2 | Short recall | u2, u3, u9 | 21-33 |
| 3 | Supported sentences | u19, u4, u14, u6 | 34-46 |
| 4 | Free recall | u15, u20, u8, u16, u7, u17, u10, u18, u21 | 47-72 |

Caps (`RULES` in the engine). "Typed" means type, cloze and listen together.

| Rule | T0 | T1 | T2 | T3 | T4 |
|---|---|---|---|---|---|
| Typed items per core lesson (max) | 0 | 2 | 3 | 4 | 5 |
| Typed items in the review tail (max) | 0 | 1 | 1 | 1 | 2 |
| Typed items per 10 practice items (max) | 0 | 2 | 3 | 3 | 4 |
| Cloze blanks | - | 1 | 1 (2 if 5+ words) | 1-2 | 1-2 |
| Full typing: words / characters | none | 1 / 12 | 3 / 18 | 4 / 24 | 6 / 32 |
| Typed dictation: words / characters | none | none | 3 / 18 | 4 / 24 | 5 / 28 |
| Audio bank: max words | 4 | 6 | 8 | any | any |
| Bank: max answer tiles / decoys | 6 / 1 | 8 / 2 | any / 2 | any / 2 | any / 2 |
| Wrong options per choose, hear, pick, gap | 2 | 3 | 3 | 3 | 3 |
| Audio-only choose | 0% | 0% | 25% | 35% | 50% |
| Bank and gap decoys already taught | yes | yes | no | no | no |

Phrases above a cap are never typed (they use tiles, or a cloze from tier 1). Help on a `type` item: tiers 1 and 2
show the word shapes at once, tier 3 shows them on the first typed answer of a lesson, tier 4 hides them behind two
taps (the gloss first, then the shapes). A cloze blank is a 2 to 12 letter word, not a stop word, never next to another
blank, preferring words with a gloss or a verb form.

### Mix per tier

| Pass | T0 | T1 | T2 | T3 | T4 |
|---|---|---|---|---|---|
| First | choose 4, hear 3, pick 3 | choose 3.5, hear 3, pick 3, gap 1.5 | choose 3, pick 3, hear 2.5, gap 2.5, bank 1.5 | choose 2.5, pick 2.5, gap 3, hear 2, bank 2 | gap 3, bank 2.5, pick 2, choose 1.5, hear 1.5, cloze 1.5, type 1.5 |
| Second | bank 3.5, gap 2.5, audio bank 2, pick 2, register 2 | bank 3.5, gap 2.5, cloze 2, audio bank 2, register 2, pick 1 | bank 3, cloze 2.5, gap 2, register 2, type 1.5, listen 1, audio bank 1 | bank 3, type 2.5, cloze 2, gap 1.5, listen 1.5, register 2, choose 0.7 | type 3.5, bank 3, listen 2, register 2, gap 1.5, cloze 1.5, choose 0.7 |
| Review and practice | pick 3, choose 2, hear 2, bank 2, gap 1.5, register 1 | pick 2, bank 2.5, gap 2, cloze 1.5, audio bank 1, hear 1, choose 1, register 1 | pick 2, gap 2, bank 2, cloze 2, type 1, listen 0.5, hear 1, choose 1, register 1.5 | pick 2, gap 2, bank 2, cloze 2, type 1.5, listen 1, hear 1, choose 1, register 1.5 | pick 2, gap 2, type 2, bank 2, cloze 1.5, hear 1, listen 1, choose 1, register 1.5 |

Caps per lesson: listen 2, hear 3, choose 4, register 1. A kind outside a tier's weights is only a last resort (never a
typed one). `type` is allowed by the tier 1 caps (single words) but has no weight there, so tier 1 types through
cloze only.

Typed answers per lesson, as measured by `scripts/check-curriculum.mjs` (core lesson + review tail, 40 generations):

| Unit (lessons) | Tier | Core | Review | Typed words mean / max |
|---|---|---|---|---|
| u0, u1 (1-7) | 0 | 0.0 | 0.0 | - |
| u11, u13, u12, u5 (8-20) | 1 | 0.4-1.2 | 0.2-0.3 | 1.0 / 1 |
| u2, u3, u9 (21-33) | 2 | 1.9-2.1 | 0.6-0.7 | 1.3-1.7 / 3 |
| u19, u4, u14, u6 (34-46) | 3 | 1.7-2.2 | 0.7-0.8 | 1.9-2.0 / 4 |
| u15-u18, u20, u21 (47-72) | 4 | 2.9-3.9 | 0.9-1.1 | 2.7-3.3 / 6 |

### Adaptation inside a session

* A miss comes back at the end one rung easier (`stepDown`: type to cloze, cloze to tiles, listen to audio tiles, tiles
  and gap to pick), at most twice per phrase, and the queue never grows by more than 4.
* After two misses on typed items, every remaining typed item in the session becomes tiles, with one line saying so.
  Nothing is stored.
* Review and practice type a whole phrase only when its saved card has at least 2 reviews and fewer than 2 lapses;
  otherwise at most a cloze. Practice takes its tier from the furthest lesson the learner has finished.
* Nothing steps up automatically: the tier is the step-up.

## 4. Distractor rules

Wrong options for choose, hear and pick (`pickDistractors` in `lib/french/exercises.ts`):

1. **Never correct.** These are excluded:
   * same text after normalizing;
   * a listed near-synonym (`SAME_MEANING`: Salut and Bonjour, Salut and Au revoir, Pardon and Excusez-moi,
     À bientôt and À plus tard, Oui and D'accord...);
   * any pair where one English gloss contains the other ("Thank you" inside "Thank you very much",
     "Hello" inside "Hello, ma'am");
   * the phrase's own tu form;
   * two wrong options that mean the same thing as each other, which would let the learner eliminate both.
2. **Familiar.** Candidates are ranked: this lesson > this unit > recent lessons > older lessons > not met yet
   (strongly penalized).
3. **Same shape.** Rewards go to the same sentence type (? ! .), shared French words and structure, similar word
   count, the same register (vous or not), digits with digits, similar sound (bigram overlap, for listening), and the
   listed near misses (`NEAR_MISS`: bonjour/bonsoir, gauche/droite, tout droit/à droite, merci/de rien, cent/cinq,
   six/dix/seize, deux/douze, froid/chaud, tête/ventre, aller simple/aller-retour, jouer de/jouer au...).
4. **No formal tell.**
   * From the top 10 candidates, a random number (0 to n) are shorter than the answer and the rest longer, so the
     answer's length rank is uniform. Ties go to either side at random.
   * At least one wrong option shares the answer's end punctuation (in practice all of them do).
5. **Warm-ups** use the easy variant: same lesson, but contrasting rather than look-alike, and 3 options.

Gap-fill and word-bank decoys use the word families in `lib/french/lexicon.ts`, which are tight groups first (le, la,
les; parle, parlez, parlons; deux, douze, dix). A word is never blanked, and no decoy is offered, where another option
could be right:

* elided and hyphenated words (l', s'il, pouvez-vous);
* proper nouns;
* sentence-initial verbs (a tu imperative such as *Prends la deuxième rue* would be right);
* object pronouns (*Je le prends* and *Je la prends* both mean "I'll take it");
* tu forms;
* *pour*, *dans* and *en*, which are left out of the families (*travaille pour un café* is close to right, and
  *croire à* is a rare but real alternative to *croire en*);
* *veux* for *voudrais*.

Pronouns after a preposition use the stressed forms (moi, nous, lui, elle, eux). If a phrase has no usable family
word, the word-bank decoys come from the phrases met most recently, never from the whole course.

**Known residual skew:** in gap-fills the answer is the shortest option 32% of the time (chance about 27%), because
closed-class words have few shorter relatives (à, je, parle). Sentence-level options are at chance.

## 5. Feedback

The feedback card is unchanged in structure and keeps Odile, the sounds, missed items returning at the end, and
save, retry and quit. After a miss it shows the answer and one short reason:

* the listed near-miss reason ("Gauche is left, droite is right.");
* otherwise what the picked option actually means ("Bonne nuit means “Good night”." or
  "“See you tomorrow” would be À demain.");
* for gaps, a gloss contrast ("jeudi means “Thursday”; here you need lundi (“Monday”).") or the family rule;
* for tu/vous, why that register.

The phrase note (lightbulb) still shows as before. After checking, the correct option is outlined in green.

## 6. Review, practice and no audio

`buildReview(phrases, prevKind, { frontier, cards })` and `buildPractice(phrases, { frontier, cards })` use the same
kinds and distractor engine, with the weights, caps and lapse rule of the learner's tier (a missing `frontier` means
tier 1, never tier 4). Each
phrase is anchored to its own lesson, so wrong options come from what the learner had already met. `phraseKey`,
`pickReviewPhrases`, `pickPracticeKeys` and the card saving are unchanged. "Can't listen now" turns the rest of the
session audio-free (`noAudioFallback(ex, tier)`): listen becomes a cloze (tier 2) or a typed sentence with its shapes
open (tiers 3 and 4, when it fits the typing cap), audio tiles become plain tiles, hear becomes pick with the same
options, and audio-only choose shows the French text.

## 7. Checks

```
node scripts/check-curriculum.mjs        # 40 generations per lesson, about 30 s
node scripts/check-curriculum.mjs 80     # bigger sample
```

Needs Node 22.18 or later; on an older Node 22, add `--experimental-strip-types`. The script imports the real engine
through small loader hooks, so nothing is copied. It exits 1 when a check fails.

**units.json invariants:**

* ids `^u[0-9]+$` and `^u([0-9]|[12][0-9]|30)-l([0-9]|1[0-9]|20)$` (the pattern `complete_lesson()` accepts in the
  database), numbered l1, l2... with no gaps;
* a lesson's optional `verse` names a key (`JHN 3:16`, `EPH 2:8-9`) that exists in `public/bible/fr`;
* 5 to 10 phrases per lesson (with `CURRICULUM_WIP=1`, for the middle of a restructure, fewer than 5 is a warning and the
  generated-lesson checks skip that lesson);
* `fr` and `en` unique across the file (case-insensitive) and phrase keys unique;
* no stray whitespace, and a space before ? ! : ;
* no tu forms in main phrases, and every tu variant valid;
* every phrase named in `SAME_MEANING` and `NEAR_MISS` exists.

**Generated lessons** (every lesson, many times, plus review, practice, lesson-plus-review and no-audio fallbacks):

* no duplicate options, and none equal after normalizing;
* no option that could also be correct;
* no decoy tile that builds another correct sentence;
* no near-synonyms in a matching round;
* no two same-kind exercises in a row;
* 12 to 18 exercises per lesson, and at most 18 with review.

It prints the length and punctuation tell rates, where wrong options come from, and the exercise mix per tier.

**Difficulty ramp** (section "Difficulty ramp" of the script):

* every unit has a tier, tiers never drop, and tier 4 starts at u15-l1;
* typed counts, word and character caps, cloze blanks, bank tiles and decoys, and "already taught" decoys hold in core
  lessons, in the review tail at every course position and in practice at every position;
* lapsed cards never get full typing; the 5-word sentence from the owner's complaint is never typed before tier 4;
* no-audio fallbacks never need audio; step-downs follow the ladder and tier 0 never steps down to typing;
* the grading table (accents, ligatures, spacing, small typos accepted; meaning swaps rejected; no two course phrases
  accept each other) and unchanged `phraseKey` values for the two `œ` phrases.

It prints the typed answers per lesson for every unit, so the ramp stays visible.

**Language load** (section "Language load", `docs/curriculum-simplification-plan.md` sections 1, 2 and 6):

* every lesson id and phrase key in `content/french/shipped.json` still exists (it may grow, never shrink);
* per lesson: things to remember (new words, a formulaic chunk counting once) at most 7, 9, 11, 13, 15 for tiers 0-4
  (+4 in verse lessons); phrase length in units at most 3, 4, 5, 6, 8 (+1 in verse lessons, +2 when every word is
  already known); mean words per phrase per tier at most 2.5, 3.0, 4.2, 5.0, 6.0; 5-7 phrases in tier 0 and 5-8 in tier 1;
* structure gates by tier (imperative and *est-ce que* from tier 2; *depuis*, *aller* + infinitive, the subjunctive and
  the passé composé from tier 3; the future, the imperfect and *si* clauses from tier 4), with an allow-list of set
  phrases (*C'était un plaisir*, *Jésus a changé ma vie*...), and at most 1 newly introduced structure per lesson in
  tiers 0-1 and 2 in tiers 2-3;
* evangelism milestones: *Jésus-Christ*, *La Bible*, *La prière* by lesson 12; *Dieu vous aime*, *Puis-je prier pour
  vous ?*, *Vous êtes invité*, *Vous pouvez dire non*, *Je peux vous parler de ma foi ?* by 15; *Jésus a changé ma vie* by 40;
* Practice for someone through u1-l3 stays tier 0 although cards of moved phrases belong to far-away lessons, and review
  never picks a phrase without a saved card;
* it prints the load table (lesson, tier, new words, load, words per phrase, units, new structures) and an advisory list of
  culture cards that quote a phrase taught after their lesson. `CAPS_ENFORCING` at the top of the script turns the caps
  into report-only notes while restructuring.

The formulaic chunks that count once are listed in the script (*s'il vous plaît*, *je ne sais pas*, *je ne comprends
pas*, *il y a*, *est-ce que*, *qu'est-ce que*, *ça va*, *c'est*...). *Je peux vous parler de ma foi* is one of them on
purpose: it is taught early as a fixed formula, so its 7 words cost one slot.

Not covered by the script: the UI on a phone (the intro cards, audio autoplay after the first tap, layout of long
options). Check those by hand.

## 8. Faith vocabulary and conversation skills

The learners are a 35-person mission team (18 to 22, mostly beginners) going to Strasbourg. Alsace is historically
Catholic and Lutheran, and today largely secular; in France faith is a private subject, so every faith phrase in the
course is meant to be used respectfully, after asking, and never pushed.

### 8.1 Evaluation (before this change)

**What existed.** Faith language lived almost entirely in unit u4 *Dans la rue* (30 phrases, lessons 20 to 23 of 37):

* u4-l1 *Starting a conversation*: Puis-je vous parler un instant ?, Excusez-moi, vous avez un moment ?, and three
  understanding phrases (Je parle un peu français, Pouvez-vous parler plus lentement ?, Pouvez-vous répéter...).
* u4-l2 *Offering kindness*: Puis-je prier pour vous ?, Dieu vous aime, Que Dieu vous bénisse, Venez à notre église
  dimanche, Merci de votre temps.
* u4-l3 *Talking about faith*: Est-ce que je peux vous poser une question ?, La foi est importante pour moi,
  Est-ce que la foi compte pour vous ?, Je peux vous raconter mon histoire ?, Je respecte votre point de vue,
  Pas de problème, merci quand même.
* u4-l4 *Prayer and encouragement*: Comment puis-je prier pour vous ?, Je vais prier pour vous, Dieu est fidèle,
  Que la paix soit avec vous, Seigneur, merci pour cette journée.

Elsewhere only *Mon père est pasteur* and *Je chante dans une chorale* (u9). The notes in u4 were already good on
culture (laïcité, ask before sharing, a kind exit is a witness too).

**What was missing.**

* The core words: *Jésus* never appeared in the whole course, nor la Bible, l'Évangile, la croix, le péché, le pardon,
  la grâce, le salut, la résurrection, le Saint-Esprit, le culte, la prière.
* Saying who you are (Christians, Protestants, with a local church, not selling anything) and permission-first
  language (*Vous pouvez dire non*, *Seulement si vous voulez*).
* Asking what someone believes, listening (*Ah bon ?*, *Je vois*, *Qu'est-ce que vous en pensez ?*), a short
  testimony, the gospel in short sentences, and the wording of the verses the team memorizes in the Scripture track.
* Responses to the answers people actually give: *Non merci*, *Je n'ai pas le temps*, *Je ne suis pas religieux*,
  *Je suis catholique / musulman / athée*, *Je crois en quelque chose*, and someone who has been hurt by a church.
* Invitations beyond *Venez à notre église dimanche* (Bible study, concert, coffee, bring a friend), praying aloud
  (how French Christians address God with *tu*, *Au nom de Jésus, amen*), prayer requests (*un sujet de prière*) and
  respectful follow-up (first name only, a local church contact).

**Where the order was wrong.**

* Faith was one block. Learners met it at lesson 20 of 37 and then never again.
* Small talk about family, studies and hobbies (u9) came at lessons 31 to 34, *after* the faith unit, so learners
  were taught to ask *Est-ce que la foi compte pour vous ?* before they could say what they study or ask about family.
* Asking someone to speak slowly or repeat sat inside u4 at lesson 20, although it is a day-one survival skill.

### 8.2 Design: a faith thread woven through the basics

The basics keep their place and are not skipped: sounds, greetings, understanding, numbers, directions, the café,
small talk and family all come before the deeper faith units. The faith thread starts small right after greetings and
grows with the learner's French:

1. **After greetings and understanding** (u11, basics): slower please, repeat, write it down, what does that mean,
   and active listening (*Ah bon ?*, *Je vois*, *Je suis d'accord*, *Qu'est-ce que vous en pensez ?*).
2. **u12 Qui sommes-nous ?** Who we are (Christians, Protestants, a student group helping a Strasbourg church, not
   selling anything) and asking first (I don't want to bother you, just two minutes, only if you want, you can say no).
3. **u13 Les mots de la foi**, now right after the understanding phrases and before who we are and the numbers: God, Jesus Christ, the Holy Spirit, the Bible, the Gospel, the
   Lord, the cross; church life (culte versus messe, pasteur, prière / prier, étude biblique, le dimanche matin).
4. **After small talk and family (u9)**, the existing **u4** conversation unit: opening a chat (now with weather and
   neighborhood openers that recycle u9), offering kindness, asking about faith, prayer and encouragement.
5. **u14 La Bonne Nouvelle**: one lesson per verse for Jean 3:16, Romains 3:23, Romains 6:23 and Romains 5:8.
6. **u15 Mon histoire**, after opinions and questions: what do you believe, my story (testimony in 8 short
   sentences), and the good news simply.
7. **u16 Écouter d'abord**: when the answer is no, other beliefs, and when church has hurt.
8. **u17 Sauvés par la grâce**: verse lessons for Éphésiens 2:8-9, Romains 10:9, Jean 14:6 and Apocalypse 3:20.
9. After u10 Strasbourg, **u18 Invitations et prière** closes the course (only the optional Christmas-market unit u21 follows): invitations, praying together, prayer
   requests and follow-up.

Practical units (market, emergencies, hotel, Strasbourg) sit between the faith units, so the thread never runs more
than four lessons in a row except u4 + u14 (eight), where the verses directly continue the conversation unit. The opening
faith lessons (u13, u12) now come as one block of five (lessons 10 to 14), a deliberate choice: faith words first.

**Where a learner can have a respectful faith conversation** (after the simplification pass, 72 lessons). By lesson 14 of 72
(19%) a learner can greet, thank, apologise, ask for slower speech, name God, Jesus, the Bible and prayer, say who the team
is, say *Dieu vous aime*, offer prayer, invite and accept a no (it was lesson 58 of 60). A full conversation (opening,
asking about faith, testimony, offering prayer) is complete at lesson 40 (56%; it was lesson 23 of 37, 62%, and without any
small talk before it), the gospel in short sentences is lesson 49 and kind responses to a no follow by lesson 59 (82%).

### 8.3 Course order

Faith-thread lessons: 26 of 72 (u4, u12 to u18). Faith-thread units hold 189 of the 488 phrases.

| # | Unit | Lesson | Title | Phrases | Thread |
|---|---|---|---|---|---|
| 1 | u0 Premiers pas | u0-l1 | Survival words | 7 | basics |
| 2 | u0 Premiers pas | u0-l2 | Sounds and accents | 7 | basics |
| 3 | u0 Premiers pas | u0-l3 | Thank you, sorry | 7 | basics |
| 4 | u1 Bonjour ! | u1-l1 | Hello and goodbye | 6 | basics |
| 5 | u1 Bonjour ! | u1-l2 | Meeting someone | 6 | basics |
| 6 | u1 Bonjour ! | u1-l3 | Small talk | 5 | basics |
| 7 | u1 Bonjour ! | u1-l4 | Goodbyes | 5 | basics |
| 8 | u11 Pardon ? (new) | u11-l1 | Slower, please | 6 | basics |
| 9 | u11 Pardon ? (new) | u11-l2 | Listening well | 5 | basics |
| 10 | u13 Les mots de la foi (new) | u13-l1 | God, Jesus and the Bible | 5 | **faith** |
| 11 | u13 Les mots de la foi (new) | u13-l2 | Church life | 6 | **faith** |
| 12 | u13 Les mots de la foi (new) | u13-l3 | More faith words | 6 | **faith** |
| 13 | u12 Qui sommes-nous ? (new) | u12-l1 | Who we are | 6 | **faith** |
| 14 | u12 Qui sommes-nous ? (new) | u12-l2 | Asking first | 6 | **faith** |
| 15 | u5 Les nombres | u5-l1 | One to eight | 8 | basics |
| 16 | u5 Les nombres | u5-l2 | Bigger numbers | 8 | basics |
| 17 | u5 Les nombres | u5-l3 | Telling time | 5 | basics |
| 18 | u5 Les nombres | u5-l4 | Days of the week | 5 | basics |
| 19 | u5 Les nombres | u5-l5 | Numbers in real life | 7 | basics |
| 20 | u5 Les nombres | u5-l6 | Today and tomorrow | 6 | basics |
| 21 | u2 En route | u2-l1 | Getting around | 7 | basics |
| 22 | u2 En route | u2-l2 | Directions | 6 | basics |
| 23 | u2 En route | u2-l3 | Tickets and trains | 5 | basics |
| 24 | u2 En route | u2-l4 | Finding your way | 7 | basics |
| 25 | u3 Au café | u3-l1 | Ordering | 8 | basics |
| 26 | u3 Au café | u3-l2 | At the table | 5 | basics |
| 27 | u3 Au café | u3-l3 | A full meal | 5 | basics |
| 28 | u3 Au café | u3-l4 | Dietary needs | 7 | basics |
| 29 | u9 Moi et vous | u9-l1 | About me | 6 | basics |
| 30 | u9 Moi et vous | u9-l2 | Family | 6 | basics |
| 31 | u9 Moi et vous | u9-l3 | Hobbies | 5 | basics |
| 32 | u9 Moi et vous | u9-l4 | The weather | 8 | basics |
| 33 | u9 Moi et vous | u9-l5 | Studies and work | 6 | basics |
| 34 | u19 Bavarder (new) | u19-l1 | More small talk | 6 | basics |
| 35 | u19 Bavarder (new) | u19-l2 | Our group | 6 | basics |
| 36 | u19 Bavarder (new) | u19-l3 | Opinions | 7 | basics |
| 37 | u4 Dans la rue | u4-l1 | Starting a conversation | 8 | basics + faith (opening a conversation) |
| 38 | u4 Dans la rue | u4-l2 | Offering kindness | 7 | **faith** |
| 39 | u4 Dans la rue | u4-l3 | Talking about faith | 5 | **faith** |
| 40 | u4 Dans la rue | u4-l4 | Prayer and encouragement | 8 | **faith** |
| 41 | u14 La Bonne Nouvelle (new) | u14-l1 | Jean 3:16 | 7 | **faith** · verse `JHN 3:16` |
| 42 | u14 La Bonne Nouvelle (new) | u14-l2 | Romains 3:23 | 6 | **faith** · verse `ROM 3:23` |
| 43 | u14 La Bonne Nouvelle (new) | u14-l3 | Romains 6:23 | 8 | **faith** · verse `ROM 6:23` |
| 44 | u14 La Bonne Nouvelle (new) | u14-l4 | Romains 5:8 | 6 | **faith** · verse `ROM 5:8` |
| 45 | u6 Au marché | u6-l1 | Prices and paying | 8 | basics |
| 46 | u6 Au marché | u6-l2 | Shopping | 7 | basics |
| 47 | u15 Mon histoire (new) | u15-l1 | What do you believe? | 9 | **faith** |
| 48 | u15 Mon histoire (new) | u15-l2 | My story | 7 | **faith** |
| 49 | u15 Mon histoire (new) | u15-l3 | The good news, simply | 9 | **faith** |
| 50 | u20 En ville, la suite (new) | u20-l1 | Trams and trains, part 2 | 8 | basics |
| 51 | u20 En ville, la suite (new) | u20-l2 | Finding your way, part 2 | 5 | basics |
| 52 | u20 En ville, la suite (new) | u20-l3 | Times and plans | 7 | basics |
| 53 | u20 En ville, la suite (new) | u20-l4 | Food, part 2 | 6 | basics |
| 54 | u8 Au secours ! | u8-l1 | Asking for help | 8 | basics |
| 55 | u8 Au secours ! | u8-l2 | Feeling unwell | 8 | basics |
| 56 | u8 Au secours ! | u8-l3 | Emergencies | 9 | basics |
| 57 | u16 Écouter d'abord (new) | u16-l1 | When the answer is no | 8 | **faith** |
| 58 | u16 Écouter d'abord (new) | u16-l2 | Other beliefs | 9 | **faith** |
| 59 | u16 Écouter d'abord (new) | u16-l3 | When church has hurt | 8 | **faith** |
| 60 | u7 À l'hôtel | u7-l1 | Checking in | 8 | basics |
| 61 | u7 À l'hôtel | u7-l2 | Everyday needs | 7 | basics |
| 62 | u17 Sauvés par la grâce (new) | u17-l1 | Éphésiens 2:8-9 | 9 | **faith** · verse `EPH 2:8-9` |
| 63 | u17 Sauvés par la grâce (new) | u17-l2 | Romains 10:9 | 7 | **faith** · verse `ROM 10:9` |
| 64 | u17 Sauvés par la grâce (new) | u17-l3 | Jean 14:6 | 7 | **faith** · verse `JHN 14:6` |
| 65 | u17 Sauvés par la grâce (new) | u17-l4 | Apocalypse 3:20 | 8 | **faith** · verse `REV 3:20` |
| 66 | u10 Strasbourg | u10-l1 | Sightseeing | 8 | basics |
| 67 | u10 Strasbourg | u10-l2 | Alsatian food | 5 | basics |
| 68 | u10 Strasbourg | u10-l3 | Alsace and its people | 7 | basics |
| 69 | u18 Invitations et prière (new) | u18-l1 | Invitations | 8 | **faith** |
| 70 | u18 Invitations et prière (new) | u18-l2 | Praying together | 8 | **faith** |
| 71 | u18 Invitations et prière (new) | u18-l3 | Prayer requests | 8 | **faith** |
| 72 | u21 Marché de Noël (optional, new) | u21-l1 | Christmas market (optional) | 5 | basics (optional, seasonal) |

Totals: 22 units, 72 lessons, 488 phrases (the simplification pass added units u19, u20 and u21 with 8 lessons, four lessons in
existing units (u0-l3, u13-l3, u5-l6, u9-l5) and 20 phrases; before it 19 units, 60 lessons, 468 phrases, and before u11 to u18
11, 37 and 288).
200 phrases carry a note and 82 a `tu` form.

**Moved phrases, first pass** (text and key unchanged): *Je parle un peu français*, *Pouvez-vous parler plus lentement ?* and
*Pouvez-vous répéter, s'il vous plaît ?* from u4-l1 to u11-l1; *Nous sommes ici avec notre église* from u4-l3 to
u12-l1. u4-l1 got four small-talk openers in their place. The simplification pass moved 96 more (full list in
[curriculum-review-list.md](curriculum-review-list.md)). **No existing lesson id or `fr` text changed.** Learners
who already finished u4 keep their cards for the moved phrases; their progress is by lesson id and the French page
opens up to one past the furthest finished lesson, so the new units placed earlier never lock anyone out.

### 8.4 Design notes

**Verse lessons.** Eight lessons (u14, u17) carry `"verse": "JHN 3:16"` and so on (type `Lesson.verse` in
`lib/french/content.ts`). Their phrases are short pieces in the exact wording of the Sainte Bible libre pour le monde
(`public/bible/fr`): *Car Dieu a tant aimé le monde*, *Il a donné son Fils unique*, *Quiconque croit en lui*,
*Ne périsse pas*, *La vie éternelle*; *Tous ont péché*, *Privés de la gloire de Dieu*; *Le salaire du péché, c'est la
mort*, *Le don gratuit de Dieu*, *Jésus-Christ notre Seigneur*; *Dieu manifeste son amour envers nous*, *Alors que
nous étions encore pécheurs*, *Christ est mort pour nous*; *C'est par la grâce que vous êtes sauvés*, *Par le moyen
de la foi*, *Cela ne vient pas de vous / des œuvres*, *C'est le don de Dieu*, *Afin que personne ne puisse se
glorifier*; *Jésus est Seigneur*, *Dieu l'a ressuscité des morts*; *Jésus lui dit*, *Je suis le chemin, la vérité et
la vie*, *Personne ne vient au Père que par moi*; *Je me tiens à la porte et je frappe*, *Si quelqu'un entend ma
voix*, *Et ouvre la porte*, *J'entrerai chez lui*, *Je prendrai le repas avec lui*, *Et lui avec moi*. A few
phrases around them recycle the key word in everyday French (*C'est gratuit*, *Personne n'est parfait*,
*Jésus frappe à la porte*), and each lesson ends with the reference read aloud (*Romains, chapitre six, verset
vingt-trois*), which also recycles numbers.

* The course uses the straight apostrophe; the Bible text uses ’. Phrase keys and typed answers ignore the
  difference, and *œ* can be typed *oe*.
* Romains 10:9 speaks to the reader with *tu*, which main phrases may not contain. The phrase is the vous version
  (*Si vous croyez dans votre cœur*) and the exact verse wording is its `tu` form (*Si tu crois dans ton cœur*), shown
  on the intro card, accepted when typed and explained in the note.
* The intro (`MeetPhrases`) shows one small link on the first card, "Words from Jean 3:16 · learn the verse by
  heart", to `/scripture/learn?ref=...`. It finds the lesson's verse from its phrases, so `LessonPlayer` is unchanged.

**The gospel is never one long phrase.** u15-l3 tells it in nine short sentences: Dieu nous aime · Nous avons tous
péché · Le péché nous sépare de Dieu · Jésus est mort sur la croix pour nous · Il est ressuscité · Il nous offre son
pardon · La repentance, c'est se tourner vers Dieu · Par la foi, nous recevons ce cadeau · Voulez-vous le connaître ?
The first five or six are the short outline; the wording stays close to the verses above and to mainstream
Protestant evangelical usage (grace, faith, repentance, the cross and the resurrection; nothing beyond them).

**Register and gender.** Strangers get vous; 41 new phrases carry their tu form. Prayer is the one exception taught
on purpose: *Seigneur, bénis Marie* uses the tu imperative because French Christians speak to God with tu (said in
the note). Gendered forms are avoided or explained: *Nous sommes chrétiens* (mixed group; the note gives chrétien /
chrétienne), *Je crois en Dieu* instead of *je suis croyant*, *Dieu m'a pardonné* (never agrees), and notes for
*pressé(e)*, *invité(e)*, *écouté(e)*, *désolé(e)*, *blessé(e)*, *religieux / religieuse*, *protestant(e)*,
*musulman(e)*. Typing *écoutée* for *écouté* is accepted (one letter); *chrétienne* is only in a note, so no learner
is marked wrong for her own gender.

**Distractors stay honest.**

* `SAME_MEANING` gained pairs that could both be right:
  * D'accord / Oui / Bien sûr / C'est vrai with Je suis d'accord; Je comprends / Je vois; Je ne sais pas / Je ne sais
    pas trop;
  * Je respecte votre point de vue / avis; Bonne journée / Je vous souhaite une belle journée; Pas de problème,
    merci quand même / Pas de souci; Merci, c'est gentil / Merci, ça me touche;
  * Comment allez-vous ? and Ça va ? / Comment vous sentez-vous ?; Qu'est-ce que vous recommandez ? / Qu'est-ce que
    vous me conseillez de visiter ?;
  * Puis-je prier pour vous ? / Je peux prier pour vous maintenant ?; Comment puis-je prier pour vous ? / Avez-vous
    un sujet de prière ?; Je suis athée / Je ne crois pas en Dieu;
  * the same truth in other words: Dieu / Le Seigneur, Jésus-Christ / Le Fils de Dieu, Christ est mort pour nous /
    Jésus est mort sur la croix pour nous, Il est ressuscité / Dieu l'a ressuscité des morts, and Dieu nous aime or
    Dieu vous aime / L'amour de Dieu / Dieu manifeste son amour envers nous.

  Glosses that contain each other ("Eternal life" in "Eternal life in Jesus Christ", "All have sinned" in "We have
  all sinned", "Sorry" in "I'm truly sorry") are already blocked by the gloss rule.
* `NEAR_MISS` gained the classic confusions, each with its reason: Salut / Le salut, La croix / Je crois en Dieu
  (same sound), Prier / La prière, Je vous en prie / Je prie tous les jours, Dieu vous aime / Dieu nous aime,
  Croyez-vous en Dieu ? / Je crois en Dieu, Je crois en Dieu / Je crois en quelque chose, Le don gratuit de Dieu /
  C'est le don de Dieu, Cela ne vient pas de vous / des œuvres, Jésus est Seigneur / Jésus-Christ notre Seigneur,
  Le culte / La messe, Je suis catholique / protestant, Nous sommes protestants / Je suis protestant, Merci de votre
  temps / Prenez votre temps, Ma mère est infirmière / malade, J'ai perdu mon téléphone / mon travail, Vous êtes
  d'ici ? / Vous travaillez dans le quartier ?, and the verse references (Romains 3:23 / 6:23, Jean 3:16 / 14:6).
  Sound-alikes that are not in the course (péché / pêche, pécheur / pêcheur, pécher / pêcher) are taught in notes.
* `lib/french/lexicon.ts`: verb families for *croire* and *prier*, *quatorze* among the numbers, and glosses for the
  faith words (péché = sin, grâce = grace, croix = cross, cœur = heart, œuvres = works...). *Salut* has no gloss
  (hi and salvation), *père* is now glossed "father" (it serves both *Mon père* and *le Père*), and *en* left the
  preposition family because *croire à* would be a defensible answer for *croire en*.
* Phrases whose gap-fill would have had a second right answer were reworded before they shipped (*Je cherche du
  travail*, where *un travail* is also right, became *J'ai perdu mon travail*; *Merci de me le dire*, where *la* could
  fit, became *Merci de m'en parler*; *...avec l'Église*, where *à l'Église* fits, became *J'ai été blessé par
  l'Église*). Object pronouns after a non-subject word are avoided for the same reason.

### 8.5 For review before the trip

The 20 new phrases, the owner's decisions and the pastor's questions for the simplification pass are in
[curriculum-review-list.md](curriculum-review-list.md). The older list:

A native French speaker and a pastor or mission leader should read these:

* **Wording (native speaker):** *Nous aidons une église de Strasbourg* (true for this team?), *Nous sommes un groupe
  d'étudiants*, *Vous avez grandi dans une famille croyante ?*, *La repentance, c'est se tourner vers Dieu*,
  *Par la foi, nous recevons ce cadeau*, *Merci, ça me touche*, *Je n'y avais pas pensé*, *Seigneur, bénis Marie*,
  the fragment *Et ouvre la porte* / *Et lui avec moi*, and the English glosses of the verse pieces (*Falling short of
  the glory of God* for *Privés de la gloire de Dieu*, *If you declare with your mouth* for *confessez*).
* **Theology (pastor):** the nine gospel sentences in u15-l3; *J'ai donné ma vie à Jésus* as testimony language;
  *Il nous offre son pardon*; the notes on grace ("God's kindness that nobody can earn") and repentance; *Dieu vous
  entend*; whether to teach *Que Dieu vous bénisse* this early (u4, unchanged).
* **Cultural sensitivity (both):** *Nous sommes protestants* and the note that *évangélique* can sound like an
  unknown American group; the *secte* note; how Catholics, Lutherans and Muslims are introduced in u16-l2 notes
  ("start from what you share"); the whole of u16-l3 *When church has hurt*; asking only a first name and offering
  a local church contact rather than personal numbers; open-eyed street prayer.

Not tested here: the UI on a phone (the new verse link on the first intro card, the eight new unit illustrations in
light and dark mode, long verse phrases on small screens) and the speech engine's pronunciation of the new words
(*Jésus-Christ*, *Saint-Esprit*, *œuvres*, *quatorze*).
