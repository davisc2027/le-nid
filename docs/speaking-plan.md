# Speaking practice: research and plan

Scope: a pronunciation-practice feature for the French lessons, scored on the phone and the same every time. It
compares a learner's recording with a native recording of the same phrase. Sources are listed at the end and cited
as [n]. Unverified points are marked **(unverified)**. Most primary hosts were blocked from this sandbox, so many facts
come from search-engine extracts of the cited pages, not full reads. The Duolingo whitepaper [1] was read in full.

## 0. Executive summary

**Can "native voice comparison" be made good?** Partly. As a *grade* it is weak. As a *practice loop* it is strong.

* The CAPT literature has a direct ancestor of the idea: DTW alignment of a learner's utterance against a teacher's
  utterance (Lee & Glass, MIT, 2012-2013 [14][15][16]). It works best when it flags *which word* deviates, not when it
  gives one global number. It got better with speaker-independent features (posteriorgrams), not raw MFCCs [15][17].
* Commercial apps that say they "compare with native speakers" (Rosetta Stone TruAccent "millions of examples" [8],
  ELSA [9]) are describing acoustic models trained on many speakers, not matching against one recording. Duolingo
  grades with speech recognition. Its own blog says it used third-party recognizers supplied by the phone platforms,
  and that it is working toward more lenient grading for beginners and sound-by-sound tips [2].
* The spike in `lib/speech/` (section 5.6) tested this directly on synthetic vowel strings:
  * **The absolute distance cannot tell a correct attempt in a different voice from a real vowel error.** Raising
    the pitch from 110 to 180 Hz moved the distance as much as swapping *ou* for *u* (0.332 vs 0.332). So did a
    longer vocal tract, even after speaker normalization (0.318), and light noise (0.50 at 30 dB SNR).
  * **Comparing each word with the learner's own other words did separate them.** Correct variants scored 1.26 or
    less; single-vowel errors scored 2.86 or more.
  * The relative measure is blind to errors spread over every word, and it needs at least two words.
* Duolingo's own study found French pronunciation the weakest speaking subscore after Unit 5 (30.4, below the A2
  cut of 36). About 28% of the French tests could not be scored by the recognizer [1]. Speaking practice is worth
  building. Strict automated grading of beginners' French is also where machines fail most.

**Recommendation**

| Decision | What | Confidence |
|---|---|---|
| **Build now (Phase 1)** | "Say it" step plus a Pronunciation practice mode built on **shadowing**: native clip, then the learner's own clip, then the native clip again. Feedback comes only from cheap checks that hold up: speech heard, length in range, the rise at the end of yes/no questions, and "too noisy, try a quieter spot". No pass/fail. It never blocks progress. | High that this helps and does no harm. Shadowing and self-listening have evidence [21], and so does visual pitch feedback for English speakers learning French [22]. |
| **Build now, tester-only** | Per-word "this word sounded least like the model" highlight from banded DTW with VTLN warp search. A calibration page logs scores on real iPhones. | Medium-low that it passes the gate. The spike shows the mechanism works on synthetic speech; real speech is untested. |
| **Gate** | Show the highlight to learners only if it has a false-fail rate of 5% or less in every subgroup (female/male, quiet/noisy) and at least 70% precision on the labeled test set (section 5.5). | n/a |
| **Defer (Phase 2)** | A deterministic on-device recognizer with a grammar limited to the target and its near-miss phrases (Vosk small French, about 41 MB, Apache-2.0 [29]). The second option is an opt-in "Check with Whisper" through the existing `/api/stt`. | Low-medium. Memory and accuracy on iPhone are unknown. |
| **Do not build** | A percentage "accent score"; pass/fail on the global distance; on-device Whisper tiny or base (39-45% / 27-31% WER on French [32], 31-142 MB); wav2vec2 or XLSR phoneme models in the browser (about 300M parameters [31]); Azure in production (free coverage of pronunciation assessment unverified [11]); anything that needs COOP/COEP headers. | High |

**Head-to-head with Groq Whisper (existing `/api/stt`):**

| | Phase 1 on-device | Groq Whisper |
|---|---|---|
| Validity | Valid for what it claims: heard, length, question rise, which word deviates (only after calibration). Says nothing about whether the word was intelligible. | Closest thing to "would a French listener get the words". Lenient: Whisper's language model repairs near-misses toward plausible text. With no language hint it may decide the clip is English. |
| Determinism | Same clip gives the same result. Rounded to 1e-4 to absorb engine `Math.*` differences. | `temperature: 0` reduces variation but does not guarantee it (unverified for Groq). |
| Cost | Free, offline, works on bad networks in Strasbourg. | Free tier, but shared: about 20 requests a minute for the whole group, and 120 clips a day per user (`lib/talk/api.ts`). Two or three speaking items per lesson across 35 people at the same time would hit the group limit. |
| Effort | About 8-12 dev days plus references and calibration. | About 2-3 days (route and UI exist). |
| Privacy | Audio never leaves the phone. | Audio goes to Groq (not stored by us). |

Verdict: build Phase 1 on the device. Keep Whisper as an opt-in, non-graded "Did it understand you?" button in
Phase 2, if testers ask for word-level checking and the quota allows.

## 1. Baseline: what Duolingo and others actually do

### 1.1 Duolingo

* **Recognition-based, not comparison-based.** "Speech recognition technology is used for all speaking exercises in
  both courses in order to provide learners with feedback" [1]. Duolingo's blog says exercises were graded by
  third-party recognizers from the phone makers' platforms. Speech was not saved. It later began opt-in, anonymized
  collection to build pronunciation tips, sound-by-sound feedback and **more lenient grading for beginners** [2].
* **Feedback granularity.** An independent study of the German course: learners say words and "Duolingo's voice
  recognition software passes or fails them, but does not provide detailed targeted feedback". The same study cites
  only 71% agreement between two human raters of pronunciation [4]. Human judgments are noisy too, which matters for
  calibration.
* **Skip.** "Can't speak now" pauses speaking exercises for 15 minutes. An undo for accidental skips was rolling out
  in August 2026. Source: one news report [3] **(unverified by Duolingo)**. Skipped items come back later (forum
  reports). A mic button also lets learners speak a translation answer instead of typing it [5].
* **Outcome.** After Unit 5, French learners averaged low A2 overall, but pronunciation was the weakest subscore
  (30.37, under the A2 threshold of 36). 43 completed French tests (about 28%) were unscorable by the Versant
  recognizer, which the authors attribute to unclear pronunciation [1].
* Retry and highlighting: third-party guides describe "try again" prompts even after good attempts **(unverified)**.
  I found no Duolingo-published threshold or per-lesson limit.

