# Learning a verse by heart

How the scripture track teaches a verse: chunks, a six-phase mastery path, and tap-to-hear French.
Code: `lib/scripture/` (pure logic), `components/scripture/` (screens), `content/scripture/chunks.json` (hand-tuned splits).

## The path

Each verse is split into 2 to 5 **chunks** (a clause or phrase of about 3 to 8 words). The learner walks six phases.
The progress bar (Odile in her nest), a row of six phase dots and a Rosace petal that grows from its base all show
where they are.

| # | Phase | What the learner does | Why |
|---|-------|-----------------------|-----|
| 1 | **Listen and read** | One screen per chunk: the French (every word tappable), its English meaning, Play chunk / Whole verse, and the chunk highlighted inside the whole verse. Then the whole verse once more, line by line with meanings. | Meaning first and sound first: beginners cannot memorise what they cannot pronounce or understand. No testing yet. |
| 2 | **Build the chunks** | Per chunk: fill the blanks from a word bank (about 40%; chunks of 7+ words get a second pass at 70%), then put all its words in order. Each placed word is spoken. | Errorless learning: a wrong tile just bounces back, and after two misses the right tile glows, so early mistakes are not rehearsed. |
| 3 | **Chain them** | Chunk 1+2, then 1+2+3 ... up to the whole verse. Each link twice: first with first-letter cues, then with blank lines. The word bank only offers the current chunk's words. | Cumulative chaining builds the verse as one sequence; fading cues (first letters, then nothing) shift the work from recognising to recalling. The no-cue pass is strict: more than ~15% wrong taps means "try again". |
| 4 | **Reassemble** | Put the chunks in order, then type the missing words across the whole verse (one per chunk, two in long chunks; the first letter is the only cue). | Desirable difficulty: real recall of words, structure of the whole. |
| 5 | **Recall** | Type the whole verse from memory. Lenient grading (accents, case, punctuation, œ/oe and one slip in a 5+ letter word are free; 90% of words needed). A "First letters" hint is offered, chunk by chunk. | Retrieval practice. Passing saves the FSRS card (Good; Hard if a hint was used or an attempt failed) and awards XP. **The verse now counts as learned** (Rosace petal, review scheduling). |
| 6 | **Cement** | A retest after 10 minutes, or on the next visit: type it from memory once more. A clean pass (no hint) **masters** the verse; a hint or a miss schedules another retest 10 minutes later. Each retest is a real FSRS review (Good / Hard / Again). A clean pass in a normal review session counts as the retest too. | Spacing: the first delayed retrieval is the one that predicts long-term retention. FSRS also brings a new card back about 10 minutes after its first Good, so the two line up. |

After that, spaced review continues as before (`/scripture/review`, FSRS via `lib/srs.ts`).

Odile reacts to each answer with the calm reaction pools (`calmRight`, `calmWrong`), and with a finish reaction plus
`playDone` at the end of every phase. Feedback text sits in an `aria-live` card at the bottom; the next step's heading
takes focus. Quitting mid-path asks for confirmation, though the place is saved either way. Opening a verse shows the
path first: **Start**, **Resume: <phase>** (or **Start over**), the retest countdown, **Start the retest**, or
**Practice again** for a mastered verse (practising never removes "mastered").

XP and rating rules are unchanged: `award_xp` with source `verse:<ref>`, 15 the first time a verse is learned, 8 on
a repeat, within the existing daily cap. The Cement retest gives no XP.

### Research behind it

- Chunking and working-memory limits: G. A. Miller, "The magical number seven, plus or minus two" (1956); N. Cowan, "The magical number 4 in short-term memory" (2001). Hence chunks of a few words, never more than 5 per verse.
- Retrieval practice beats rereading: H. L. Roediger and J. D. Karpicke, "Test-enhanced learning" (Psychological Science, 2006).
- Desirable difficulties: R. A. Bjork, "Memory and metamemory considerations in the training of human beings" (1994).
- Errorless learning early on: A. Baddeley and B. A. Wilson, "When implicit learning fails: amnesia and the problem of error elimination" (Neuropsychologia, 1994).
- Vanishing cues (first letters, then nothing): E. L. Glisky, D. L. Schacter and E. Tulving, "Learning and retention of computer-related vocabulary in memory-impaired patients: method of vanishing cues" (1986).
- Spacing: N. J. Cepeda et al., "Distributed practice in verbal recall tasks: a review and quantitative synthesis" (Psychological Bulletin, 2006).
- First-letter cues for memorising text: the common "first letter" technique used by Bible memory apps; Phase 3 and the hints use it.

