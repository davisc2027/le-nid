# French curriculum: evaluation and design

Scope: `content/french/units.json`, the exercise engine in `lib/french/exercises.ts` (with the word families in
`lib/french/lexicon.ts`), and the lesson player in `components/french/`. Checks: `node scripts/check-curriculum.mjs`.

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
* **Numbers moved** to right after greetings (unit order: u0, u1, u5, u2, u3, u4, u6, u7, u8, u9, u10).
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

## 3. Lesson flow

1. **Meet the phrases** (`components/french/MeetPhrases.tsx`): one card per phrase with the French, Listen and Slow
   audio, the English, the tu form and the note. Next speaks the following phrase; Back and *Skip intro* are there
   too. Lessons only; review and practice skip it.
2. **Matching round** on up to 5 of the phrases just met: shorter ones first, never two near-synonyms.
3. **First pass**, every phrase once. The first two are warm-ups with 3 options instead of 4, wrong options from
   the lesson that *contrast* with the answer, and a tap-to-reveal hint (word glosses such as "où = where",
   or "It means ..." for listening).
4. **Second pass** on production: the phrases first seen through recognition come back as word bank, gap-fill,
   typing, listening or tu/vous.
5. **Review**: up to 3 phrases from earlier lessons, continuing the sequence.

Size: 12 to 15 exercises plus up to 3 review, so **18 at most** (missed items still come back at the end). The same
kind never appears twice in a row, and the same phrase never appears twice in a row.

### Exercise kinds

| Kind | Task | Grading |
|---|---|---|
| choose | Read French, pick the meaning. Some are audio-only (hear it, pick the meaning) from the middle of the course on | exact |
| hear | Hear French, pick the written phrase among sound-alikes | exact |
| pick | Read English, pick the French among near misses | exact |
| gap | Pick the missing word; options from the same family (articles, verb endings, numbers, days...) | exact |
| register | A situation ("To a shopkeeper", "To a French student your age"): pick the tu or vous version | exact |
| bank | Build the French from tiles, including 2 same-family decoys | lenient |
| type | Type the French for an English prompt; letter-shape hint (`J_ m'a_____ M____`) | lenient, tu form accepted |
| listen | Type what you hear | lenient |
| match | Tap pairs | - |

"Lenient" means accents, case, punctuation and one typo (on words over 6 letters) are forgiven, as before.

### Mix per stage

Stage comes from position in the course: early is the first 30% of lessons, middle up to 65%, then late.
These are the weights; the measured mix is below.

| Pass | Early | Middle | Late |
|---|---|---|---|
| First | choose 4, hear 3, pick 3 | choose 3, pick 3, hear 2.5, gap 2.5, bank 1.5 | gap 3, bank 2.5, type 2.5, pick 2, choose 1.5, hear 1.5 |
| Second | bank 3.5, register 3, gap 2.5, pick 1.5, listen 1.5, type 1 | bank 3, register 3, type 2.5, gap 2, listen 2, choose 0.7 | type 4, bank 3, register 3, listen 2, gap 1.5, choose 0.7 |
| Review and practice | pick, gap, type, bank 2; register 1.5; hear, listen, choose 1 | | |

Caps per lesson: listen 2, hear 3, choose 4, register 1. Typing is limited to phrases of at most 4, 6 or 8 words by
stage, and listening to at most 5, 7 or 8 words.

Measured mix (80 generations per lesson):

* **Early**: choose 23%, pick 21%, hear 18%, bank 9%, listen 8%, match 7%, type 7%, gap 6%, register 1%. Recognition
  is about 62%.
* **Middle**: choose 20%, bank 16%, hear 14%, gap 13%, pick 10%, type 9%, listen 8%, match 7%, register 2%.
* **Late**: type 20%, bank 18%, choose 15%, gap 14%, hear 12%, match 7%, pick 7%, listen 7%, register 1%. Production
  (type, bank, gap, listen) is about 60%.

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
* *pour* and *dans*, which are left out of the families (*travaille pour un café* is close to right);
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

`buildReview(phrases, prevKind)` and `buildPractice(phrases)` use the same kinds and the same distractor engine. Each
phrase is anchored to its own lesson, so wrong options come from what the learner had already met. `phraseKey`,
`pickReviewPhrases`, `pickPracticeKeys` and the card saving are unchanged. "Can't listen now" turns the rest of the
session audio-free (`noAudioFallback`): listen becomes typing from English, hear becomes pick with the same options,
and audio-only choose shows the French text.

## 7. Checks

```
node scripts/check-curriculum.mjs        # 40 generations per lesson, about 30 s
node scripts/check-curriculum.mjs 80     # bigger sample
```

Needs Node 22.18 or later; on an older Node 22, add `--experimental-strip-types`. The script imports the real engine
through small loader hooks, so nothing is copied. It exits 1 when a check fails.

**units.json invariants:**

* ids `^u[0-9]+$` and `^u[0-9]+-l[0-9]+$`, numbered l1, l2... with no gaps;
* 5 to 10 phrases per lesson;
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

It prints the length and punctuation tell rates, where wrong options come from, and the exercise mix per stage.

Not covered by the script: the UI on a phone (the intro cards, audio autoplay after the first tap, layout of long
options). Check those by hand.