### 1.2 Other consumer apps

| App | Method (as published) | Feedback shown | Notes |
|---|---|---|---|
| Babbel | Hear the target first (snail icon for slow), record, "analyses your pronunciation… how closely it matches" [7] | Pass/retry. In 2010: 0-100, where 50 or more meant "generally understandable" [7] | Advises a quiet room and saying exactly the shown phrase. Web only in Chrome for most languages |
| Busuu | Recognition | Mispronounced words in red, a few attempts, then move on [6] | Same word-highlight pattern we propose |
| Rosetta Stone TruAccent | "Compares… with millions of examples from native speakers" [8] | Red / yellow / green; **adjustable sensitivity**; children's voice setting [8] | Marketing; no technical detail |
| ELSA Speak | Model trained on non-native accents, phoneme level; "% native-like" [9] | Per-sound colors; mode testing only the target sound | English only; the % is not validated publicly |
| Speak | Custom on-device and third-party ASR, later one NeMo-based backend trained on learner speech; phoneme models for a "Pronunciation Coach" [10] | Word accuracy, some prosody **(unverified)** | Shows the effort needed for real phoneme feedback |
| Mondly, Memrise | Speech recognition; "positive feedback only when clear and correct" (Mondly store copy) | Not documented | **Unverified**; nothing primary found |

### 1.3 Vendor APIs and what their scores mean

| API | Metrics | fr-FR | Free? |
|---|---|---|---|
| Azure Pronunciation Assessment [11] | **Accuracy** (how closely phonemes match native), **Fluency** (pauses and timing vs native), **Completeness** (reference words spoken), **Prosody** (stress, intonation, rhythm; **en-US only**). Overall pronunciation score; word and phoneme granularity; syllable level en-US only | Listed among about 33 locales. Phoneme names/IPA for fr-FR are disputed: one third-party note says English only [11] | Billed like speech-to-text; F0 gives 5 audio hours a month of STT. Whether assessment draws on it is **unverified**; needs an Azure account and card |
| Speechace [12] | `quality_score` 0-100 at utterance, word, syllable and phoneme level, plus CEFR estimates | Yes, fr-fr and fr-ca (v9.9) | Paid (about $40 a month per a third party) **(unverified)** |
| Google Cloud STT, Amazon Transcribe | No pronunciation assessment found; recognition only | n/a | n/a |

Under the hood these use **Goodness of Pronunciation (GOP)** [13]: force-align the expected phones, then compare
each phone's likelihood with the best competing phone. The score is high when the acoustic model "hears" the intended
phone. It needs a trained acoustic model and per-phone thresholds tuned on human ratings. Known limits: it relies on
forced alignment, it ignores context effects such as liaison [16], and averaged GOP is a poor sentence score [16][17].

**Takeaway for us:** every serious system scores against a *model of many native speakers*. Matching against *one
recording* is the weakest form, so it should only make relative, word-level, low-stakes claims.

## 2. Pedagogy

### 2.1 What the evidence supports

* **Aim for intelligibility, not native-likeness.** Accent, comprehensibility and intelligibility are "related but
  partially independent". Speech can be heavily accented yet fully intelligible (Munro & Derwing 1995, replicated)
  [18]. A missionary team needs to be understood in Strasbourg, not to pass as French. Never show a "% native" score.
* **Instruction works, especially with feedback and narrow targets.** A meta-analysis of 86 reports found large
  effects (d of about 0.8-0.9). Effects were larger with feedback and longer treatment [19]. Saito & Plonsky (77 studies): most
  effective when targeting specific segmental or suprasegmental features in monitored production [19]. So the
  practice mode should drill one sound at a time.
* **Shadowing helps comprehensibility and fluency, not accent.** In an 8-week shadowing study with self-recording,
  learners improved on every measure except accentedness [21]. That matches our goal.
* **Perceptual training transfers modestly to production.** High-variability phonetic training gives medium-to-large
  perception gains [20]. Its effect on production is small to medium (about 10% on trained items, 4.5% untrained), with
  weak retention [20]. Use it as a cheap warm-up (hear *tu / tout*, pick which), not as the main course.
* **Visual pitch feedback works for English speakers learning French.** Hardison's computer-assisted prosody
  training displayed the learner's and model's pitch contours. Secondary summaries report better prosody that generalized (LLT 8(1),
  2004; ICSLP 2002; full text not read) [22]. This directly supports a pitch-contour view for questions.
* **Imperfect automatic feedback can still help, but false rejections hurt.** ASR-based feedback improved targeted
  phonemes despite occasional errors [23]. Neri et al. warn that commercial CAPT chases technology over pedagogy
  [23]. Microsoft Reading Progress flagged correct words as wrong, and reviewers advised caution [24]. Hence the
  design rule: **when unsure, say nothing**.

### 2.2 The English-speaker difficulty set, mapped to our course

Counts are phrases in `content/french/units.json` (468) that contain the spelling. They are rough, but show where
practice pays off.

| Difficulty | What goes wrong | Example phrases (u0 in bold) | Count | Machine-checkable? |
|---|---|---|---|---|
| u /y/ vs ou /u/ | *tu* said as "too" (lips rounded, tongue back) | **Tu**, **La rue**, **Bien sûr**, Salut, Pouvez-vous parler plus lentement ? | u: about 61; ou: about 179 | F2 differs by about 1000 Hz (u F2 ≈ 2060 vs ou ≈ 1150 Hz in one corpus [26]). Plausible on clean vowels; untested on phones |
| eu /ø/, œ | said as "uh" or "oo" | **Un peu**, Je crois en Dieu, Juste deux minutes | about 92 | Weaker; F2 between the two |
| Nasal vowels (an/en, on, in/un) | a final n or m pronounced; vowel not nasal | **Non**, **Un peu**, Bonjour, À bientôt, Enchanté | 95-158 each | Nasality is hard to measure acoustically; ASR-only |
| French r | English approximant r | **La rue**, **Très**, D'accord, Merci, Au revoir | about 313 | Not reliably from signal features; ASR or GOP only |
| oi = "wa" | "oy" | **Moi**, **Voilà**, Bonsoir, Au revoir | about 71 | ASR-only |
| Silent final letters | saying t, d, s | **S'il vous plaît**, **D'accord**, **Très** | many | Partly: the length ratio and DTW word cost rise when extra segments are added |
| Liaison, enchaînement | missing the z in *vous‿avez*; choppy *il y a* | **Vous avez**, **Il y a** | dozens | Partly: pause detection inside the chunk (energy gap) |
| h muet | pronouncing h | l'hôtel (u7) | few | ASR-only |
| Syllable timing, final stress | English stress-timing, reduced vowels | all longer phrases | all | Partly: nuclei count and duration evenness; noisy |
| Question intonation | flat or falling *Ça va ?* | Ça va ?, Vous êtes d'ici ?, On se tutoie ? | 116 questions, about 76 not wh-questions | **Yes**: f0 movement in semitones vs the speaker's own median. Use only for intonation questions in declarative word order; inversion and wh-questions can fall [25] |