## Chunks

`lib/scripture/chunks.ts`:

- `chunksFor(key, text)` returns the hand-tuned split from `content/scripture/chunks.json` when it matches the verse,
  otherwise the automatic split. Joining the chunks with single spaces always gives the exact verse back.
- `autoChunks(text)` is deterministic: it scores each gap between words (end of sentence 10, `;` or `:` 9, comma 7,
  before `mais`/`car`/`afin`/`si`/`alors`... +5, before `que`/`qu'`/`et`/`ou` +3, before a preposition +2; a gap
  right after a word that leans on the next one — `le`, `de`, `ne`, `son`, `afin`, `qu'`... — is -12, any other
  mid-phrase gap -5), then a small dynamic program picks 2 to 5 chunks that balance good gaps against even lengths
  (about 6 to 7 words each). It never makes a one-word chunk, keeps stand-alone French punctuation (`;` `:` `»`)
  with the word before it and `«` with the word after it, and never splits an elision (`qu'il`, `l’a` are one word).
  Verses under 4 words stay one chunk. Ranges like `EPH 2:8-9` are chunked as one text.

### Fixing a split

Edit `content/scripture/chunks.json`. Each key is the verse key as stored (`"JHN 3:16"`, `"EPH 2:8-9"`), the value
is the list of pieces in order, each with the French and an optional English meaning:

```json
"ROM 3:23": [
  { "fr": "tous ont péché", "en": "all have sinned" },
  { "fr": "et sont privés de la gloire de Dieu ;", "en": "and fall short of the glory of God;" }
]
```

The pieces must add up to the verse text in `public/bible/fr` (spacing and apostrophe style may differ: the app
always displays the real verse text, cut where your pieces end). If they do not match (a typo, a changed
translation), the app ignores the entry and uses the automatic split; in development the console says so.
Use 2 to 5 pieces. Then run:

```
node scripts/check-verses.mjs
```

It checks every hand-tuned entry and verse lesson (`content/french/units.json` `verse` fields), runs the automatic
chunker on all ~31,000 verses (no lost text, 2-5 chunks, no one-word chunk), the tokenizer, karaoke timing, the
phase state machine, progress serialization and grading. Exit code 1 on any failure. Needs Node 22.18+ (or
`--experimental-strip-types`).

If you change the split of a verse someone is half-way through, their current phase restarts at its first step
(Recall and Cement are not affected).

## Saving progress

`lib/scripture/mastery.ts` (type `Progress`), saved after every step by `lib/scripture/store.ts`:

```json
{ "v": 1, "phase": 2, "step": 3, "sig": "7-6-6-3-6", "learnedAt": "…", "cementAt": "…", "masteredAt": "…", "updatedAt": "…" }
```

`phase` is 0-5, `step` the position inside the phase (which, for phases 1-4, is the per-chunk position), `sig` the
word count of each chunk it was made with. `hint` / `fails` track the Recall attempt.

- **Always** in `localStorage` (`le-nid-verse:<ref>`), so it works offline and before the migration.
- **Also** in `srs_cards.progress` (jsonb) once migration `supabase/migrations/0011_verse_progress.sql` is run, so a
  learner can switch phones. On load the newer copy (by `updatedAt`) wins.
- If the column does not exist yet, the first save gets "column not found" and database saves stop for the session,
  silently; the pages read `srs_cards` with the column and fall back to reading without it. No errors are shown.
- `learned_at`, `state` and `due` are still written exactly as before, so the Rosace, the review queue and the
  leaderboard do not depend on the new column. Verses learned before this feature have no progress: they show
  **Retest**, and a clean retest (or a clean review) masters them.

### Migration 0011

