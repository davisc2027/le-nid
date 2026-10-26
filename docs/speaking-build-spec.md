# Speaking practice: build spec (Phase 1)

Status: ready to implement. Source research: `docs/speaking-plan.md` (cited as "plan §n"). This spec is binding; where it
differs from the plan, the spec wins (it carries the owner's decisions). Implementers: read `AGENTS.md` and the
relevant guide in `node_modules/next/dist/docs/` before writing code (this Next.js 16 differs from older versions:
`PageProps<"/route">`, async `params`, `proxy.ts` instead of middleware).

## 1. Scope and non-goals

**Builds:**

1. A **"Say it" step** (exercise kind `speak`) inside selected lessons (section 3.1).
2. A **Pronunciation practice** mode at `/french/practice/sounds` with 7 sound cards (section 3.2).
3. On-device checks only: speech heard, length in a generous range, too quiet, too noisy, and, for yes/no questions,
   whether the pitch rose at the end. Then a **shadowing replay**: model, then the learner's clip, then the model.
4. The **model voice** is the iPhone's French voice (`speak()` in `lib/french/speech.ts`). A **reference loader**
   plays a volunteer recording from `public/reference/<voice>/<file>` instead, when one exists, and falls back to
   text-to-speech without saying so.
5. Scripts `scripts/build-reference-manifest.mjs` and `scripts/make-reference-list.mjs`, plus `docs/recording-guide.md`.
6. A **Settings toggle** on the Me page ("Speaking exercises", default ON).
7. A hidden **Speak lab** tester page (`/french/speak-lab`) with raw numbers, the spike's DTW comparison, and a local
   CSV export for calibration.
8. Tests: pure-logic Node tests, a Playwright flow with Chromium fake media, and a real-iPhone checklist.

**Non-goals (do not build):** cloud checks of any kind (no `/api/stt`, no Whisper, no "Check with AI"); scores,
percentages, grades, pass/fail or bands; showing learners per-word highlights; perception (minimal-pair) drills;
an admin recording page; uploads to Supabase; any change to XP, streaks, `vocab_cards`, `lesson_progress`,
`missed` or the rating logic; changes to `components/talk/**` or `lib/talk/**` (another agent owns them; do not
import from them either); changes to `MeetPhrases.tsx`, `Speaker.tsx`, `ExerciseViews.tsx`, the spike algorithms in
`lib/speech/*.ts`, or `content/french/units.json`.

**Privacy rule:** audio lives in memory only. It is released when the step unmounts, on "Try again", and when the tab
is hidden. Nothing is uploaded or stored. The single exception is the Speak lab: a tester can tap "Download WAV" to
save a file to their own phone, and the lab keeps numbers (never audio) in `localStorage`.

## 2. User flows, screens and copy

All copy below is final. Tone: warm, short, never blaming. No red: borders use `border-border` (neutral) or
`!border-good` (success only). Every result card is `role="status"`. All tap targets are at least 44 px (`min-h-11`).

### 2.1 Say-it step (lesson and practice share `SpeakStep`)

| Area | Content |
|---|---|
| Label | `Say it out loud` (class `label`) |
| Phrase | The French in `text-2xl font-extrabold`, `lang="fr"`; the English below in `text-muted` |
| Note | The phrase's `note`, if any, with the `Lightbulb` icon (same markup as the feedback card in `LessonPlayer`) |
| Model | `ModelButtons`: **Listen** (`Volume2`) and **Slow** (`Turtle`), plus a voice switch **Voice: woman / man**, shown only when both voices exist for this phrase |
| Mic button | Round, 88 px, `bg-primary`, `Mic` icon. Labels under it by recorder state: idle `Tap and say it`; recording `Listening… tap to stop`; processing `One moment…` |
| Level meter | A 6 px bar under the mic; width = level × 100%, written to `style.width` through a ref (no React state per frame) |
| Privacy line | `Your voice stays on this phone. Nothing is saved or sent.` (`text-xs text-muted`) |
| Footer | Before any attempt: **Skip** (subtle link). Lesson only, always: **Can't speak now** (subtle link, the same class as `Can't listen now` in `ExerciseViews.tsx`) |

On mount: if `speechUnlocked()` is true, play the model once (same rule as `Hear`). Starting the recorder stops any
model playback first (`speechSynthesis.cancel()` and pause the audio elements). Nothing plays while recording.

### 2.2 Result states (card below the mic; the mic stays visible for "Try again")

| State id | Title | Body | Card border | Odile (exact) | Sound | Replay buttons |
|---|---|---|---|---|---|---|
| `success` | `Bien dit !` | `Listen back and compare.` | `!border-good` | `cue(pickReaction("calmRight"))` (bounce, hearts, salute) | `playSuccess()` | yes |
| `success` + rose | `Bien dit !` | `Your voice went up at the end, like a real question. Listen back and compare.` | `!border-good` | same | `playSuccess()` | yes |
| `near-miss` (question did not rise) | `Presque !` | `Make the end go up, like a real question. Listen to the model, then try again?` | neutral | `cue("feather")` (in `POOLS.miss` and `POOLS.calmWrong`; no pratfall) | `playTick()` | yes, plus the pitch sparkline |
| `thanks` (3rd attempt or later, see 6.4) | `Merci !` | `Let's keep going. You can listen back and compare first.` | neutral | `cue(pickReaction("calmRight"))` | `playSuccess()` | yes |
| `too-short` | none | `That sounded short. Say the whole phrase?` | neutral | none | none | yes |
| `too-long` | none | `Let's keep it to just the phrase. Try again?` | neutral | none | none | yes |
| `too-quiet` | none | `I could barely hear you. Hold the phone a little closer and try again?` | neutral | none | none | no |
| `too-noisy` | none | `It's a bit loud around you. Try a quieter spot, or skip for now.` | neutral | none | none | no |
| `no-speech` | none | `I didn't hear anything. Tap the microphone and say the phrase?` | neutral | none | none | no |

Buttons on every result card: **Try again** (`btn ghost`, returns to the ready state) and **Continue** (`btn`).
Continue is shown after the first analysed attempt, whatever the state. Before that, only Skip.

### 2.3 Blocked states (replace the mic area)

Microphone reuse: `lib/audio/micStream.ts` keeps one stream warm per screen visit (tracks disabled between takes, fully released on unmount, 90 s idle, 30 s hidden or a track ending); the OS may still prompt after a relaunch of the Home Screen app, which the app cannot prevent, and the orange mic indicator may stay on while the stream is warm.

| State | Title | Body | Buttons |
|---|---|---|---|
| `denied` (NotAllowedError, SecurityError) | `Microphone off` | `The microphone is off for Le Nid. To use it, allow it in Settings › Apps › Safari › Microphone (on older iPhones: Settings › Safari › Microphone), then come back. You can keep going without speaking.` | **Try again**, **Continue** |
| `unsupported` (no `getUserMedia` or no `AudioContext`) | none | `Speaking practice isn't available on this device. You can keep going without it.` | **Continue** |
| `mic-error` (any other failure, track ended) | none | `The microphone didn't start. Try again, or keep going without speaking.` | **Try again**, **Continue** |

No Odile reaction and no sound in blocked states. Continue calls `onDone`, the same as Skip.

### 2.4 Pronunciation practice (`/french/practice/sounds`)

* **List screen.** A header row with an `X` link to `/french` (`aria-label="Back to French"`), the title
  `Pronunciation practice` (h1) and the intro `Pick a sound. Listen, say it, then compare your voice with the model.`
  Then seven `card` buttons in the order of the table in 3.2: the label in bold, then the first three phrases of the
  set joined with ` · ` in `text-sm text-muted`, then `{n} phrases` on the right.
* **Session.** The same header as `LessonPlayer` (an `X` button that returns to the list without asking, since
  nothing is lost; `OdileTrack` with progress `k / n`). Above the first phrase, the category's tip card (3.2) with
  the `Lightbulb` icon. Then `SpeakStep` with `mode="practice"` and `key={k}`. Continue or Skip goes to `k + 1`.
* **Finish screen.** Title `Bien joué !`. Body `You practised {n} phrases out loud.` Odile
  `cue(pickReaction("finish"))` and `playDone()`. Buttons: **Another sound** (back to the list) and
  **Back to French** (link `/french`). No XP, no database writes.
* **Speaking turned off.** The page shows a card `Speaking practice is turned off.` with **Turn it on**
  (`setSpeakingOn(true)`, then the list) and a link **Back to French**.
* **Hidden tester entry.** Tapping the h1 five times within 3 s calls `router.push("/french/speak-lab")`.

### 2.5 Settings (Me page)

A new card between `ProfileForm` and `GentleToggle`: `<h2 className="label">French practice</h2>` plus a checkbox
row: **Speaking exercises**, with the line `Say-it steps in lessons and Pronunciation practice. Your voice stays on
this phone.` Checked by default. Storage: `localStorage["le-nid-speaking"]`, `"0"` = off, anything else
(including missing or a storage error) = on.

## 3. Which phrases

### 3.1 Lesson Say-it steps (rule plus the resulting table)

Definitions (all in `lib/speech/text.ts`, pure):

* `speechWords(fr)`: lowercase; replace `[?!.,:;«»"…]` with a space; split on `/[\s'’\-]+/`; drop empty strings.
* `syllables(fr)`: for each word `w`, set `s = w.replace(/qu/g,"q").replace(/gu(?=[eiéèêy])/g,"g")`. Count the
  vowel groups `/[aeiouyàâäéèêëîïôöùûüœæ]+/g` in `s`. If the count is above 1 and `s` matches
  `/[^aeiouyàâäéèêëîïôöùûüœæ]es?$/`, subtract 1 (mute e). Otherwise, if the count is above 1, `s` ends in `ent` and
  the previous word is `ils` or `elles`, subtract 1. The sum over words, at least 1.
* `nWords(fr)`: the same as in `exercises.ts` (tokens containing a letter). Export a copy from `text.ts`; do not
  change `exercises.ts` for it.
* `BLOCKED_WORDS = ["winstub", "bredele", "bretzel"]`: Alsatian words the French voice mispronounces.
* `speakable(fr, maxWords, maxSyl)`: no digit, no word in `BLOCKED_WORDS`, `nWords ≤ maxWords`, `syllables ≤ maxSyl`.

**Lesson rule** (`speakPhrasesFor(lessonId)` in `lib/speech/select.ts`; eligibility is `speakable(fr, 5, 8)`):

* **u0 lessons** (id starts with `u0-`): 3 phrases, chosen greedily for sound coverage. Repeat 3 times: pick the
  eligible phrase that adds the most `soundTags` (3.2) not yet covered. Break ties by fewer syllables, then by earlier
  position in the lesson.
* **Every third lesson after u0**: let `li` be the lesson's index in `ALL_LESSONS`. If `li ≥ 2` and
  `(li - 2) % 3 === 2` (that is, li = 4, 7, 10, … 58), take the 2 eligible phrases with the fewest syllables. Break
  ties by fewer words, then by earlier position.
* All other lessons: none.

Result (generated from `units.json` today: **20 lessons, 41 phrases**). Format: French → `phraseKey` (syllables,
duration range from 6.2 in seconds). `↗` = rise check applies.

| li | Lesson | Say-it phrases |
|---|---|---|
| 0 | u0-l1 Survival words | Bien sûr → `bien sur` (2, 0.16-2.4) · D'accord → `d accord` (2, 0.16-2.4) · Voilà → `voila` (2, 0.16-2.4) |
| 1 | u0-l2 Sounds and accents | Très → `tres` (1, 0.15-1.8) · Un peu → `un peu` (2, 0.16-2.4) · Moi → `moi` (1, 0.15-1.8) |
| 4 | u1-l3 Small talk | Ça va ? → `ca va` (2) ↗ · Pas mal → `pas mal` (2) |
| 7 | u11-l2 Listening well | Ah bon ? → `ah bon` (2) ↗ · C'est vrai → `c est vrai` (2) |
| 10 | u5-l1 One to eight | Un → `un` (1) · Deux → `deux` (1) |
| 13 | u5-l4 Days of the week | Hier soir → `hier soir` (2) · Ce week-end → `ce week end` (3) |
| 16 | u13-l2 Church life | Prier → `prier` (1) · Le culte → `le culte` (2) |
| 19 | u2-l3 Tickets and trains | Où faut-il descendre ? → `ou faut il descendre` (5) · Le train a du retard → `le train a du retard` (6) |
| 22 | u3-l2 Being polite | Merci → `merci` (2) · Pardon → `pardon` (2) |
| 25 | u9-l1 About me | J'ai vingt ans → `j ai vingt ans` (3) · D'où venez-vous ? → `d ou venez vous` (4) |
| 28 | u9-l4 The weather | Il pleut → `il pleut` (2) · Il neige ! → `il neige` (2) |
| 34 | u14-l2 Romains 3:23 | Le péché → `le peche` (3) · Tous ont péché → `tous ont peche` (4) |
| 37 | u6-l1 Prices and paying | En espèces → `en especes` (3) · Trois euros cinquante → `trois euros cinquante` (5) |
| 40 | u15-l2 My story | Dieu m'a pardonné → `dieu m a pardonne` (5) · Je prie tous les jours → `je prie tous les jours` (5) |
| 43 | u8-l2 Feeling unwell | J'ai mal au ventre → `j ai mal au ventre` (4) · J'ai de la fièvre → `j ai de la fievre` (4) |
| 46 | u16-l2 Other beliefs | Je suis athée → `je suis athee` (4) · Je suis catholique → `je suis catholique` (5) |
| 49 | u7-l2 Everyday needs | Où est la laverie ? → `ou est la laverie` (6) · Jusqu'à quelle heure c'est ouvert ? → `jusqu a quelle heure c est ouvert` (7) |
| 52 | u17-l3 Jean 14:6 | Le Père → `le pere` (2) · Le chemin → `le chemin` (3) |
| 55 | u10-l2 Alsatian food and the Christmas market | Je voudrais goûter la choucroute → `je voudrais gouter la choucroute` (8) (only one phrase is eligible) |
| 58 | u18-l2 Praying together | Oui, avec plaisir → `oui avec plaisir` (5) · Merci, ça me touche → `merci ca me touche` (5) |

Index 31 (u4-l3 Talking about faith) matches the rule but has no eligible phrase (all are over 5 words), so it gets
no step. Selection uses the index in `ALL_LESSONS`, not the unit number. A test
(11.1) pins this table; if `units.json` changes, regenerate it with
`node scripts/make-reference-list.mjs --only say-it` and update the test and this table together.

### 3.2 Pronunciation practice set (`soundTags`, `practiceSet`)

`soundTags(fr): SoundTag[]` with `SoundTag = "u" | "r" | "nasal" | "eu" | "oi" | "liaison" | "question"`. Split the
lowercased French into chunks on `/[,;:.!?«»"…]+/`, and each chunk into words on `/[\s'’\-]+/`. For each word `w`
(skip `monsieur` and `messieurs`), with `s` as in `syllables`:

| Tag | Rule (per word unless stated) |
|---|---|
| `r` | Let `rs = (s.length ≥ 4 && !EXC.has(w)) ? s.replace(/er$/, "e") : s`. Tag if `rs` contains `r` (drops the silent r of *parler*; *hier* is in EXC) |
| `u` (card "u and ou") | Tag if `s` matches `/o[uùû]/`. Also: remove from `s` every `[uû]` followed by `[nm]` that is not followed by `[aeiouyàâéèêëîïôûùünm]` (nasal *un*), then remove `/o[uùû]|e[uû]|œu?/g`. Tag if the rest matches `/(^|[^oaeq])[uûü]/` |
| `eu` | `s` matches `/e[uû]|œ/` and `w !== "eu"` |
| `nasal` | `s` matches `/[aeiouyéè][nm](?![aeiouyàâéèêëîïôûùühnm])/`, unless `w` ends in `ent` and the previous word is `ils` or `elles` |
| `oi` | `s` matches `/o[iîy]/` |
| `liaison` (card "Silent letters and liaison") | If `!EXC.has(w)`: `w.length ≥ 3` and it ends in `[tdsxzp]`; or `w.length ≥ 4` and it ends in `er` or `ez`; or the next word in the same chunk starts with `[aeiouyàâäéèêëîïôöùûüœæh]` and `w` ends in `[sxztdn]`. Phrase level: the text contains `il y a` |
| `question` | `isRiseQuestion(fr)` (below) |

`EXC` (final consonant spoken): christ, ouest, bus, fils, sens, sud, ours, mars, hélas, huit, sept, net, but, stop,
gaz, six, dix, contact, direct, correct, plus, zut, foot, end, cher, mer, fer, hier, fier, hiver, super, enfer, amer,
ver.

`isRiseQuestion(fr)`: the phrase ends with `?`; it does not contain the word `où`; it has no hyphenated inversion
(`/-(vous|nous|il|elle|ils|elles|je|tu|on|t-il|t-elle)\b/i`); and after `normalize(fr)` with
`/\best ce qu(e)?\b/g` removed, no word is in {que, qu, quel, quelle, quels, quelles, qui, quoi, quand, comment,
combien, pourquoi, lequel, laquelle}. (Intonation questions in declarative order and *est-ce que* questions rise;
wh-questions and inversion may fall [plan §2.2].)

Counts today (468 phrases; 422 pass `speakable(fr, 6, 10)`, the practice eligibility): u 231, r 263, nasal 228,
eu 81, oi 67, liaison 314, question 40 (of 116 phrases ending in `?`).

`practiceSet(tag, completed: string[]): Phrase[]` takes the eligible phrases with that tag and sorts them by tier:
**tier 0** is u0 phrases, in course order; **tier 1** is phrases of completed lessons, by fewer syllables, then course
order; **tier 2** is all other phrases, in course order (so a new learner still gets a full card). It returns the
first 6. Course order means lesson index, then position in the lesson.

| Card (order) | Label | Tip (exact copy) | New learner (completed = []) | Everything completed |
|---|---|---|---|---|
| `u` | u and ou | `For u (tu, la rue), say "ee" with your lips rounded as if to whistle. For ou (vous, bonjour), say "oo" as in "food".` | Oui · S'il vous plaît · Bien sûr · La rue · Tu · Vous | same |
| `r` | The French r | `Keep the tip of your tongue down behind your lower teeth and make a soft sound at the back of your throat, close to a gentle gargle.` | D'accord · Bien sûr · Très · La rue · Bonjour · Bonsoir | D'accord · Bien sûr · Très · La rue · Trois · Quatre |
| `nasal` | Nasal vowels | `Let the vowel go through your nose and stop before the n or m: non, bon, un. Don't say the n.` | Non · Bien sûr · Un peu · Bonjour · Bonsoir · À bientôt | Non · Bien sûr · Un peu · Un · Cinq · Quinze |
| `eu` | eu | `Say "uh" with your lips rounded, as if to whistle: un peu, deux.` | Un peu · Je parle un peu français · Qu'est-ce que ça veut dire ? · Je crois en Dieu · Je ne veux pas vous déranger · Juste deux minutes | Un peu · Deux · Neuf · Dieu · Il pleut · Au feu ! |
| `oi` | oi sounds like "wa" | `Oi always sounds like "wa": moi is "mwa", voilà is "vwa-la".` | Voilà · Moi · Bonsoir · Au revoir · C'est ma première fois en France · On se tutoie ? | Voilà · Moi · Trois · Bonsoir · Je vois · Hier soir |
| `liaison` | Silent letters and liaison | `Final letters are usually silent (plaît, d'accord, très). Before a vowel, a silent s can wake up and join the next word: vous avez sounds like "voo-za-vay".` | S'il vous plaît · D'accord · Je ne sais pas · Très · Vous · Vous avez | same |
| `question` | Questions that go up | `In a yes/no question, let your voice go up at the end: Ça va ?` | Ça va ? · Ça va bien, et vous ? · Vous êtes d'ici ? · Vous habitez ici depuis longtemps ? · On se tutoie ? · Vous comprenez ? | Ça va ? · Ah bon ? · C'est loin ? · Vous êtes d'ici ? · On se tutoie ? · Vous comprenez ? |

The rise check runs on every `isRiseQuestion` phrase in any card, not only in the question card.

## 4. Inserting the step into lessons

* **Type** (`lib/french/exercises.ts`): add to the `Exercise` union
  `| { kind: "speak"; fr: string; en: string; note?: string; key?: undefined; review?: undefined }`.
  It has **no `key`** on purpose, so it can never reach `missed`, the cards upsert or the practice XP count. Change
  `type K = Exclude<Kind, "match">` to `type K = Exclude<Kind, "match" | "speak">` so `make()` stays exhaustive.
  Nothing else in `exercises.ts` changes (`buildLesson`, `buildReview`, `buildPractice` and `noAudioFallback` stay
  as they are; `noAudioFallback` returns `null` for `speak`).
* **Insertion** (`withSpeakSteps(exercises, lesson)` in `lib/speech/select.ts`; the input is `buildLesson(lesson)`):
  let `P = lesson.phrases.length`, `first = 1 + P` (the index of the first second-pass exercise) and `L` the input
  length. For speak phrase `j` (0-based, in table order), the anchor is `a_j = min(first + j, L - 2)`. If the
  exercise at `a_j` has an `fr` field equal to the phrase, and `a_j + 1 ≤ L - 2`, use `a_j + 1`. Output: walk the input; after pushing
  input item `k`, push every speak item whose anchor is `k`, in `j` order. So a speak step always sits inside the
  second (production) pass, is never first or last, and is never part of review (review is appended afterwards).
  With 5-10 phrases and lessons of 12-15 items, the second pass has 4-6 items, so 3 steps always fit.
* **LessonPlayer** builds `q = buildLesson(lesson)`, then `if (speakingOn()) q = withSpeakSteps(q, lesson)`, then
  appends review as now. The `prev` kind passed to `buildReview` is still `q[q.length - 1].kind` (never `speak`).
  Practice mode (`buildPractice`) never gets speak steps.
* **Render:** `ex.kind === "speak"` renders `<SpeakStep fr en note mode="lesson" onDone={() => void next()}
  onCantSpeak={dropSpeak} onReact={setOdile} />`. `report` is never called for it, so `result` stays `null`, the
  generic feedback card never appears, no `playError` runs, and nothing is added to `missed`.
* **"Can't speak now"** calls `dropSpeak()`: `kept = queue.filter((e, k) => k < i || e.kind !== "speak")`. If
  `kept.length > i`, then `setQueue(kept)`, `setTotal(t => Math.max(1, t - removed))` and `setResult(null)` (index
  `i` now points at the next item). Otherwise call `next()`. It lasts for this lesson only and is not stored.
* **"Can't listen now"** (`skip`) becomes `() => { setNoAudio(true); dropSpeak(); }`, since speaking needs the model
  and the replay.
* **Completion screen, saving, quitting:** unchanged. `next()` on the last item saves exactly what it saves today,
  because speak items have no key. The quit confirm is unchanged. The recorder hook releases the mic on unmount.

## 5. Recorder hook (`components/speech/useRecorder.ts`)

**Decision: raw PCM through an AudioWorklet (ScriptProcessor fallback), not MediaRecorder.** Reasons:

* `lib/speech/features.ts` takes samples at any rate.
* Decoding iPhone MediaRecorder AAC blobs with `decodeAudioData` is unverified (plan §8).
* PCM is exact and deterministic, with no codec in the path.
* A WAV made from it plays in Safari, the installed app and Chromium.
* 10 s at 48 kHz is 1.9 MB as Float32: trivial.

```ts
export type RecState = "idle" | "starting" | "recording" | "done" | "denied" | "unsupported" | "error";
export type StopReason = "silence" | "cap" | "tap" | "no-speech";
export type Recording = { samples: Float32Array; sampleRate: number; wavUrl: string; seconds: number;
  stoppedBy: StopReason; settings: MediaTrackSettings | null };
export function useRecorder(opts: { capSec: number; onLevel?: (level: number) => void }):
  { state: RecState; recording: Recording | null; start: () => Promise<void>; stop: () => void; reset: () => void };
```

* **start()** must run inside the tap.
  1. If `navigator.mediaDevices?.getUserMedia` or `window.AudioContext ?? webkitAudioContext` is missing, the state
     becomes `unsupported`.
  2. Create the `AudioContext` with no options (do not force a sample rate) and call `resume()`.
  3. If `"audioSession" in navigator`, set `navigator.audioSession.type = "play-and-record"` (in a try).
  4. Call `getUserMedia({ audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false,
     autoGainControl: false } })`. On `OverconstrainedError`, retry once with `{ audio: true }`. `NotAllowedError` or
     `SecurityError` → `denied`; anything else → `error`. Record `track.getSettings()`.
* **Tap.** Call `await ctx.audioWorklet.addModule("/speech/pcm-tap.js")`, then
  `new AudioWorkletNode(ctx, "pcm-tap", { channelCount: 1, channelCountMode: "explicit" })`. Graph: source → tap →
  `GainNode(gain 0)` → `destination` (keeps the graph pulling). If `audioWorklet` is missing or `addModule` throws,
  fall back to `ctx.createScriptProcessor(2048, 1, 1)` and copy `inputBuffer.getChannelData(0)` on each
  `onaudioprocess`.
* **`public/speech/pcm-tap.js`** (plain JS): the processor keeps a `Float32Array(2048)`, copies `inputs[0][0]` into
  it, and when it is full calls `this.port.postMessage(buf, [buf.buffer])` and allocates a new one. `process`
  returns `true`. It is registered as `"pcm-tap"`.
* **Buffer.** Preallocate `Float32Array(Math.ceil((capSec + 1) * sampleRate))`. Each chunk (about 43 ms at 48 kHz)
  is copied in. Compute its RMS, call `onLevel(levelFromRms(rms))`, and feed the endpointer with
  `t = writtenSamples / sampleRate * 1000`.
* **Endpointer** (`lib/speech/endpoint.ts`, pure: `createEndpointer(cfg?)` → `step(rms, tMs)` returning
  `"none" | "speech" | "stop-silence" | "stop-no-speech" | "stop-cap"`). Numbers (`DEFAULT_ENDPOINT`):

| Parameter | Value | Why |
|---|---|---|
| `ignoreMs` | 150 | Skips iOS mic warm-up clicks |
| Floor | starts at 0.004; while not in speech and `rms < startLevel`: `floor = clamp(0.9·floor + 0.1·rms, 0.0015, 0.05)` | Adapts to the room, like `vad.ts` |
| `startLevel` | `max(0.012, 3·floor)`, for 2 consecutive chunks | About 86 ms; no single-click starts |
| `holdLevel` | `max(0.008, 2·floor)` | Voiced while above it |
| `endSilenceMs` | 900 | Matches conversation mode; tolerates a beginner's pause between words (plan suggested about 700) |
| `noSpeechMs` | 6000 | No speech start by then → `stop-no-speech` |
| Cap | `capSec * 1000` from `durationRange` (6.2) | `stop-cap` |
| `levelFromRms` | `rms ≤ 0.002 ? 0 : clamp((20·log10(rms) + 54) / 46, 0, 1)` | The same curve as the conversation meter (copied, not imported) |

* **Finish(reason).** Disconnect the nodes, stop every track, `ctx.close()`. Set `navigator.audioSession.type =
  "playback"` if available. Copy `buffer.subarray(0, n)`, build `encodeWav(samples, sampleRate)` (16-bit PCM mono,
  44-byte header, `lib/speech/wav.ts`), make an object URL, and set the state to `done`. `stop()` from a tap finishes
  with `"tap"`.
* **Cleanup.** On `visibilitychange` to hidden, `pagehide` or unmount: discard the recording (no result), release
  everything, state `idle`. Revoke the previous `wavUrl` on `reset()`, on a new `start()` and on unmount. No wake lock
  (clips are at most 10 s). `start()` while starting or recording is a no-op. Guard every async step with a
  generation counter, as `useVoiceCapture` does (the pattern is copied, not imported).

## 6. On-device checks (`lib/speech/checks.ts`, pure, deterministic)

### 6.1 Inputs and pipeline

```ts
export type ResultState = "success" | "near-miss" | "thanks" | "no-speech" | "too-quiet" | "too-noisy" | "too-short" | "too-long";
export type AttemptResult = { state: ResultState; rose: boolean | null; riseSt: number | null; speechSec: number;
  peakDb: number; noiseDb: number; snrDb: number; minSec: number; maxSec: number; contour: number[] | null };
export function analyzeAttempt(a: { samples: Float32Array; sampleRate: number; fr: string; stoppedBy: StopReason;
  attempt: number /* 1-based, this one included */ }): AttemptResult;
```

1. `cfg = { ...DEFAULT_FEATURES, sampleRate: a.sampleRate }`; `energyDb = frameSignal(a.samples, cfg).energyDb`.
   There is no resampling here: frame energy in dB does not depend on the rate, and skipping it keeps 10 s clips fast.
2. `problem = speechProblem(energyDb)` (spike: silent if there are under 10 frames or the peak is under -60 dB; noisy
   if the peak is less than 12 dB above the 10th percentile). `peakDb = max`, `noiseDb = 10th percentile`, rounded to
   0.1.
3. Decide, in this order (the first that applies wins):

| # | Condition | State | Source of the number |
|---|---|---|---|
| 1 | `stoppedBy === "no-speech"` or `problem === "silent"` | `no-speech` | spike `speechProblem` (-60 dB) |
| 2 | `problem === "noisy"` | `too-noisy` | spike: refuse under 12 dB peak-to-floor (plan §3.1) |
| 3 | `peakDb < -45` | `too-quiet` | Our own: 15 dB above the silence gate. Normal speech at 20 cm is about -30 to -15 dB; to be calibrated in the lab |
| 4 | `stoppedBy === "cap"`, or `speechSec > maxSec` | `too-long` | 6.2 |
| 5 | `speechSec < minSec` | `too-short` | 6.2 |
| 6 | `isRiseQuestion(fr)` and `riseSt !== null` and `riseSt ≤ 0.5` | `near-miss` | 6.3 |
| 7 | otherwise | `success` (with `rose = riseSt ≥ 2` for rise questions, else `null`) | |

   `speechSec = max(0, trimSilence(energyDb).end - start - 10) × 0.01`. The 10 frames are the spike's 5-frame pad on
   each side.
4. **Leniency:** if `attempt ≥ 3` and the state is `too-short`, `too-long` or `near-miss`, return `thanks` (plan §6.3:
   stop suggesting after the second retry). `no-speech`, `too-quiet` and `too-noisy` stay as they are, since there
   is nothing to replay.
5. Round every reported number (to 0.01 for seconds, 0.1 for dB and semitones). The same clip always gives the same
   result.

### 6.2 Expected length without a reference (`durationRange(syl)` in `text.ts`)

* `minSec = max(0.15, 0.08 × syl)`. Faster than 12.5 syllables a second is impossible, so this only catches a clip
  cut off before the phrase.
* `maxSec = 1.2 + 0.6 × syl`. Slower than 1.7 syllables a second, plus 1.2 s of slack for a hesitant beginner.
* `capSec = clamp(maxSec + 2, 5, 10)`. The recorder's hard stop.

Vectors: 1 syllable → 0.15 / 1.8 / 5; 2 → 0.16 / 2.4 / 5; 5 → 0.4 / 4.2 / 6.2; 8 → 0.64 / 6.0 / 8; 13 → 1.04 / 9.0 / 10.
The range is deliberately much wider than the spike's reference-based gate (0.4-2.5 × the reference length), because
it rests on a heuristic syllable count.

**When a real recording exists:** learners still use only this heuristic range. The recording's own duration and the
spike's `compare()` (`durationRatio`, DTW, warps) run **only in the Speak lab** (section 10). Once calibration
supports it, a later change may switch learners to the reference-based gate; this spec does not.

### 6.3 Question rise (`isRiseQuestion` phrases only)

Take the trimmed span: samples `[start·hop, end·hop)` with `hop = round(sampleRate × 0.01)`. Resample it to 16 kHz
with `resample()`, scale it so its absolute peak is 0.5 (YIN's `minRms` of 0.01 is absolute), then run
`yinTrack(seg, 16000)` and `finalMovement(f0)` (defaults: the last 15 voiced frames, about 150 ms, against the 30
before; octave-error filter at ±7 semitones). `riseSt = round(mv, 0.1)` or `null`. Decisions:

* `≥ 2.0` semitones: rose. Plan §5.1 sets 2 as the bar; the spike measured +3.2 for a 5-semitone rise at both 120 and
  220 Hz.
* `≤ 0.5`: flat or falling, so `near-miss`. The spike measured -2.6 for a fall.
* In between, or `null` (too little voicing): say nothing about pitch.

`contour` (rise phrases only): the voiced f0 in semitones against the clip's median, decimated to at most 60 points.
On `near-miss` it is drawn as a 120×32 SVG polyline in `text-accent`, with the caption `Your voice` and a small up
arrow at the end labelled `aim here`. No model contour (the device voice cannot be captured).

### 6.4 Step state machine (`lib/speech/flow.ts`, pure reducer)

States: `ready`, `recording`, `processing`, `result(result)`, `blocked(why)`, each carrying `attempts`. Events and
transitions:

* `ready` + start → `recording`
* `recording` + recorded → `processing`
* `recording` + cancel → `ready`
* `processing` + analyzed → `result`, with `attempts + 1`
* `result` + retry → `ready`
* any state + blocked → `blocked`
* `blocked` + retry → `ready`

Every other pair leaves the state unchanged. `canContinue = attempts ≥ 1 || tag === "blocked"`. Run
`analyzeAttempt` inside `setTimeout(0)` after entering `processing`, so "One moment…" paints first.

## 7. Shadowing replay (`components/speech/ShadowControls.tsx`, `lib/speech/playback.ts`)

* **Three buttons:**
  * **Model, you, model** (`btn`, `Repeat` icon). It plays the model, waits 400 ms, plays the learner's clip, waits
    400 ms, then plays the model again. While it plays, the button reads **Stop**, and an `aria-live="polite"` line
    shows `Model` / `You` / `Model`.
  * **Model** (`btn ghost`, `Volume2`).
  * **Me** (`btn ghost`, `User`).
* **Model playback** (`playModel(fr, { slow, voice })`): if `referenceBlobUrl(fr, voice)` resolves, play it in audio
  element A (`playbackRate` 0.75 with `preservesPitch = true` when `slow`). Otherwise use
  `speak(fr, slow, { end })`, with a safety timer of `1500 + 400 × syllables(fr)` ms (doubled when slow) in case iOS
  never fires `onend`. If `speak` returns false and there is no recording, hide Model and Listen/Slow and show
  `The phone's French voice isn't available, so only your recording plays.`
* **Learner clip:** audio element B, `src = recording.wavUrl`, `playsinline` attribute, `preload="auto"`, volume 1.
  Create A and B once per `SpeakStep` (in a ref) and pause both on unmount.
* **iOS safety:**
  1. The replay buttons are enabled only in state `done`, after the mic tracks are stopped and the context is
     closed, so output is not routed to the earpiece at low volume.
  2. In the tap that starts a sequence, prime B: `B.muted = true; B.play().then(() => { B.pause(); B.currentTime = 0;
     B.muted = false; })`, so B may later start from the TTS `onend` callback, outside a gesture. The model step 3
     reuses A, already unlocked by step 1.
  3. Set `navigator.audioSession.type = "playback"` before playback when available.
* **Dev event:** `playback.ts` dispatches `window.dispatchEvent(new CustomEvent("speak-playback", { detail }))` with
  `detail` one of `"model" | "me" | "end"`. Harmless in production; used by Playwright.
* **Hint line** under the buttons: `No sound? Flip the silent switch off.` (the same wording as `Speaker.tsx`).

## 8. Reference loader

**Files.** `public/reference/<voice>/<stem>.<ext>`. `voice` matches `/^[fm][1-9]$/` (`f1` is the first woman, `m1`
the first man). `stem = phraseKey(fr).replace(/ /g, "-")`. A phrase key has only `[a-z0-9 ]`, so the stem has only
`[a-z0-9-]` and maps back with `-` → space. Examples: `s-il-vous-plait.m4a`, `ca-va.m4a`. `ext` is `m4a`
(preferred), `mp3` or `wav`.

**Manifest** `public/reference/manifest.json` (committed, regenerated on every build and dev start):
`{ "version": 1, "voices": { "f1": { "s il vous plait": { "file": "s-il-vous-plait.m4a", "v": "3f9a1c2e" } } } }`
(`v` = the first 8 hex digits of the SHA-1 of the file). This is how existence is checked cheaply: one small fetch
per page load, no per-phrase HEAD requests.

**API (`lib/speech/refs.ts`, client):**

```ts
export type RefManifest = { version: 1; voices: Record<string, Record<string, { file: string; v: string }>> };
export const EMPTY_MANIFEST: RefManifest;
export const fileStem: (key: string) => string;
export function parseManifest(json: unknown): RefManifest;          // anything malformed -> EMPTY_MANIFEST
export function loadManifest(): Promise<RefManifest>;               // memoized per page load; fetch("/reference/manifest.json", { cache: "no-cache" }); any error -> EMPTY
export function voicesFor(m: RefManifest, fr: string): string[];    // sorted f1, m1, f2, m2, …
export function referenceUrl(m: RefManifest, fr: string, voice?: string): string | null; // `/reference/${voice}/${file}?v=${v}`
export function referenceBlobUrl(fr: string, voice?: string): Promise<string | null>;  // fetch -> blob -> object URL
export function prefetchReferences(frs: string[]): void;            // fire and forget
export function preferredVoice(): string; export function setPreferredVoice(v: string): void; // localStorage "le-nid-ref-voice", default "f1"
```

`referenceBlobUrl` chooses the voice in this order: `voice` if it has the phrase, then `preferredVoice()`, then the
first voice in `voicesFor`. It keeps an LRU of 24 object URLs and revokes evicted ones. A failure (network or HTTP
error) is remembered for the page load and returns `null`, and the caller silently uses TTS. Playing from a blob URL
avoids Safari's media Range requests going through the service worker. `SpeakStep` calls
`prefetchReferences([fr])` on mount.

**Service worker (`public/sw.js`):** add `const REFERENCE = "reference-v1"`, add it to `KEEP`, and set
`MAX_REFERENCE = 300` (at about 10-30 KB per clip, at most about 9 MB). Before the `/bible/` block:

* `p === "/reference/manifest.json"`: **network-first**. On success, `remember(REFERENCE, req, res.clone())`.
  Offline, use `caches.match(req, { cacheName: REFERENCE })`, else `Response.error()`.
* Other `p.startsWith("/reference/")`: if `req.headers.has("range")`, return (go to the network). Otherwise
  **cache-first** on the full URL including `?v=`, so a re-recorded file gets a new URL, then
  `remember(REFERENCE, req, res.clone(), MAX_REFERENCE)`.

**Auth:** `proxy.ts` keeps covering `/reference/` (volunteer voices stay behind sign-in; `good()` already rejects
redirects to `/login`). No matcher change.

**`scripts/build-reference-manifest.mjs`** (plain Node, no TS imports, so the build never depends on them):

1. Scan `public/reference/*/` for folders matching the voice pattern and files matching
   `/^[a-z0-9]+(-[a-z0-9]+)*\.(m4a|mp3|wav)$/`. Warn and skip anything else, with a fix hint:
   `skipped f1/Bien sûr.m4a: name it with the phrase key, e.g. bien-sur.m4a`.
2. If two extensions share a stem, keep m4a, then mp3, then wav, and warn.
3. Write sorted JSON with 2-space indent and a trailing newline. Print `reference manifest: f1 12, m1 0`.
4. Exit 0 even with warnings. A missing folder writes `{ "version": 1, "voices": {} }`.

In `package.json`, add `"prebuild"` and `"predev"`: `node scripts/build-reference-manifest.mjs`. Add
`public/reference/f1/.gitkeep` and `public/reference/m1/.gitkeep`.

**`scripts/make-reference-list.mjs`** (imports the TS modules through the same loader hooks as
`scripts/check-curriculum.mjs`):

* **Arguments:** `--format md|csv` (default `md`), `--out <file>` (default stdout), `--only say-it|sounds|all`
  (default `all`).
* **Row order:**
  1. The Say-it phrases in table order (priority `say-it`).
  2. The union of `practiceSet(tag, allLessonIds)` and `practiceSet(tag, [])` over the 7 tags, deduplicated
     (priority `sounds`).
  3. All other phrases in course order (priority `course`).
* **Columns:** `n, file, french, english, lesson, priority, note`, plus one column per voice folder found (`f1`,
  `m1`, …) holding `yes` when that file exists.
* **Output:** Markdown gets a heading, the line `How to record: see docs/recording-guide.md.` and a table; CSV uses
  RFC 4180 quoting. Then print to stderr any files whose stem matches no phrase key.

### 8.1 `docs/recording-guide.md` (create with exactly this content, as plain prose and lists)

> **Recording French phrases for Le Nid.** Thank you for lending your voice! Learners hear your recording as the
> model and compare their own voice with it. *What you need:* an iPhone (or any phone) with the Voice Memos app, a
> quiet room, and the phrase list your contact sends you (a table with a **file** column, for example
> `s-il-vous-plait`). *The room:* a small, soft room (a bedroom with curtains, or a closet of clothes); windows shut;
> no fan, music, TV or dishwasher; phone on airplane mode. *The phone:* hold it 15-20 cm (a hand's width) from your
> mouth, slightly to the side so your breath doesn't hit it; keep the same spot, distance and room for the whole
> session. *How to say it:* your normal, clear, everyday French at a natural pace, as you would say it to a visitor;
> keep the usual liaisons; a regional accent is welcome. Don't read the English, and say only the French phrase.
> *One clean take per phrase:* tap record, wait one second, say the phrase once, wait one second, stop. If you
> stumble, delete it and record again. *Loudness:* speak at a normal conversational volume, not whispered and not
> projected. If the waveform touches the top and bottom edges, move the phone a little further away. *Naming:*
> rename each memo to the exact **file** name from the list (lowercase, hyphens, no accents, no extension), for
> example `bien-sur`. *Trimming:* you don't need to trim; leaving about a second of silence at each end is fine. *Sending:*
> share the memos (or a zipped folder) with your contact. Sessions of 30 minutes with breaks are plenty. *Voices:*
> we need one woman and one man to record the same list; tell your contact which you are. *Permission:* you will be
> asked to sign a short release so Le Nid may use the recordings in the app. **For the person preparing the files:**
> put each file in `public/reference/f1/` (woman) or `public/reference/m1/` (man) as `<file>.m4a`. Optionally
> normalize first: `ffmpeg -i in.m4a -af "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.15,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.15,areverse,highpass=f=70,loudnorm=I=-18:TP=-1.5:LRA=11" -ac 1 -ar 44100 -c:a aac -b:a 48k out.m4a`
> (trims to a 150 ms pad and sets -18 LUFS, as plan §4.3 recommends). Then run `node scripts/build-reference-manifest.mjs`
> and commit. The app picks the recordings up after the next deploy. Check progress with
> `node scripts/make-reference-list.mjs --only say-it`.

## 9. File-by-file plan

**New files**

| Path | Exports / content |
|---|---|
| `lib/speech/text.ts` | `speechWords`, `nWords`, `syllables`, `durationRange(syl): { minSec; maxSec; capSec }`, `soundTags`, `isRiseQuestion`, `speakable`, `BLOCKED_WORDS`, `type SoundTag` |
| `lib/speech/select.ts` | `speakPhrasesFor(lessonId): Phrase[]`, `withSpeakSteps(exs: Exercise[], lesson: Lesson): Exercise[]`, `SOUND_CARDS: { tag: SoundTag; label: string; tip: string }[]` (section 3.2 order and copy), `practiceSet(tag, completed): Phrase[]` |
| `lib/speech/endpoint.ts` | `DEFAULT_ENDPOINT`, `createEndpointer`, `levelFromRms` |
| `lib/speech/checks.ts` | `analyzeAttempt`, `type ResultState`, `type AttemptResult`, `type StopReason` |
| `lib/speech/copy.ts` | `RESULT_COPY: Record<ResultState, { title?: string; body: string }>`, `ROSE_BODY`, `BLOCKED_COPY`, `PROMPT_COPY` (every string from section 2, nowhere else) |
| `lib/speech/flow.ts` | `type StepState`, `type StepEvent`, `stepReducer`, `canContinue` |
| `lib/speech/wav.ts` | `encodeWavBytes(samples, rate): Uint8Array`, `encodeWav(samples, rate): Blob` |
| `lib/speech/refs.ts` | section 8 API |
| `lib/speech/playback.ts` | `createPlayers()`, `playModel`, `playClip`, `playShadow(fr, wavUrl, opts, signal)`, `stopAll()` |
| `lib/speech/settings.ts` | `SPEAKING_KEY = "le-nid-speaking"`, `speakingOn()`, `setSpeakingOn(on)` (try/catch, default on) |
| `components/speech/useRecorder.ts` | section 5 |
| `components/speech/SpeakStep.tsx` | `export default function SpeakStep({ fr, en, note, mode, onDone, onCantSpeak, onReact }: { fr: string; en: string; note?: string; mode: "lesson" \| "practice"; onDone: () => void; onCantSpeak?: () => void; onReact?: (c: Cue) => void })` |
| `components/speech/ModelButtons.tsx` | Listen / Slow / voice switch via `refs.ts` + `playback.ts` |
| `components/speech/ShadowControls.tsx` | section 7 |
| `components/speech/SpeakingToggle.tsx` | section 2.5 checkbox |
| `components/speech/SoundsPractice.tsx` | `({ completed }: { completed: string[] })`, section 2.4 |
| `components/speech/SpeakLab.tsx` | section 10 |
| `app/(app)/french/practice/sounds/page.tsx` | server: read `lesson_progress` (`select("lesson_id")`; on error `[]`), render `SoundsPractice` |
| `app/(app)/french/speak-lab/page.tsx` | renders `SpeakLab` |
| `app/dev/speak/page.tsx` | dev harness: `notFound()` when `process.env.NODE_ENV === "production"`; otherwise finds the phrase by exact `fr` from `?phrase=` (default `Très`) in `ALL_PHRASES` and renders `SpeakStep mode={?mode ?? "lesson"}` inside `max-w-xl p-4` with `onDone` writing `Done` to a `data-testid="dev-done"` element |
| `public/speech/pcm-tap.js` | section 5 |
| `public/reference/manifest.json`, `public/reference/f1/.gitkeep`, `public/reference/m1/.gitkeep` | section 8 |
| `scripts/build-reference-manifest.mjs`, `scripts/make-reference-list.mjs`, `docs/recording-guide.md` | section 8 |
| `lib/speech/phase1.test.mjs` | section 11.1 |
| `playwright.config.ts`, `e2e/make-fixtures.mjs`, `e2e/speak.spec.ts` | section 11.2 |

**Small edits to existing files**

| File | Edit |
|---|---|
| `lib/french/exercises.ts` | The union member and the `K` change from section 4. Nothing else |
| `components/french/LessonPlayer.tsx` | Imports (`SpeakStep`, `withSpeakSteps`, `speakingOn`); the queue build; `dropSpeak`; `skip` also calls `dropSpeak`; the render branch for `speak` (section 4) |
| `app/(app)/french/page.tsx` | After the Practice block, always render `<Link href="/french/practice/sounds" className="card flex min-h-12 items-center gap-3 !py-3 font-bold"><Mic size={20} className="shrink-0 text-accent" aria-hidden="true" /><span className="flex-1">Pronunciation practice</span><ChevronRight size={20} className="text-muted" aria-hidden="true" /></Link>` (import `Mic`) |
| `app/(app)/me/page.tsx` | `<div className="card gap-2"><h2 className="label">French practice</h2><SpeakingToggle /></div>` between `ProfileForm` and `GentleToggle`. `ProfileForm.tsx` untouched |
| `public/sw.js` | Section 8 |
| `proxy.ts` | First line of `proxy()`: `if (process.env.NODE_ENV !== "production" && request.nextUrl.pathname.startsWith("/dev/")) return NextResponse.next();` (lets the harness and Playwright run without sign-in; inert in production) |
| `package.json` | Scripts `prebuild`, `predev`, `"test:speech": "node lib/speech/phase1.test.mjs"`, `"e2e": "playwright test"`; devDependency `@playwright/test`, pinned exactly (`npm i -D -E @playwright/test@1`) |
| `.gitignore` | `/test-results`, `/playwright-report`, `/e2e/fixtures/` |
| `lib/speech/features.ts`, `pitch.ts`, `score.ts`, `align.ts` | Header comment only: replace "SPIKE, NOT WIRED INTO THE APP" with "Used by lib/speech/checks.ts (features, pitch) and the Speak lab (score, align)". No code change |
| `BottomNav.tsx`, `RouteBackdrop.tsx` | **No change.** `/^\/french\/./` already makes `/french/practice/sounds` and `/french/speak-lab` immersive; `/dev/speak` is outside the `(app)` layout |
| `MeetPhrases.tsx`, `Speaker.tsx`, `ExerciseViews.tsx`, `ProfileForm.tsx`, `components/talk/**`, `lib/talk/**` | **Untouched** |

## 10. Speak lab (hidden tester view, `/french/speak-lab`)

* **How to open:** tap the "Pronunciation practice" title 5 times within 3 s, or type `/french/speak-lab` in Safari.
  Nothing links to it. It is open to any signed-in user. Header: `Speak lab (testers)` and the line
  `For calibration only. Numbers stay on this phone until you export them.`
* **Labels** (remembered in `localStorage["le-nid-speak-lab-meta"]`):
  * tester code (text);
  * voice group (`female` / `male` / `other`);
  * room (`quiet` / `noisy` / `outdoor`);
  * attempt (`careful` / `anglicized` / `natural`).
* **Phrase picker:** the 41 Say-it phrases, then the 7 practice cards (all-completed scope), deduplicated, plus a
  search box over every phrase.
* **Per attempt:** record with `useRecorder` and `durationRange` (the same as learners). Show the learner-facing state
  and copy, then a table of every number:
  * the recording: sample rate, track settings (`echoCancellation`, `noiseSuppression`, `autoGainControl`,
    `sampleRate`), clip seconds, `stoppedBy`;
  * the checks: speech seconds, peak, noise and SNR in dB, min and max seconds, `riseSt`, nuclei (`countNuclei` over
    the trimmed energy);
  * the analysis time in ms.
* **If a reference exists** for the selected voice: decode the blob with `decodeAudioData` on an `AudioContext`
  created in the tap. Show the reference seconds and run `compare(ref, attempt)` from `score.ts`, with word spans
  approximated by splitting the reference's trimmed span across `speechWords(fr)` in proportion to each word's
  `syllables`. Label it `approximate word spans`. Show `distance`, `warp`, `durationRatio`, nuclei, each word's
  `relative`, and `weakestWord(words, PLACEHOLDER_THRESHOLDS)` labelled `placeholder threshold, testers only`. Run it
  in `setTimeout(0)` behind `Analysing…`.
* **Buttons:**
  * **Save row**: appends to `localStorage["le-nid-speak-lab-rows"]` (a JSON array, at most 500 rows, oldest dropped).
  * **Download WAV**: an `<a download="<tester>-<stem>-<n>.wav">` link to the recording's object URL.
  * **Export CSV**: a Blob link named `speak-lab-YYYYMMDD-HHMM.csv`.
  * **Copy CSV**: `navigator.clipboard.writeText`.
  * **Clear rows**: after `confirm("Delete all saved rows on this phone?")`.
* **CSV columns, in order:** `timestamp, tester, voiceGroup, room, attemptType, key, fr, syllables, minSec, maxSec,
  capSec, sampleRate, echoCancellation, noiseSuppression, autoGainControl, clipSec, stoppedBy, speechSec, peakDb,
  noiseDb, snrDb, state, riseApplicable, riseSt, nucleiAttempt, refVoice, refSec, nucleiRef, distance, warp,
  durationRatio, words, maxRelative, weakestWord, analysisMs, userAgent, raterLabel`. `words` is formatted
  `text:relative` joined by `|`. `raterLabel` is left empty for the human raters (plan §5.5).

## 11. Test plan

### 11.1 Pure-logic tests (`node lib/speech/phase1.test.mjs`; copy the loader hooks from `scripts/check-curriculum.mjs`)

| Area | Assertions |
|---|---|
| `syllables` | Oui 1, Non 1, S'il vous plaît 3, D'accord 2, Bien sûr 2, Je ne sais pas 4, Un peu 2, Vous avez 3, Il y a 3, Bonne journée 3, Où sont les toilettes ? 5, Excusez-moi 4, Pouvez-vous répéter, s'il vous plaît ? 9, Je voudrais goûter la choucroute 8, Ils prient 2, Quatre 1, Une tarte flambée, s'il vous plaît 7 |
| `durationRange` | The five vectors in 6.2 (to 0.01) |
| `soundTags` (as sets) | Oui {u}; Non {nasal}; S'il vous plaît {u, liaison}; D'accord {r, liaison}; Bien sûr {nasal, r, u}; Un peu {nasal, eu}; La rue {r, u}; Moi {oi}; Il y a {liaison}; Monsieur {}; Où sont les toilettes ? {u, nasal, liaison, oi}; Vous êtes d'ici ? {u, liaison, question} |
| `isRiseQuestion` | true: Ça va ?, Vous êtes d'ici ?, Est-ce qu'il y a du porc ?, On se tutoie ?. false: D'où venez-vous ?, Qu'est-ce que vous recommandez ?, Où est la gare ?, Pouvez-vous répéter, s'il vous plaît ?, Merci |
| Selection | `speakPhrasesFor` over all lessons equals the 3.1 table (41 keys in 20 lessons); `practiceSet` for `[]` and for all lesson ids equals the 3.2 table; tag counts equal 231/263/228/81/67/314/40 |
| `withSpeakSteps` | 200 builds per selected lesson: the speak count matches; removing the speak items gives back the input array item for item (`===`); no speak item at index ≤ P or last; no speak item has `key`; the exercise just before a speak item never has the same `fr` unless its anchor was clamped to `L - 2`; a lesson with no selection returns the input unchanged |
| Endpointer | rms 0.0005 for 7 s → `stop-no-speech` at 6000 ± 50 ms; 0.0005 for 0.5 s, 0.1 for 1 s, then 0.0005 → `stop-silence` at 1500 + 900 ± 50 ms; 0.1 forever with cap 5 → `stop-cap` at 5000 ± 50 ms; a single 0.1 chunk → no `speech` |
| `analyzeAttempt` (synthetic 48 kHz, using the e2e generator's functions) | speechlike + Très → success, `rose` null; silence → no-speech; speechlike × 0.003 (about -50 dBFS peak) → too-quiet; speechlike + white noise at 6 dB SNR → too-noisy; a 0.1 s burst + Je voudrais goûter la choucroute → too-short; 9 s of speechlike + Très → too-long; `stoppedBy: "cap"` → too-long; rising + Ça va ? → success, `rose` true, `riseSt ≥ 2`; falling + Ça va ? → near-miss; falling with `attempt: 3` → thanks; rising + Très → `rose` null; the same input twice → deep-equal results |
| Reducer | Every transition in 6.4, plus `canContinue` |
| Copy | No string in `copy.ts` matches `/wrong|fail|incorrect|score|%|error|bad/i` |
| WAV / refs | Header (`RIFF`, `WAVE`, `fmt `, 16-bit, mono, rate, data length = 2 × n); `fileStem("s il vous plait") === "s-il-vous-plait"`; `parseManifest` of `null`, `{}`, `{version:2}` → empty; `referenceUrl` builds `/reference/f1/ca-va.m4a?v=…` and falls back to `m1` |

Keep running the existing checks too: `node scripts/check-curriculum.mjs` and
`node --experimental-strip-types lib/speech/speech.test.mjs`.

### 11.2 Playwright flow (`npx playwright test`)

**`e2e/make-fixtures.mjs`** (Node, no dependencies, deterministic; run from Playwright `globalSetup`; it also exports
`synth()` for the unit tests). It writes 48 kHz mono 16-bit WAVs to `e2e/fixtures/`.

* **Noise bed:** an LCG with seed 1 (`x = (1664525·x + 1013904223) mod 2^32`), uniform ±0.0003.
* **Voiced segment of length `d`:**
  * phase += 2π·f0(t)/48000; `v = Σ_{k=1..20} sin(k·phase)/k`;
  * envelope `0.15 + 0.85·sin²(π·frac(t/0.4))` (syllable-like bumps every 0.4 s, dips about 16 dB);
  * scaled so the segment's peak is 0.3.

| File | Layout | f0 |
|---|---|---|
| `speechlike.wav` | 0.5 s noise, 1.2 s voiced, 2.5 s noise | 140 Hz flat |
| `rising.wav` | the same | 160 Hz for t < 0.8 s, then `160·2^((5/12)·(t-0.8)/0.4)` (+5 st) |
| `falling.wav` | the same | 160, then `160·2^(-(5/12)·(t-0.8)/0.4)` |
| `silence.wav` | 4.2 s noise | none |

**`playwright.config.ts`:**

* `testDir: "e2e"`, `retries: 2` (Chromium loops the fake file, so a capture can start mid-phrase), `timeout: 30000`;
* `webServer: { command: "npm run dev -- --port 3100", url: "http://localhost:3100/dev/speak", reuseExistingServer: true, timeout: 180000 }`;
  `use.baseURL: "http://localhost:3100"`;
* projects, each `chromium` with `launchOptions.args`
  `["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--use-file-for-fake-audio-capture=<abs path>"]`
  and a `grep`:
  * `speech` (`speechlike.wav`, `/@speech/`);
  * `rising` (`/@rising/`);
  * `falling` (`/@falling/`);
  * `silence` (`/@silence/`);
  * `denied`: only `--use-fake-device-for-media-stream` and `--deny-permission-prompts`, `/@denied/`.

**Test ids** (put them in `SpeakStep` and `ShadowControls`):

* `speak-mic`, with `data-recstate` set to the recorder state;
* `speak-result`, with `data-state` set to the result state or the blocked reason;
* `shadow-all`, `shadow-model`, `shadow-me`, `speak-retry`, `speak-continue`, `speak-skip`, `speak-cant`.

**Tests in `e2e/speak.spec.ts`:**

1. `@speech` (`/dev/speak?phrase=Très`):
   * click the mic: `data-recstate` becomes `recording`, then `done` within 8 s, and the result has
     `data-state="success"`;
   * subscribe with `page.evaluate` to `speak-playback` events, click `shadow-all`, and expect
     `["model","me","model","end"]` within 15 s;
   * click `speak-retry`: the mic is ready again; click `speak-continue`: `dev-done` reads `Done`.
2. `@rising` (`?phrase=` the URL-encoded `Ça va ?`): `success`, and the text `Your voice went up at the end` is visible.
3. `@falling` (`Ça va ?`): `data-state="near-miss"`, and an `svg` sparkline is visible.
4. `@silence` (`Très`): within 9 s, `no-speech` with its copy, and no `shadow-me` button.
5. `@denied` (`Très`): `data-state="denied"` with the `Microphone off` title; `speak-continue` works.
6. `@speech` (`?phrase=Très&mode=practice`): there is no `speak-cant`; `speak-skip` makes `dev-done` read `Done`.

### 11.3 Real-iPhone checklist (installed Home Screen app; one older and one newer iPhone; iOS 17 or later)

1. First mic tap shows the permission prompt. Denying shows `denied`; enabling in Settings and tapping Try again
   then works.
2. Recording stops by itself about 1 s after the phrase. The orange mic dot disappears on the result card.
3. Model, Me and Model-you-model all play through the **loudspeaker** at full volume (not the earpiece). Check with
   the silent switch on and off. Check with AirPods.
4. TTS model plays after a recording (audio session restored). The `onend` or fallback timer moves the shadow
   sequence on.
5. Lock the phone or switch apps mid-recording: the mic is released and the step returns to ready. No crash after 20
   attempts in a row (watch for tab reloads).
6. Say-it steps appear only in the lessons in 3.1 and never last. "Can't speak now" removes the rest. The Me toggle
   off removes them and the practice page shows the "turned off" card.
7. XP and streak after a lesson with speaking match one without (compare `xp_events`). `vocab_cards` rows are
   unchanged by speaking.
8. Speak lab: log `getSettings()` (does iOS honour AGC/NS/EC false?), the latency from stop to result (target under
   300 ms for a 3 s clip), and `peakDb` for normal speech in a quiet room (to confirm the -45 dB quiet bar).
9. With one test file in `public/reference/f1/`: it plays instead of TTS, also offline after one play; with the file
   removed and redeployed, TTS returns without an error.

## 12. Acceptance criteria

1. All tests in 11.1 pass. `node scripts/check-curriculum.mjs`, the spike test, `npx tsc --noEmit` and
   `npx eslint lib/speech components/speech app scripts e2e` are clean. The Playwright suite passes.
2. The lessons in the 3.1 table, and no others, contain exactly the listed steps when speaking is on. None when it
   is off.
3. A speak step can never: change XP, streak, cards or `missed`; block Continue after one attempt; show a red border,
   a percentage or the words wrong or fail.
4. Skip, Can't speak now, Try again and Continue are always reachable as specified. A blocked mic never traps the
   learner.
5. No network request carries audio. DevTools shows only `/reference/manifest.json`, `/reference/**` and
   `/speech/pcm-tap.js` fetches added by this feature.
6. Dropping `public/reference/f1/ca-va.m4a` and rebuilding makes "Ça va ?" play the recording, with no code change.
7. The Speak lab exports a CSV with exactly the columns in section 10.
8. `git diff --stat` touches no file under `components/talk`, `lib/talk`, `content/` or `supabase/`, and does not
   touch `MeetPhrases.tsx` or `Speaker.tsx`.

## 13. Risks and "do not" list

| Risk | Mitigation in this spec |
|---|---|
| iOS routes playback to the earpiece after recording | Release the mic before replay; set `audioSession` to `playback`; checklist item 3 |
| `audioSession` or AudioWorklet quirks on some iOS versions | try/catch; ScriptProcessor fallback; Speak lab logs settings |
| The quiet bar (-45 dB) or the noise rule misfires | Generous values; tester CSV to recalibrate; changing them is a constant edit in `checks.ts` |
| Heuristic syllables are wrong for some phrases | Only used for a very wide range; the rule never fails the learner |
| Chromium fake-audio loop phase makes e2e flaky | `retries: 2`; 1-syllable phrase for the main test |
| TTS `onend` never fires on iOS | Fallback timer in `playModel` |
| Lesson length grows (u0: up to 3 extra items) | The items are optional and quick; Can't speak now drops them |

**Do not:**

* show scores, percentages, stars, bands or "accent" numbers;
* use red, or the words wrong, fail or incorrect;
* block progress, or require an attempt before Continue except as specified;
* send audio to any server or call `/api/stt`;
* store audio (except the tester's explicit Download WAV);
* write to Supabase from speaking code, call `award_xp` or `complete_lesson` from it, or give a speak item a `key`;
* show per-word highlights outside the Speak lab;
* import from or edit `components/talk/**` or `lib/talk/**`;
* add COOP/COEP headers, WASM models or new runtime dependencies (Playwright is dev-only);
* change the spike algorithms;
* change `units.json`, migrations, `MeetPhrases.tsx` or `Speaker.tsx`;
* add a wake lock;
* auto-play anything while the mic is open.

## 14. Ordered task list (each step small; run its check before moving on)

| # | Task | Verify |
|---|---|---|
| 1 | `lib/speech/text.ts` (sections 3.1, 3.2, 6.2) and the first part of `phase1.test.mjs` (syllables, ranges, tags, rise) | `node lib/speech/phase1.test.mjs` |
| 2 | `lib/speech/select.ts` (`speakPhrasesFor`, `practiceSet`, `SOUND_CARDS`) plus the table tests | same |
| 3 | `exercises.ts` union and `K` change; `withSpeakSteps` plus its tests | same, plus `node scripts/check-curriculum.mjs` and `npx tsc --noEmit` |
| 4 | `endpoint.ts`, `wav.ts`, `flow.ts`, `copy.ts` plus tests | `node lib/speech/phase1.test.mjs` |
| 5 | `e2e/make-fixtures.mjs` (generator plus exported `synth`); `checks.ts` plus its tests | `node e2e/make-fixtures.mjs && node lib/speech/phase1.test.mjs` |
| 6 | `refs.ts`, `settings.ts` plus tests (mock `fetch`, `localStorage`) | same |
| 7 | `scripts/build-reference-manifest.mjs`, `.gitkeep` files, the manifest, the `prebuild`/`predev` scripts | `node scripts/build-reference-manifest.mjs && cat public/reference/manifest.json` |
| 8 | `scripts/make-reference-list.mjs` and `docs/recording-guide.md` | `node scripts/make-reference-list.mjs --only say-it` (41 rows) and `--format csv` |
| 9 | `public/speech/pcm-tap.js` and `components/speech/useRecorder.ts` | `npx tsc --noEmit && npx eslint components/speech` |
| 10 | `playback.ts`, `ModelButtons.tsx`, `ShadowControls.tsx`, `SpeakStep.tsx` (with test ids) | same |
| 11 | `app/dev/speak/page.tsx` and the `proxy.ts` dev bypass | `npx tsc --noEmit`; then the owner or CI opens `/dev/speak` in `npm run dev` |
| 12 | Playwright config and spec, dependency, `.gitignore` | `npx playwright install chromium && npx playwright test` |
| 13 | LessonPlayer wiring (section 4) | `npx tsc --noEmit && node scripts/check-curriculum.mjs && npx playwright test` |
| 14 | `SpeakingToggle` plus the Me page card | `npx tsc --noEmit && npx eslint components/speech app` |
| 15 | `SoundsPractice` plus `/french/practice/sounds` and the French page link | same |
| 16 | `SpeakLab` plus `/french/speak-lab` and the 5-tap entry | same |
| 17 | `public/sw.js` reference cache | `node --check public/sw.js` |
| 18 | Header comments in the spike files; full run of every check in section 12 | All of section 12.1, plus `git diff --stat` checked against 12.8 |
| 19 | Hand over the 11.3 checklist to the owner for the two iPhones | Checklist filled in |

Open questions for the owner (they do not block the build):

1. Should recordings also replace TTS in `Speaker.tsx` app-wide, including Meet the phrases? That would be a one-line
   change later; this build keeps it inside speaking features.
2. Should recordings be public, so the service worker and CDN can cache them without the auth proxy? This build keeps
   them behind sign-in.
3. Who signs the volunteer release, and is a written template needed?