Practical consequence: 41 phrases are a single word and 90 have two words or fewer (including most of u0). The
relative per-word check needs two words or more, so it does nothing for *Tu*, *Moi* or *Non*. For those, Phase 1 offers
shadowing, a slow model, articulation tips (the u0 notes already have them), and minimal-pair listening drills.

## 3. Technical options on iPhone Safari / Home Screen app

Constraints checked:

* iOS WebAssembly memory is fragile: only about 300 MB is reliably available, sometimes less after reloads. Failed
  growth kills the tab rather than throwing [34].
* ONNX Runtime Web runs multi-threaded only when the page is cross-origin isolated (COOP/COEP) [35]. Those headers
  would break third-party embeds and need care with Supabase auth redirects; avoid.
* WebGPU ships on by default in Safari 26 / iOS 26 [36] (secondary sources), but not every learner's phone runs it.
* **Apple's recognition is not reachable:** the Web Speech API is unavailable in Home Screen web apps (WebKit bug
  [37]; `lib/talk/browser.ts` already notes this). Safari's recognizer appears to be server-backed (observed on macOS)
  [37]. iOS 26 SpeechAnalyzer is native-only, with no web surface [37].
* Speech synthesis output cannot be captured (previous pass), so references must be audio files.

| Option | Valid for | Deterministic across phones | Download | CPU / memory | License / cost | Tells the learner | Verdict |
|---|---|---|---|---|---|---|---|
| (a) DTW on MFCC/log-mel + CMVN + VTLN warp search + trimming (spike) | Timing; *relative* word deviation; not absolute quality | Yes (rounded) | 0 (plus references) | About 80 ms per 2 s clip with 10 warps on desktop Node; <1 MB | Ours | "This word sounded least like the model" | **Phase 1, tester-gated** |
| (b) DTW on self-supervised features (wav2vec2/HuBERT frames) | Much more speaker-robust [15] | Yes on WASM CPU; WebGPU may differ | 95-360 MB | Heavy; near the iOS limit | Apache/MIT | Same, more reliably | No: too big |
| (c1) Vosk small French (Kaldi) in vosk-browser | Word recognition; **grammar mode** can choose between the target and listed near misses | Yes (Kaldi decoding is deterministic; WASM single-thread) | About 41 MB [29] | Unknown on iOS **(unverified)**; lib 5.8 MB, low adoption [29] | Apache-2.0 [29] | "Heard: *tout*, not *tu*" (word level) | **Phase 2 candidate #1** |
| (c2) sherpa-onnx WASM (zipformer) | Streaming ASR | Yes on CPU | Tens of MB **(unverified for French)** [30] | Unknown | Apache-2.0 | Words | Phase 2 alternative; check for a French model |
| (c3) Phoneme CTC wav2vec2 (espeak IPA) + GOP | Phone-level GOP | Yes on CPU | wav2vec2-lv-60/xlsr-53 about 300M params [31]; base-size French CTC models exist [31] | Too heavy for iOS web | Apache/MIT | Sound level | No (maybe a server job, out of scope) |
| (c4) Whisper tiny/base (transformers.js, whisper.cpp WASM) | Words | Mostly yes | ggml tiny 75 MB / q5 31 MB; base 142 MB / q5 57 MB [32] | About 390-500 MB RAM unquantized [32] | MIT | Words, often wrong: French WER 39-45% (tiny), 27-31% (base) [32] | No |
| (c5) Moonshine | Words | Yes | 27-61M params | Light | MIT | No French model found [33] | No |
| (d) Hybrid: small ASR + signal checks | Intelligibility plus rhythm and pitch | Yes | 41 MB plus | See c1 | | Words plus question rise | Phase 2 shape if c1 passes |
| (e) Local cheap checks: speech present, SNR, duration ratio, nuclei, question rise, F2 for u/ou | Exactly what each claims | Yes | 0 | Negligible | Ours | "Heard you", "a bit fast", "make it rise", "too noisy" | **Phase 1** (F2 check is Phase 2 research) |
| (f) Groq Whisper via `/api/stt` | Words (lenient) | No (unverified) | 0 | Server | Free, shared quota | Transcript | Phase 2 opt-in only |
| (g) Apple native recognition from the web | n/a | n/a | n/a | n/a | n/a | n/a | **Not available** in Home Screen apps [37] |
| Azure Pronunciation Assessment | Accuracy, fluency, completeness, word/phoneme | No (cloud model updates) | 0 | Server | Account plus card; free coverage unverified [11] | Sound level | No for now; revisit only if free coverage is confirmed |

### 3.1 Making (a) fair: what survives

| Nuisance | Effect on raw MFCC distance | Mitigation in the spike | Residual |
|---|---|---|---|
| Loudness, mic gain | Large on c0 | Drop c0, CMVN per utterance | Spike: about 0 at ×0.15 and near clipping |
| Mic and room coloration | Moderate | CMVN removes constant spectral tilt | Untested on real mics |
| Pitch (gender, age) | **Large**: harmonics show through 40 mel bands | None in the features. Pitch is used only relative to the speaker's own median | Spike: the 110 to 180 Hz shift equals a vowel error in absolute terms; harmless in relative terms |
| Vocal-tract length (formants about 15-20% higher in most women) | **Large** (0.86 ≈ "all vowels wrong") | VTLN warp search over 10 factors from 0.84 to 1.20 [15] | Still about one vowel error in absolute terms (0.32) |
| Noise | Large in pauses and quiet bands | Log-mel floor 45 dB under peak; trimming; refusal below 12 dB peak-to-floor | Spike: 30 dB white noise still about 1.5× a vowel error in absolute terms; relative is fine. Synthetic vowels have unrealistically little energy above 4 kHz, so this overstates the problem |
| Tempo | Moderate | DTW with a 25% band | Spike: 0.10-0.13 at ×0.75 and ×1.35, well under a vowel error |
| Recording length, silences | Large | Energy trim with 50 ms pad; length ratio 0.4-2.5 accepted | OK |
| The reference speaker | Learner closer to one model voice | Two or more reference voices; take the minimum over references and warps | To calibrate |