Run `supabase/migrations/0011_verse_progress.sql` in the Supabase SQL editor (or `npx supabase db push`). It adds
`srs_cards.progress jsonb` with a size check (≤ 2 KB object), and is safe to run more than once. Row security is
unchanged: the existing "cards own" policy (own rows only) and the restrictive "approved only" policy (0008) cover
the new column. `award_xp` and its source rules (0010) are untouched.

## Tap to hear

`components/scripture/TapWords.tsx` renders French text word by word; each word is a `role="button"` span:

- **Tap**: speaks that word (`lang fr-FR` via `lib/french/speech.ts`). **Hold** (450 ms): speaks it slowly. Enter or
  Space works with a keyboard. The `Slow` (turtle) toggle makes taps and Play slow by default; it is remembered.
- Punctuation (`,` `;` `:` `«`) is shown but not spoken. Elisions stay attached to their word and are spoken as one
  unit (`qu'il`, `l'a`, `c'est`, `j'entrerai`) because `qu'` alone is not something a French voice says well.
  Curly apostrophes are spoken as plain ones.
- Look: a soft dotted underline (readable, discoverable) and a tint on press; the tap target is stretched to 44 px
  tall with an invisible box, so line spacing does not change. Colours come from the theme tokens, so dark mode works.
- **Play chunk / Whole verse / Play verse** read the text with a word-by-word highlight ("karaoke"). The highlight
  follows the browser's word-boundary events when it sends them, otherwise a timer estimated from word length and
  punctuation pauses (`lib/scripture/karaoke.ts`, ~72 ms per letter, ~112 slow). A second tap stops. With reduced
  motion, the highlight still moves but without transitions.
- Used in: every learn step that shows French, completion screens, review feedback (with Play verse), the Add a
  verse preview, and the French lesson intro cards (`components/french/MeetPhrases.tsx`).

### iPhone notes

- iOS only plays speech that starts inside a tap. Every speech call here runs from a tap: Start / Resume / Next
  chunk speak the next chunk in the same tap, never on a timer.
- Voices load asynchronously; `lib/french/speech.ts` already picks a French voice once `voiceschanged` fires.
- After the first play, the hint "No sound? Flip the silent switch off." appears under the controls (or "Audio is
  not available on this device." when there is no speech at all).
- iOS rarely sends word-boundary events, so the karaoke there is timer-based and may drift a little on long verses.

## Test checklist (real iPhones)

Do this on at least one older and one recent iPhone, Safari and the installed home-screen app, light and dark mode.

1. Scripture tab: verse rows show a petal and a tag (Learn, Phase n of 6, Retest soon, Retest, Mastered, Due). The Rosace's next petal grows as a verse moves along.
2. Open a new verse: the path list shows six phases; Start speaks chunk 1 right away (silent switch off). If silent, the switch hint shows.
3. Tap single words: each is spoken, French accent, no "apostrophe" sounds (`qu'il`, `l’a`, `quelqu’un`). Hold a word: slow. Turtle toggle: slow by default.
4. Play chunk / Whole verse: words light up roughly in time; tapping again stops. Tapping a word during playback stops the highlight.
5. Phase 2: wrong tiles shake and stay; after two misses the right one glows. Placed words are spoken.
6. Phase 3 no-cue pass: several wrong taps lead to "Pas tout à fait" and a retry of the same step.
7. Phase 4 gaps: the keyboard does not zoom the page; Return moves to the next gap; "coeur" for "cœur" and missing accents pass.
8. Leave mid-phase with the X: a confirmation appears. Come back: "Resume: <phase>" lands on the same step. Kill the app and reopen: same.
9. Phase 5 with the hint: passes, verse shows as learned (petal filled), XP shown (15 first time).
10. Right after: "Retest opens in 10 minutes". After 10 minutes: Start the retest; a clean pass shows "Verset maîtrisé !" and the row says Mastered.
11. Before migration 0011: everything above works on one phone; on a second phone progress starts over (expected). After running 0011: progress follows the learner to another phone.
12. VoiceOver: words read as buttons, feedback is announced, step headings get focus. Reduce Motion on: no Odile travel or tile shake; highlight still moves.
13. Review session: feedback words are tappable, Play verse works, and a clean review of a verse waiting for its retest marks it mastered.