**Rule that follows:** never grade on the absolute distance. Compare each word's cost with the median word cost of
the same attempt, so global voice, mic and room effects cancel. Highlight at most one word, and only when it clearly
stands out.

## 4. Reference audio

### 4.1 Sources

| Source | Fit for our exact phrases | Quality | License / terms | Use |
|---|---|---|---|---|
| **Volunteer native speakers** (Strasbourg partner church, French speakers known to the team) | Exact | Good with the protocol below | Get a short written release (use in the app, any future version, non-exclusive) | **Primary**: 1 female and 1 male voice now; 2 + 2 later |
| Mozilla Common Voice French (Scripted 25.0: about 1,096 validated hours, 21,003 speakers) [38] | **No**: its sentences come from its own corpus; only a few short words might match | Variable phone and laptop mics | CC0-1.0, but the datasheet also **forbids re-hosting** and speaker identification [38] | Offline only: test the false-fail rate across many native voices for words it contains (Oui, Merci, numbers). Do not ship clips |
| Piper TTS (fr_FR siwis, tom, gilles, upmc, mls) [39] | Exact | Clean but synthetic prosody | Engine MIT; **per-voice licenses differ** (siwis: MIT at repo level vs CC BY 4.0 on a mirror) [39] | Development and interim playback only, after checking each voice's model card |
| Coqui XTTS v2 | Exact | Good | **CPML: non-commercial only**, no commercial license available [40] | Avoid |
| Google Cloud TTS | Exact | Very good | Free tier about 1-4M chars a month (we need about 10.5k per voice) but **needs billing enabled** [41]; storage and redistribution terms **unverified** | Optional interim; check Service Specific Terms first |
| Azure TTS | Exact | Very good | F0 0.5M chars a month free [11]; caching terms **unverified** | Same |
| Device `speechSynthesis` (current) | Exact | Varies by iOS voice | n/a | Stays the fallback "Listen" when no recording exists; cannot be scored against |

### 4.2 Recording protocol (studio-free)

1. Quiet, soft room (a closet of clothes or a bedroom with curtains). Phone on airplane mode, 15-20 cm from the
   mouth, slightly off-axis to avoid pops. Same room, phone and distance for the whole session.
2. An in-app admin page `/admin/record` steps through phrases (French plus note), records 48 kHz, shows a level meter
   and plays back. It uploads to a private Supabase storage bucket (the free tier is enough). Two takes per phrase:
   natural conversational pace, then a slower clear take for the existing Slow button.
3. Natural standard French. A light Alsatian accent is fine and authentic. Keep liaisons as a careful speaker would.
4. About 468 × 2 takes × about 12 s with retakes ≈ 3 hours per voice. Split into 30-minute sittings.

### 4.3 Offline generation script (run outside this sandbox)

`scripts/speech/build-references.mjs` (Node, plus `ffmpeg` and optionally the Montreal Forced Aligner):

1. `export`: write `phrases.csv` (key = `phraseKey(fr)`, fr, en, lesson) from `units.json`.
2. `ingest`: pull takes from the bucket. Reject clipping (peak > -0.5 dBFS), estimate SNR (target 30 dB or more), and
   flag duration outliers against a characters-per-second estimate.
3. `clean`: high-pass at 70 Hz, `loudnorm` to -18 LUFS integrated, -1.5 dBTP. (-16 LUFS is the usual mobile podcast
   target [43]; -18 leaves headroom so all clips sound equally loud next to the learner's.) Trim silence to a 150 ms
   pad.
4. `align`: word boundaries using MFA's French model or a quick manual tap tool **(MFA French model license
   unverified)**. Store `[startMs, endMs]` per token of `tokenize(fr)`.
5. `encode`: AAC-LC mono 44.1 kHz at 40 kbps in `.m4a`. iOS decodes it everywhere. Opus/WebM playback and
   `decodeAudioData` were inconsistent in Safari before 17.4 [42].
6. `manifest`: `content/french/speech-refs.json` →
   `{ [key]: { voices: { f1: { file, ms, words: [[s,e],…] }, m1: {…} }, rise?: true } }`. `rise` marks intonation
   questions in declarative word order (to be tagged by hand from the about 76 candidates).
7. Optionally store precomputed reference features (int8, base64), so the reference side never depends on the iOS
   AAC decoder. Determinism then rests only on the attempt pipeline.

### 4.4 Size and caching

The average phrase is 4.4 words. Expect about 1.6-2.0 s per trimmed clip, so about 8-10 KB at 40 kbps.

| Item | Estimate |
|---|---|
| One voice, 468 phrases | about 4-5 MB |
| Two voices plus slow takes | about 14-18 MB (in git under `public/speech/fr/…`; acceptable) |
| One lesson (about 13 phrases × 2 voices, normal speed) | about 250 KB |

Service worker: add a versioned `speech-v1` cache. It is cache-first for `/speech/` with about 600 entries max, like
the Bible cache in `public/sw.js`. When a lesson opens, prefetch that lesson's clips. Nothing is preloaded app-wide.

## 5. Algorithm and scoring

### 5.1 Pipeline (implemented in the spike)

1. **Capture.** Tap to start. VAD auto-stop reuses `createVad` (`lib/talk/vad.ts`) with `endSilenceMs` of about
   700 ms, a cap of 2.5 × the reference length or 8 s, and the same level meter (`meterLevel`).
   * Decode the MediaRecorder blob (AAC on iPhone, `lib/talk/mime.ts`) with `decodeAudioData`. Fall back to an
     AudioWorklet PCM tap if decoding the recorder's blob fails on some iOS version **(unverified on device)**.
   * Ask for `echoCancellation`, `noiseSuppression` and `autoGainControl` set to false. Whether iOS honours this is
     **unverified**: the calibration page records which settings were applied.
2. **Resample** to 16 kHz (windowed-sinc). Apply pre-emphasis of 0.97.
3. **Frames** of 25 ms Hamming windows every 10 ms. FFT size 512. 40 mel bands from 100 to 6500 Hz. The upper limit
   stays below 8000/1.2 so warped filters stay valid.
4. **Log-mel with a floor** 45 dB under the loudest band. Then MFCC c1-c12 (c0 dropped) and **CMVN** over the trimmed
   span.
5. **Trim**: frame energy above max(noise floor at the 10th percentile + 8 dB, peak - 40 dB), first and last runs of
   three or more frames, 50 ms pad. Return `too-noisy` when peak minus floor is under 12 dB, and `no-speech` when the
   peak is under -60 dB.
6. **Length gate**: `durationRatio` must be within 0.4-2.5, otherwise ask for a retry ("That was very short. Say the
   whole phrase?").
7. **Speaker normalization**: compute the attempt features at warps 0.84-1.20 in steps of 0.04, using the same trim
   span. Keep the warp with the lowest DTW distance. With two reference voices, take the minimum over both.
8. **DTW**: symmetric steps, Sakoe-Chiba band of 25% of the longer sequence around the length-scaled diagonal,
   per-frame Euclidean distance (RMS over dimensions), fixed tie order.
9. **Per-word cost**: map path costs onto reference frames and average them over each reference word's span (from the
   manifest). Divide by the median word cost of this attempt to get `relative`.
10. **Question rise** (phrases with `rise`): YIN f0 (70-450 Hz, threshold 0.15). Compare the median of the last 150 ms
    of voiced frames with the 300 ms before, in semitones against the speaker's own median. 2 semitones or more
    counts as "rising". The spike measured +3.2 st for a 5 st rise at 120 and 220 Hz, and -2.6 for a fall.
11. **Rhythm hint** (longer phrases): energy-envelope nuclei count vs the reference. Report only large mismatches.
12. **Round** every reported number to 1e-4 so results are reproducible.

### 5.2 Turning numbers into kind feedback

No percentages. There are three states and at most one tip.

| Outcome | Shown | Odile | Sound |
|---|---|---|---|
| Heard, nothing stands out | "Bien dit ! Listen back and compare." Both play buttons | `calmRight` pool (bounce, hearts, salute) | `playSuccess` |
| One word stands out (only after the gate) | The phrase with that word underlined in amber: "*rue* sounded a bit different. Try it once more?" plus the u0-style tip for the sound in that word, from a small `SOUND_TIPS` map keyed by spelling (r, u, ou, eu, nasals, oi). Example: "For the r in *rue*, keep the tip of your tongue down and make a soft sound at the back of the throat" | none, or `miss` pool (shrug, feather), never pratfalls | none |
| Question did not rise (flagged phrases) | A small contour of their pitch next to the model's: "Make the end go up, like a real question." [22] | none | none |
| Too quiet, too noisy, too short, too long | A specific retry message (section 6.3) | none | none |

The amber highlight is a suggestion, never red, never "wrong". The tip names the sound to try, not the error.

### 5.3 Failure modes and guarantees

* **The feature never blocks progress.** A speaking step can't be failed. It is never added to `missed` and never
  repeated at the end. Continue is always available after one attempt, or right away via "Skip".
* When the signal is ambiguous (noisy, clipped, odd length, low warp confidence), fall back to "Heard you. Listen back
  and compare." Silence beats a false accusation.
* An attempt equal to the reference itself (playback captured by the mic) is detected as a near-zero distance and
  ignored.
* Determinism: Float64 math and fixed tie-breaking are in place. ECMAScript does not require correctly rounded
  `Math.log/cos`, so engines may differ in the last bits. Rounding plus thresholds kept away from hard edges makes
  this irrelevant in practice. Verify on two iPhone models (section 7.3).

### 5.4 Privacy and accessibility

* Audio stays in memory on the phone. It is released after the result, never uploaded and never stored. The
  calibration page is the only exception: testers explicitly save clips locally and export them.
* Speaking is optional everywhere. A Settings toggle, "Speaking exercises", turns it off for good. "Can't speak now"
  skips for the session and is remembered for 1 hour in `localStorage`. People with speech differences or no mic lose
  nothing: no XP, streak or card depends on speaking.
* Every state is readable by VoiceOver (`role="status"` like the current feedback card). Large tap targets (44 px)
  and no hold-to-talk requirement.

### 5.5 Calibration protocol

* **Data.** 12 or more team testers (6 female, 6 male) plus 2-4 native speakers. 30 calibration phrases covering
  the u0 sounds, several two-to-four-word phrases and 8 intonation questions. Each tester records:
  * a careful attempt;
  * a deliberately anglicized attempt ("tou" for *tu*, English r, pronounced silent t, "bon-jour" with a consonant n);
  * a natural attempt in a noisy room (music or chat) and one outdoors.
* **Labels.** Two raters (a native speaker and the teacher) mark each attempt overall (clear / understandable with
  effort / wrong or unclear). For the target word, they mark whether the target sound was right. Report Cohen's
  kappa: human agreement can be as low as 71% [4], which caps how good any machine can look.
* **Split by speaker.** Tune thresholds on 8 testers and test on the rest plus the natives. Never let a speaker appear
  in both sets.
* **Pick thresholds** for `wordRelative`, the length gate and the rise threshold under the constraint
  "false-fail ≤ 5% on good attempts in every subgroup". Then maximize detection of the anglicized attempts. Accept
  missing many errors: lenient is the design.
* **Metrics:**
  * false-fail rate per subgroup (female/male × quiet/noisy) and the gap between subgroups (≤ 3 points);
  * hit rate on anglicized attempts;
  * word-highlight precision (≥ 70%);
  * refusal rate (≤ 10% in ordinary rooms);
  * question-rise agreement with raters;
  * latency (p95 under 500 ms after end of speech);
  * memory (under 50 MB extra);
  * determinism (identical results for the same WAV on two iPhone models and desktop Safari).

### 5.6 What the spike shows (and does not)

`node --experimental-strip-types lib/speech/speech.test.mjs` uses formant-synthesized vowel strings: three "words" of
two vowels, male-like formants, f0 110 Hz. All 13 checks pass. Key numbers:

| Condition | Absolute distance | Max word relative |
|---|---|---|
| Identical | 0.000 | (0) |
| Gain ×0.15 / near clipping | 0.000 / 0.000 | about 1.0-1.2 |
| Tempo ×1.35 / ×0.75 | 0.102 / 0.127 | 1.20 / 1.26 |
| Pitch 110 → 180 Hz | **0.332** | 1.07 |
| Other voice (formants ×1.17, f0 210) no warp / warp search (picked 1.16) | **0.862** / **0.318** | 1.04 / 1.06 |
| White noise 30 / 20 / 10 dB SNR | **0.502 / 0.703 / 0.861** | 1.05 / 1.19 / 1.20 |
| **Error** *ou→u* in word 2, same voice / other voice | 0.332 / 0.472 | **3.75 / 2.86** (word 2) |
| **Error** *o→eu* in word 3 | 0.379 | **3.11** (word 3) |
| All vowels different | 0.991 | 1.05 (blind) |

* Proven on these signals:
  * determinism;
  * gain invariance;
  * trimming of long silences and low noise;
  * DTW absorbs tempo;
  * VTLN warp search recovers about two-thirds of the cross-voice gap;
  * the relative word cost localizes a single swapped vowel, also across voices;
  * a noisy clip is refused rather than judged;
  * YIN finds rising vs falling question endings for low and high voices;
  * 2 s with 10 warps takes about 80 ms in Node.
* **Not proven:**
  * anything about real French speech, real consonants (r, nasals), real iPhone mics or AGC;
  * agreement with human raters;
  * timing on an iPhone.
* The absolute-distance result is a *negative* finding that real speech will not reverse: voice differences are
  larger, not smaller, in real recordings.

## 6. Product and UX

### 6.1 Where speaking appears

1. **"Say it" step in lessons** (new exercise kind `speak`):
   * at most 1 per lesson in the early stage and 2 later;
   * placed in the second (production) pass;
   * only for phrases that have a reference recording, with up to 6 words;
   * never in review or noAudio sessions;
   * never as the last item (so the finish feels earned through normal exercises).
2. **Pronunciation practice mode** (`/french/practice/sounds`):
   * one card per u0 sound: u, ou, eu, r, nasals, oi, liaison, silent letters, questions;
   * each card runs about 6 short phrases from lessons the learner has completed, chosen with the table in 2.2;
   * a perception warm-up first: hear two clips and pick *tu* or *tout*, *rue* or *roue*;
   * then shadow each phrase.
3. **"Hard to say" list.** A star on the result card saves the phrase key in `localStorage` for the practice mode. It
   is per device and never touches FSRS.

### 6.2 Screen flow (the speak step)

1. Prompt: the French phrase with English below. "Native" (default voice; a toggle for the other voice) and "Slow".
2. A big mic button: "Tap and say it". While listening, the level meter and Odile `tilt` idle. Auto-stop on silence.
   Tapping again stops.
3. Result card: the state from 5.2 plus three buttons: **Native, then You, then Native** (shadowing replay, played back
   to back with a 300 ms gap), **Try again**, **Continue**. For rise phrases, both pitch contours appear as two
   small SVG lines.
4. Footer: "Can't speak now" (always visible, same style as "Can't listen now" in `ExerciseViews.tsx`).

### 6.3 States and copy (warm, short, never blaming)

| State | Copy |
|---|---|
| First use | "Practise out loud. Nothing is recorded or sent anywhere: it stays on your phone." |
| Mic permission denied | "The microphone is off for Le Nid. You can turn it on in Settings › Safari › Microphone (or in the app's settings), or keep going without speaking." plus Continue |
| Too quiet / nothing heard | "I didn't catch that. Hold the phone a little closer and try again?" |
| Too noisy | "It's a bit loud around you. Try a quieter spot, or skip for now." |
| Too short | "That sounded short. Say the whole phrase?" |
| Too long / cut off | "Let's keep it to just the phrase. Try again?" |
| Second retry of the same item | Stop suggesting; show only "Bien ! Let's keep going." |

### 6.4 XP, streaks and review cards (conservative rule)

* Speaking results **never** change FSRS ratings, never add to `missed`, and never reduce XP. The `speak` item has no
  `key` in the cards upsert beyond what the lesson already saves.
* Lesson XP is unchanged (`complete_lesson`). Pronunciation practice sessions award a small amount for attempts, not
  scores: `award_xp` with `p_source: "review"`, 2 XP per phrase attempted, capped at 10. This counts toward the
  streak like any practice.
* "Can't speak now" and the Settings toggle never cost anything.

## 7. Implementation plan

### 7.1 Modules

| File | Role | Interface (sketch) |
|---|---|---|
| `lib/speech/features.ts` (spike) | Resample, frames, FFT, mel with warp, log-mel floor, MFCC, CMVN, energy, trim, nuclei | `extract(samples, rate, cfg?, trim?) → { feats, trim, energyDb, signal } \| null`, `speechProblem(energyDb)` |
| `lib/speech/align.ts` (spike) | Banded DTW and per-span means | `dtw(ref, hyp, band) → { distance, path, refCost }`, `spanMeans(refCost, spans)` |
| `lib/speech/pitch.ts` (spike) | YIN, final movement | `yinTrack(x, rate)`, `finalMovement(f0) → semitones \| null` |
| `lib/speech/score.ts` (spike) | Compare, bands, weakest word | `compare(ref, attempt, opts) → CompareResult`, `weakestWord(words, thresholds)` |
| `lib/speech/refs.ts` | Manifest lookup, fetch and decode a reference, LRU of decoded PCM | `refFor(key) → RefMeta \| null`, `loadRef(key, voice) → Promise<Reference>` |
| `lib/speech/tips.ts` | Sound → tip copy, keyed by spelling patterns from section 2.2 | `tipFor(word) → string \| null` |
| `lib/speech/worker.ts` | Runs `compare` off the main thread (a plain module worker; no COOP/COEP needed) | `postMessage({ ref, attempt }) → CompareResult` |
| `components/french/useSpeakCapture.ts` | One utterance: VAD, MediaRecorder, decode to PCM. Shares `createVad`, `meterLevel` and `pickMimeType` with `useVoiceCapture` | `{ state, start, stop, clip }` |
| `components/french/SpeakExercise.tsx` | The step UI from 6.2 | `({ ex, locked, report, skip })`; `report(true, "")` always |
| `components/french/ShadowPlayer.tsx` | Native → you → native playback | |
| `app/(app)/french/practice/sounds/page.tsx` | Pronunciation practice mode | |
| `app/(app)/admin/record/page.tsx` | Volunteer recording tool (admin only) | |
| `app/(app)/french/speak-lab/page.tsx` | **Calibration page** for testers: record, show all raw numbers, label the attempt, store it in IndexedDB, export CSV (and WAVs on demand) | |
| `lib/french/exercises.ts` | Add `{ kind: "speak", fr, key }`, placement rules, and `noAudioFallback` / "can't speak" fallback to `pick` | |
| `public/sw.js` | `speech-v1` cache | |
| `scripts/speech/build-references.mjs` | Section 4.3 (runs outside CI) | |

### 7.2 Phases

| Phase | Content | Effort | Exit |
|---|---|---|---|
| 0 References | Admin recording page; recruit 1 female and 1 male native; generation script; manifest; tag `rise` questions | 2-3 dev days + about 6 volunteer hours | u0-u3 recorded (about 120 phrases), then the rest |
| 1a Shadowing | `speak` kind, `SpeakExercise`, capture hook, refs loader, SW cache, settings toggle, can't-speak, practice mode with perception warm-up; feedback = heard / length / too noisy / question rise | 5-7 days | Ships to everyone; no word highlight |
| 1b Calibration | `speak-lab` page, the DTW word highlight behind a tester flag, recording sessions (section 5.5), threshold fitting | 3-4 dev days + 1 calendar week | **Go/no-go gate** |
| 2 (only if the gate and demand hold) | Spike Vosk small-fr grammar mode in a worker on iPhones 12-16 (memory, load time, accuracy on *tu/tout*, *rue/roue*, *bon/bain*); or the opt-in Whisper check; or F2 vowel check for u/ou using the speaker's own /i/ as an anchor | 2-4 weeks, uncertain | Same metrics as 5.5 |

### 7.3 Test plan

* **Unit (exists):** `lib/speech/speech.test.mjs` covers synthetic gain, noise, tempo, pitch, warp, localization,
  refusal, YIN and speed. To add: decode-and-compare round trips of an AAC file (once references exist), plus
  property tests that results are identical across 100 runs.
* **On device (speak-lab):**
  * latency from end of speech to result;
  * `performance.memory` is unavailable on Safari, so watch for tab reloads and measure clip-decode sizes instead;
  * battery over a 15-minute session (Settings › Battery);
  * the same exported WAV scored on an older and a newer iPhone plus desktop Safari, with byte-identical JSON
    expected.
* **Pilot:** 5 learners for one week. Measure the share who try speaking, who use "Can't speak now", retries per item,
  and a 3-question survey ("Did it feel fair? Did it help? Was it annoying?").

### 7.4 Success criteria

| Metric | Target |
|---|---|
| False-fail on good attempts (any subgroup) | ≤ 5%, subgroup gap ≤ 3 pts |
| Word-highlight precision (if enabled) | ≥ 70% |
| Refusals in ordinary rooms | ≤ 10% |
| Result latency p95 (iPhone 12 or newer) | < 500 ms |
| Determinism across 2 iPhone models | 100% identical results on the same clip |
| Pilot: "felt fair" | ≥ 80% agree |
| Pilot: learners who try speaking at least once a week | ≥ 50% |

### 7.5 Risks

| Risk | Mitigation |
|---|---|
| False "try again" discourages beginners | No grade by default; highlight only after the gate; amber not red; at most one tip; stop after the second retry |
| Lower or female voices judged worse | Relative per-word scoring, VTLN search, male and female references, per-subgroup gate |
| Noisy dorms and cafés | Refuse instead of judging; "quieter spot" copy |
| iOS audio constraints or decode quirks | AudioWorklet fallback; the calibration page logs `getSettings()` |
| Volunteer recordings delayed | Ship 1a for recorded lessons only; device TTS stays the "Listen" fallback |
| References inconsistent across voices or sittings | Loudness normalization, protocol, script QA |
| Scope creep into ASR | Phase 2 only after the gate and pilot demand |

## 8. Things I could not verify

* Duolingo's thresholds, per-lesson speaking limits and current skip behavior. The 15-minute pause is from one news
  report.
* Azure: whether fr-FR has phoneme names/IPA, and whether pronunciation assessment draws on the F0 free hours.
* Speechace pricing; Mondly and Memrise methods.
* Google and Azure TTS terms for storing and redistributing audio. Piper per-voice licenses. The MFA French model
  license. Whether XTTS's CPML covers generated audio (avoid it anyway).
* Vosk and sherpa-onnx memory and accuracy in iOS Safari. Whether a French sherpa-onnx WASM model exists.
* Whether iOS honours `echoCancellation`/`autoGainControl: false`. Whether `decodeAudioData` decodes MediaRecorder
  AAC blobs on every iOS version we see.
* Whether Groq's Whisper is fully deterministic at temperature 0.
* Formant values by speaker sex for French /y/ and /u/: the cited table does not label sex.

## Sources

1. Jiang et al., *How well does Duolingo teach speaking skills?* DRR-21-02 (2021). https://duolingo-papers.s3.amazonaws.com/reports/duolingo-speaking-whitepaper.pdf
2. Duolingo blog, *How we're improving learning with anonymized speech data*. https://blog.duolingo.com/how-were-improving-learning-with-anonymized-speech-data
3. Android Authority, Duolingo undo for skipped speaking exercises (2026). https://androidauthority.com/duolingo-undo-skip-speaking-button-3696590
4. *How effective is Duolingo at promoting implicit pronunciation…* (German course study). https://files.eric.ed.gov/fulltext/EJ1454782.pdf
5. Duolingo blog, *Sneaky pronunciation practice*. https://blog.duolingo.com/sneaky-pronunciation-practice/
6. Busuu Help, *Mastering language skills through speaking practice*. https://help.busuu.com/hc/en-us/articles/19367617005970-Mastering-language-skills-through-speaking-practice
7. Babbel Support, *Speech recognition*. https://support.babbel.com/hc/en-gb/articles/19211305815570-Speech-recognition ; TechCrunch (2010). https://techcrunch.com/2010/06/23/babbel-introduces-speech-recognition-to-aid-language-learning
8. Rosetta Stone, *TruAccent*. https://www.rosettastone.com/features/truaccent-speech-recognition
9. JETRO on ELSA (2023). https://www.jetro.go.jp/en/invest/newsroom/2023/9878be9976e3251b.html
10. Speak, *Leveling up our core speech recognition systems*. https://usespeak.com/blog/asr-levelup
11. Microsoft Learn, *Use pronunciation assessment*. https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-pronunciation-assessment ; *Language support*. https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support ; pricing Q&A. https://learn.microsoft.com/en-us/answers/questions/5608069/pricing-and-usage-of-pronunciation-assessment-feat ; third-party fr-FR notes: https://github.com/royisme/relire/issues/59 , https://sachachua.com/blog/2026/03/french-pronunciation-assessment-with-azure-and-my-emacs-setup
12. Speechace API docs. https://api-docs.speechace.com/features ; https://api-docs.speechace.com/guides-on-common-topics/intepreting-quality-score
13. Witt & Young, *Phone-level pronunciation scoring and assessment for interactive language learning* (2000). https://mi.eng.cam.ac.uk/~sjy/papers/wiyo00.pdf
14. Lee & Glass, *A comparison-based approach to mispronunciation detection*, SLT 2012. https://sls.csail.mit.edu/publications/2012/Lee-Ann_SLT12.pdf ; *Pronunciation assessment via a comparison-based system*, SLaTE 2013. https://people.csail.mit.edu/jrg/2013/lee-slate13.pdf
15. Lee, Zhang & Glass, *Mispronunciation detection via DTW on DBN posteriorgrams*, ICASSP 2013. https://sls.csail.mit.edu/publications/2013/Lee_ICASSP-2013.pdf ; Zhang & Glass, Gaussian posteriorgrams (ICASSP 2010). https://people.csail.mit.edu/ydzhang/papers/icassp2010.pdf ; Madhavi & Patil, VTLN + posteriorgrams (EUSIPCO 2017). https://new.eurasip.org/Proceedings/Eusipco/Eusipco2017/papers/1570347463.pdf
16. Shi et al., *Context-aware GOP*, Interspeech 2020. https://www.isca-archive.org/interspeech_2020/shi20g_interspeech.html
17. Kheir et al., *Automatic Pronunciation Assessment: A Review* (2023). https://arxiv.org/pdf/2310.13974 ; Sheoran et al., GOP + DTW (IEEE Access 2023). https://doaj.org/article/75c461518cc8492fab6f0da455750bff ; Strik et al., Interspeech 2007. https://www.isca-archive.org/interspeech_2007/strik07_interspeech.pdf
18. Munro & Derwing (1995), *Foreign accent, comprehensibility, and intelligibility…* (replication record). https://forrt.org/flora-replication-atlas/doi/10.1111/j.1467-1770.1995.tb00963.x/
19. Lee, Jang & Plonsky (2015), *The effectiveness of second language pronunciation instruction: a meta-analysis*. https://experts.nau.edu/en/publications/the-effectiveness-of-second-language-pronunciation-instruction-a-/ ; Saito & Plonsky (2019). https://discovery-pp.ucl.ac.uk/10068780/1/LL2019.pdf
20. Uchihara, Karas & Thomson (2024), HVPT and production meta-analysis. https://www.cambridge.org/core/product/E38D8F5CE65DC708137B0E95F97C6BC7 ; Sakai & Moorman (2018). https://resolve.cambridge.org/core/journals/applied-psycholinguistics/article/can-perception-training-improve-the-production-of-second-language-phonemes-a-metaanalytic-review-of-25-years-of-perception-training-research/57401D28450902EE96659AD10AA11488
21. Foote & McDonough (2017), shadowing with iPods, *J. Second Language Pronunciation* 3(1). https://cir.nii.ac.jp/crid/1363670318626960768
22. Hardison (2004), *Generalization of computer-assisted prosody training*, LLT 8(1) 34-52; Hardison, ICSLP 2002. https://www.isca-archive.org/icslp_2002/hardison02_icslp.html
23. Neri, Cucchiarini & Strik, ICSLP 2002. https://www.isca-archive.org/icslp_2002/neri02_icslp.html ; Neri et al., Interspeech 2006. https://www.isca-archive.org/interspeech_2006/neri06_interspeech.html ; Cucchiarini et al., Interspeech 2007. https://www.isca-archive.org/interspeech_2007/cucchiarini07_interspeech.html
24. *Microsoft Reading Progress as a CAPT tool*. https://czasopisma.uni.lodz.pl/research/article/view/15828
25. Déprez, Syrett & Kawahara, French question intonation. https://sites.rutgers.edu/kristen-syrett/wp-content/uploads/sites/40/2018/09/Deprez-et-al_interfacing-GR_11.pdf ; Santiago et al. (2014). https://halshs.archives-ouvertes.fr/halshs-01428563v1/file/Santiago%20et%20al%20%282014%29SpeechProsody.pdf.pdf
26. Gendrot & Adda-Decker, Interspeech 2005. https://www.isca-archive.org/interspeech_2005/gendrot05_interspeech.pdf ; /i/ and /y/: https://halshs.archives-ouvertes.fr/halshs-00691154 ; table of [u]/[y] formants: https://www.tufs.ac.jp/ts/personal/ykawa/art/2014_JAFLE_Nakata_Kawaguchi.pdf
27. Government of Canada, *How to pronounce the French "u" and "r"*. https://our-languages.canada.ca/en/blogue-blog/pronounce-u-and-r-eng
28. de Cheveigné & Kawahara, *YIN* (JASA 2002). https://cagnazzo.wp.imt.fr/files/2013/05/2002_JASA_YIN.pdf
29. Vosk models. https://alphacephei.com/vosk/models ; vosk-browser. https://npmjs.com/package/vosk-browser
30. sherpa-onnx WASM demo. https://huggingface.co/spaces/k2-fsa/web-assembly-asr-sherpa-onnx-en
31. wav2vec2 espeak CTC (ONNX). https://huggingface.co/sadda-speech/wav2vec2-espeak-ctc ; French phonemizer CTC. https://huggingface.co/bofenghuang/phonemizer-wav2vec2-ctc-french ; Wav2Vec2Phoneme docs. https://huggingface.co/docs/transformers/v4.57.1/model_doc/wav2vec2_phoneme
32. whisper.cpp models. https://huggingface.co/ggerganov/whisper.cpp ; Joplin French WER for tiny/base. https://github.com/joplin/voice-typing-models/releases ; whisper-small French. https://huggingface.co/bofenghuang/whisper-small-cv11-french
33. *Flavors of Moonshine* (2025). https://arxiv.org/abs/2509.02523
34. WebKit bugs 269777 and 221530 (Wasm memory on iOS). https://bugs.webkit.org/show_bug.cgi?id=269777 ; https://bugs.webkit.org/show_bug.cgi?id=221530
35. ONNX Runtime Web env flags. https://ONNXRuntime.ai/docs/tutorials/web/env-flags-and-session-options.html
36. WebGPU in iOS 26 (secondary). https://appdevelopermagazine.com/webgpu-in-ios-26/
37. WebKit bug 225298 (no SpeechRecognition in Home Screen apps). https://bugs.webkit.org/show_bug.cgi?id=225298 ; Addpipe on SpeechAnalyzer and Safari. https://blog.addpipe.com/apple-speechanalyzer-api/
38. Common Voice Scripted Speech 25.0, French. https://datacollective.mozillafoundation.org/datasets/cmn5zugst00w3nv07upovf2bg
39. Piper French voices. https://huggingface.co/rhasspy/piper-voices/tree/215cce7145905c144590e933129d5da6a2c0904a/fr/fr_FR ; siwis mirror. https://huggingface.co/Trelis/piper-fr-fr-siwis-medium
40. XTTS v2 model card mirror (CPML non-commercial). https://huggingface.co/vokra/xtts-v2
41. Google Cloud Text-to-Speech pricing. https://cloud.google.com/text-to-speech/pricing
42. WebKit bugs 238546 and 245428 (WebM Opus playback). https://bugs.webkit.org/show_bug.cgi?id=238546 ; https://bugs.webkit.org/show_bug.cgi?id=245428
43. Auphonic, loudness targets for mobile audio. https://auphonic.com/blog/2013/01/07/loudness-targets-mobile-audio-podcasts-radio-tv/
