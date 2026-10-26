# Conversation mode: accuracy evaluation and plan

Status: evaluation only (no application code changed). Written 2026-10-23 against the code in `components/talk/*`,
`lib/talk/*`, `app/api/stt/route.ts`, `app/api/translate/route.ts`, `lib/translate/providers.ts`.
Confidence labels used below: **High** = confirmed in our code or in primary vendor docs; **Medium** = vendor docs
seen only through search excerpts, or consistent secondary sources; **Low / unverified** = forum reports, memory, or
reasoning that needs real-phone audio to confirm. Nothing here has been measured on real iPhone audio yet; every
"expected gain" is an estimate to be checked with the test protocol in section 9.

---

## 1. Executive summary

**The single most urgent finding is not about speech at all.** Groq retired `llama-3.3-70b-versatile` and
`llama-3.1-8b-instant` for free and developer tiers on **2026-08-16** (Groq deprecations page, confirmed by a GitHub
issue that quotes it). Those two IDs are the hard-coded default of `GROQ_TRANSLATE_MODELS` in
`lib/translate/providers.ts`. Unless the Vercel env var was already changed, the translation fallback is dead: when
DeepL's 500k chars/month run out or DeepL hiccups, every bubble shows "Translation failed." Fix: set
`GROQ_TRANSLATE_MODELS=openai/gpt-oss-120b,openai/gpt-oss-20b` (the documented replacements) and change the default in
code. Note the new free limits for those models: 30 RPM, 1K requests/day, **8K tokens/min, 200K tokens/day** per
organization, so the fallback must stay a fallback.

Then, in order of expected accuracy gain per unit of effort:

1. **Stop trusting Whisper's language guess blindly** (High confidence that it matters, Medium on size of gain).
   Today any language other than `fr` (including `de` for an Alsatian accent, `nl`, `it`, or `""`) is treated as
   English and sent to be translated into French. Whisper on a wrong guess often *translates* the speech into the
   guessed language instead of transcribing it. Add (a) a free text-based EN/FR check on the transcript, (b) one
   forced-language retry only when the guess is outside {en, fr} or disagrees with the text check, and (c) a
   one-tap "wrong language" fix on each bubble. Add an optional **two-button push-to-talk mode** (English / Français)
   for noisy places that sends `language=en|fr` explicitly.
2. **Fix clipped first syllables** (High confidence the bug exists). The recorder starts only when the VAD *arms*
   (`useVoiceCapture.ts`, `beginRecording` on the `arm` event), so everything before the frame that crossed
   2x the noise floor is lost, plus MediaRecorder start-up latency. Soft onsets ("Je", "Hi", "S'il", "Faith") are the
   victims. The robust fix is to capture PCM with an AudioWorklet into a ~600 ms ring buffer and upload 16 kHz mono
   WAV (Groq resamples to 16 kHz mono anyway, so nothing is lost). A cheap interim fix is to arm earlier.
3. **Use the confidence data Whisper already returns.** `verbose_json` gives per-segment `avg_logprob`,
   `no_speech_prob`, `compression_ratio`; we read only the max `no_speech_prob`. Apply Whisper's own decode-failure
   rules (`compression_ratio > 2.4`, `avg_logprob < -1.0`, `no_speech_prob > 0.6`) per segment, drop failed
   segments rather than whole clips, and pass a confidence score to the UI.
4. **Stop dropping real short answers.** `lib/talk/hallucination.ts` drops "oui", "merci", "merci beaucoup",
   "okay", "thank you", "bye" whenever the clip is under 1.2 s. Real people answer with exactly those words, in under
   1.2 s. Drop them only when the clip was also quiet or Whisper doubted it.
5. **Give DeepL what it needs:** `source_lang` (we already know it), `formality: "prefer_more"` for French (vous by
   default, with a "tu" toggle), `context` = the previous one or two turns (documented as not billed), and a small
   EN<->FR **glossary** for faith terms (culte = worship service, not "cult"; Saint-Esprit; étude biblique; la Cène).
   Glossaries are available on DeepL API Free.
6. **Bias Whisper toward our vocabulary** with a short `prompt` (faith terms, book names, Strasbourg places,
   previous same-language sentence), A/B-tested behind a flag because prompts can be echoed or loop on noise.
7. **Try `whisper-large-v3` instead of `-turbo`.** On Groq's free tier they have identical limits (20 RPM, 2K RPD,
   7.2K audio-seconds/hour, 28.8K/day). Groq's own guide lists 10.3% vs 12% WER. Cost is latency only. A/B it.
8. **Measure before tuning further:** a hidden, local-only diagnostics panel with JSON export, a scripted test set
   from `content/french/units.json`, and numeric targets (section 9).

Things **not** to do: run two STT engines per utterance (doubles the scarce shared Groq quota; the Safari recognizer
does not work in the Home Screen app anyway); "streaming" partials by re-sending growing audio (each request is
billed as at least 10 s); on-device Whisper on iPhone; storing audio or transcripts on the server.

What cannot be known without real audio: the actual language-ID error rate on our speakers, how much the iOS voice
processing (echo cancellation / noise suppression) helps or hurts Whisper in a café, whether a prompt helps or
hurts, and whether large-v3 beats turbo on *our* French learners. The plan front-loads the diagnostics so those
answers come from the team's own phones within the first week.

---

## 2. How the pipeline works today (as read in the code)

| Stage | Where | What it does now | Accuracy-relevant observations |
|---|---|---|---|
| Mic | `useVoiceCapture.ts` `start()` | `getUserMedia({audio:{echoCancellation:true, noiseSuppression:true, autoGainControl:true, channelCount:1}})` | No `sampleRate` (fine). iOS honours these through its voice-processing unit; effect on Whisper unmeasured. |
| Level | `useVoiceCapture.ts` + `lib/talk/vad.ts` `rmsFromBytes` | `AnalyserNode` fftSize 1024, `getByteTimeDomainData`, polled every 50 ms by `setInterval` | 8-bit samples: RMS resolution is ~0.008, the same size as `minArmRms` (0.008) and above `minFloor` (0.002). Each poll sees ~21 ms of every 50 ms at 48 kHz. Energy only, no spectral cue. |
| VAD | `lib/talk/vad.ts` `createVad` | arm at 2x floor, confirm at 3x within 400 ms, end after 900 ms below 1.8x, min speech 600 ms, cap 25 s, adaptive floor | Sensible design. Cap is a hard cut mid-word. No pre-roll. |
| Record | `beginRecording` on `arm` | One `MediaRecorder` per utterance, mime pick: webm/opus, webm, mp4 | Audio before the arm frame is lost; MediaRecorder start latency adds more (W3C thread: first data timing is unknown until `dataavailable`). |
| Mute while TTS | `TalkScreen.tsx` `isMuted` | No recording while `speechSynthesis.speaking`, +500 ms after, +800 ms after a translation starts | Good. Only French translations are read aloud. |
| STT | `app/api/stt/route.ts` | Groq `whisper-large-v3-turbo`, `verbose_json`, `temperature=0`, **no `language`, no `prompt`** | Only `max(no_speech_prob)` is used. `language` outside en/fr falls through to "English". |
| Hallucination filter | `lib/talk/hallucination.ts` | ALWAYS list (Amara, "thanks for watching"...), SUSPECT list dropped if short or quiet or doubted, repeated-word rule | SUSPECT + short (<1.2 s) drops legitimate "Oui." / "Merci." / "Thank you." answers. |
| Side / target | `lib/talk/lang.ts` | `fr` -> French side, translate to EN-US; anything else -> English side, translate to FR | No text check; misdetections are silent. |
| Ordering | `lib/talk/queue.ts` | Serial queue: STT **and** translation of clip N finish before STT of clip N+1 starts | Correct ordering, but adds latency when turns are quick. |
| Translate | `lib/translate/providers.ts` | DeepL `{text:[t], target_lang}` only; then Groq LLMs (retired IDs) | No `source_lang`, `formality`, `context`, glossary. LLM prompt has no register policy, glossary or context. |
| UI | `ChatThread.tsx`, `SideBySide.tsx` | Translation large, original small | No edit, no "wrong language", no confidence cue. |

Documentation drift noticed (not accuracy, but confusing for testers): README says 300 sentences/hour and 40
translations/hour; code has `STT_PER_HOUR = 120`, `STT_PER_DAY = 120`, translate `PER_HOUR = 120`.

---

## 3. Speech input quality on iPhone

### 3.1 getUserMedia constraints

| Constraint | Current | Recommendation | Confidence |
|---|---|---|---|
| `echoCancellation` | true | **Keep true** (default). It is what lets Read aloud coexist with an open mic; WebKit also defaults it to on since 2023. | High that it is the default; Medium on effect. |
| `noiseSuppression` | true | Keep true as default, **A/B false** behind the diagnostics flag. Whisper was trained on noisy web audio and aggressive suppression can smear consonants; Apple's voice processing is tuned for calls, not ASR. Unknown which wins in a café. | Low (needs real audio). |
| `autoGainControl` | true | Keep true. Phones are held at varying distances between two people; AGC evens the far speaker. The VAD floor adapts, so AGC pumping is tolerated. | Medium. |
| `channelCount` | 1 | Keep 1. (A WebKit forum report says macOS Safari 26 may still deliver stereo with EC off; harmless.) | Medium. |
| `sampleRate` | unset | Leave unset; iOS gives 48 kHz (or 44.1). Downsample ourselves to 16 kHz when encoding WAV (3.3). | High. |

**Microphone permission:** `lib/audio/micStream.ts` reuses one stream per screen visit (tracks disabled between listens, released on unmount, after 90 s idle, 30 s hidden or a track ending), but iOS may still ask again after the Home Screen app is relaunched, which the app cannot prevent, and the orange mic indicator may stay on while the stream is warm.

iOS specifics worth knowing (all **unverified on our devices**, from WebKit bug reports):

- With the mic open and echo cancellation on, page audio can crackle on iOS 26.2-27 (WebKit bug 326286, filed this
  month). With EC off, output moved to the earpiece at low volume. So turning EC off to "improve" input is likely to
  break Read aloud.
- Audio-session state can persist after the mic is released, even across reloads; test from a fresh launch.
- `navigator.audioSession.type = "play-and-record"` (Audio Session API, Safari) is the documented way to declare our
  use; WebKit bug 271305 shows it interacting badly with capture in 2024 (marked fixed). Worth one A/B on device;
  do not ship it blind.

### 3.2 Read aloud and the mic

The current design (do not record while `speechSynthesis` is speaking, plus 500-800 ms guard) is correct and should
stay. Two gaps: (1) the guard depends on `speechSynthesis.speaking` becoming true promptly; on iOS there can be a
delay before the utterance starts, so the 800 ms pre-guard matters and should not be shortened; (2) if iOS routes TTS
to the earpiece when the mic is open, the French listener may not hear it. Test both (section 9, test R1-R3).

### 3.3 Recording format: webm/opus vs mp4/AAC vs WAV

- Groq re-encodes every upload to 16 kHz mono before Whisper (Groq community tutorial; Whisper's front end is 16 kHz
  log-mel). So the container matters only for (a) codec artifacts and (b) upload size.
- iPhone Safari historically records `audio/mp4` (AAC); Safari 18.4+ is reported to record WebM/Opus too (secondary
  source, unverified). Our `pickMimeType` prefers webm/opus, so newer iPhones may now send Opus. Either is fine at
  default bitrates (~64-128 kbps) for ASR.
- **Recommendation: move to PCM capture and 16 kHz mono 16-bit WAV** (via an AudioWorklet that downsamples). Size is
  32 KB/s: a 10 s clip is 320 KB, a 25 s clip 800 KB, under the 2 MB `STT_MAX_BYTES`. Benefits: exact pre-roll
  (3.4), exact trimming of trailing silence, no MediaRecorder quirks (WebKit bug 301507: empty early chunks on
  Safari 26 with small timeslices), and the same samples feed a better VAD (3.7). Cost: ~2-3x larger uploads than
  AAC, ~150 lines of code. If upload size becomes a concern on weak 4G, FLAC in a worklet halves it; not needed first.

### 3.4 Pre-roll (clipped first words)

Today: idle -> rms > 2x floor -> `arm` -> `new MediaRecorder(...).start()`. Everything before that frame is gone,
plus the encoder start latency. In a quiet room the floor is ~0.006, so the arm level is the hard minimum 0.008,
which the 8-bit analyser can barely resolve. Weak fricatives and breathy onsets fall below it.

| Option | Effort | Gain | Notes |
|---|---|---|---|
| A. Arm earlier: `armRatio` 2 -> 1.5, use `getFloatTimeDomainData` | 1 h | small-medium | Arming is cheap: false arms are cancelled in 400 ms and only cost nothing (no upload). |
| B. **PCM ring buffer (600 ms) in an AudioWorklet; clip = ring + live audio** | 1-2 days | **large** | Standard approach (Silero/vad-web uses "pre-speech padding" the same way). Also fixes last-word clipping by keeping 300 ms after end. |
| C. Keep a MediaRecorder running and cut blobs | - | - | Do not: AAC/webm chunks cannot be cut cleanly without re-encoding. |

### 3.5 End-of-speech timing

`endSilenceMs = 900` is a reasonable middle for turn-based talk. Shorter (600-700 ms) splits sentences at natural
hesitations, especially for learners who pause mid-sentence while searching for a French word ("Je... voudrais...");
longer (1100-1200 ms) merges the two speakers' turns when replies are quick, producing one clip with two languages.
Recommendations:

- Keep 900 ms default; make it a diagnostics-flag A/B (700 / 900 / 1200).
- **Adaptive hang time** (cheap): if the utterance so far is < 1.5 s of speech, require 1100 ms of silence (a
  hesitation is more likely than an end); if > 6 s, 700 ms is enough. Learners benefit most.
- Keep 300 ms of trailing audio after the last voiced frame and **trim the rest** before upload (possible with PCM).
  Long trailing silence is where Whisper invents "Merci." / "Thank you." (Careless Whisper reports more hallucination
  with longer pauses; Barański et al. catalogue non-speech hallucinations).

### 3.6 Maximum utterance length and splitting

Whisper decodes 30 s windows; hallucination rises for clips beyond 30 s (Barański et al. excerpt). Our 25 s hard cap
cuts mid-word. Change to a **soft cap**: after 12 s, end at the first pause >= 300 ms; hard cap 20 s. Do not split
below ~10 s: Groq bills at least 10 s per request, so two 4 s clips cost 20 s of the 28.8K s/day group pool versus
10 s for one 8 s clip. Shorter clips also give Whisper less context for language ID.

### 3.7 VAD: energy, spectral features, Silero

| VAD | Size / runtime | iOS feasibility | Expected value |
|---|---|---|---|
| Current energy VAD | 0 KB | works | Fooled by café clatter, tram rumble, music; learns the floor well. |
| + spectral cues (band energy 300-3400 Hz ratio, spectral flatness from `getFloatFrequencyData`) | ~40 lines | works | Rejects rumble and hiss; cheap win. Medium confidence. |
| Silero VAD v5 via `@ricky0123/vad-web` 0.0.31 (ISC, published 2026-09-12) + `onnxruntime-web` (MIT) | model ~2.2 MB (v5 export; an int8 export is ~208 KB in sherpa-onnx, different format); ORT wasm ~10-12 MB uncompressed (third-party measurement), single-threaded build needs no COOP/COEP | Plausible: AudioWorklet works on iOS 15+, but there are open iOS AudioWorklet bugs; must be device-tested. Self-host assets (`baseAssetPath`, `onnxWASMBasePath`) and cache them in the service worker. | Large on noise robustness: vendor benchmark (Picovoice, a competitor) puts Silero at ~88% speech detection at 5% false positives vs ~50% for WebRTC VAD. |

Recommendation: spectral cues now (Phase 1), Silero in Phase 3 behind a flag, used as a **gate** (energy arms,
Silero confirms speech and decides `keep`), not as the only detector. vad-web's default thresholds were not
verifiable here (docs host blocked); from memory they are roughly positive 0.5 / negative 0.35, 1.4 s redemption,
~0.8 s pre-speech pad (unverified, check the package before use). Battery cost on iPhone is unmeasured.

---

## 4. Whisper request parameters

### 4.1 Parameter table

| Parameter | Now | Proposed | Why | Confidence |
|---|---|---|---|---|
| `model` | `whisper-large-v3-turbo` | A/B `whisper-large-v3`; switch default if WER/LID better on our test set | Same free limits; Groq guide: 10.3% vs 12% WER; turbo has 4 decoder layers vs 32 and is reported weaker on some languages. Latency stays sub-second for short clips. | Medium |
| `language` | unset | Unset in hands-free mode; `en`/`fr` in push-to-talk mode and on retries | Forcing the right language removes LID errors; forcing the wrong one makes Whisper translate into it (OpenAI forum reports), so only force when the language is known. | High (behavior), Medium (gain) |
| `prompt` | unset | Short vocabulary prompt in the forced/expected language + previous same-language turn, behind A/B flag | Biases spelling of rare words; only the last 224 tokens count; style, not instructions. | Medium |
| `temperature` | 0 | Keep 0 | OpenAI documents 0 as "use log probability to automatically increase the temperature until thresholds are hit"; whether Groq implements that fallback is **unverified**. Raising it adds randomness and loops. | Medium |
| `response_format` | `verbose_json` | Keep; read all segment fields | Needed for confidence (4.4). | High |
| `timestamp_granularities` | unset | Leave unset (word timestamps add latency; not needed for MVP) | - | Low |

### 4.2 Language handling options (short clips are the hard case)

Whisper guesses the language from the first audio of the window. Studies show LID drops sharply with accents (one
arXiv table: 61% for Malaysian English vs 97% for Scottish English with whisper-small) and with code-switching (output
becomes a monolingual *translation*). No study quantified short clips; a practitioner rule of thumb says under 2-3 s
is unreliable (unverified). Our learners' accented French and Alsatian-accented French are exactly the risky inputs.

| Option | Quota cost | Gain | Risk | Verdict |
|---|---|---|---|---|
| a. Constrain output to {en, fr}: if Whisper says anything else, decide from the text, and if the text is not en/fr (Whisper translated), **retry once with `language=fr`** (Alsatian/accent case) | +1 clip on <~5-10% of clips (estimate) | High | Low | **Do now** |
| b. Text-based EN/FR check on every transcript (stop-word and diacritic scoring, ~60 lines, free) to correct the *side* when Whisper's label disagrees with the text | 0 | Medium | Low (short "OK" is ambiguous: keep Whisper's label when the text score is weak) | **Do now** |
| c. Low-confidence retry: clip < 2 s and `avg_logprob < -0.8`, retry with the other language and keep the higher-logprob result | +1 clip on a minority | Medium | Medium (quota) | Do next, only if diagnostics show many short-clip errors |
| d. Push-to-talk mode: two big buttons, English / Français, hold or tap per turn; sends `language` | 0 | **Highest** in noise | UX: one more tap per turn | **Do next** (offer as "Noisy place" mode) |
| e. "Sticky" heuristic: assume turns alternate and force the other language | 0 | - | Fails on two sentences in a row by one person; silent wrong translations | **Do not do** |
| f. Separate LID model (e.g. a browser LID) | 0 quota, MBs of model | Unknown | High effort | Do not do now |

### 4.3 The `prompt` parameter

Whisper uses the prompt as preceding transcript, so it biases vocabulary and spelling; it does not follow
instructions; only the final 224 tokens count, so put the rarest words last. Risks: on noise or silence it can echo
prompt words, and forum users report prompts with proper nouns causing repetition loops. **Unverified:** whether a
prompt in one language biases Groq's language detection; in the open-source implementation LID runs before the prompt
is used, but Groq's server behaviour is not documented. Hence: prompt only in the expected language (forced-language
calls), or keep it bilingual and short in auto mode, and A/B.

Proposed prompts (about 40-60 tokens each; keep in a new content file, e.g. `content/talk/prompts.json`, so the
team can edit without touching code):

- FR: `Jésus-Christ, le Saint-Esprit, l'Évangile, la Bible, le culte, le pasteur, une étude biblique, la grâce, le
  péché, le salut, Romains, Éphésiens, Apocalypse, Strasbourg, l'Homme de Fer, place Kléber, la Petite France, une
  tarte flambée, une winstub.`
- EN: `Jesus Christ, the Holy Spirit, the Gospel, the Bible, a Bible study, grace, sin, salvation, Romans,
  Ephesians, Revelation, Strasbourg, Homme de Fer, Kléber, Petite France, tarte flambée.`
- Context: append the previous turn *in the same language* (max ~120 chars). Never put the other language's text in
  the prompt (it invites translation).

Guards: drop the transcript if it is a contiguous copy of >= 6 prompt words or if >= 60% of its tokens appear only in
the prompt word list and the clip was short or quiet; run the compression-ratio check (4.4) after every prompted call.

### 4.4 Confidence and hallucination checks from verbose_json

Groq's docs describe `avg_logprob` (near 0 = confident, around -0.5 or lower may indicate problems), `no_speech_prob`
(near 1 = non-speech), `compression_ratio` (unusual values indicate problems). OpenAI's reference implementation
treats a decode as failed when `compression_ratio > 2.4` or `avg_logprob < -1.0`, and treats a segment as silence when
`no_speech_prob > 0.6` and the logprob check failed. Proposed rules, per segment, in `app/api/stt/route.ts`:

| Rule | Action | Starting threshold |
|---|---|---|
| `no_speech_prob > 0.6 && avg_logprob < -1.0` | drop segment | Whisper default |
| `compression_ratio > 2.4` | drop segment (looping) | Whisper default |
| `no_speech_prob > 0.8` and segment text in SUSPECT list | drop segment | stricter than today |
| `avg_logprob < -0.7` (and not dropped) | keep, mark `lowConfidence` for the UI | tune from diagnostics |
| Same 3+ word n-gram repeated 3+ times | collapse to one occurrence ("de-loop") | - |
| All segments dropped | `dropped: true` | - |

Return `confidence` (duration-weighted mean `avg_logprob`, mapped to 0..1) and per-segment flags in `SttOk`.
Thresholds are starting points; tune with the diagnostics export (section 9). Confidence: High that the fields exist
(Groq docs), Medium on the thresholds for our audio.

### 4.5 Free-tier limits and the 10-second minimum

Groq free (per organization, not per key): 20 requests/min, 2K/day, 7,200 audio-seconds/hour, 28,800/day for both
Whisper models; every request counts as at least 10 s. So the **whole team** gets at most ~720 clips/hour and ~2,880
clips/day, and 20 per minute. Five simultaneous conversations at 5-6 turns/min already exceed 20 RPM. Consequences:
retries must be rare and targeted (4.2 a, c); never two STT calls per clip by default; never send partials; keep
splitting above ~10 s (3.6). Per-user `STT_PER_DAY = 120` (~30-45 minutes of conversation) is a separate cap the team
should know about.

---

## 5. Translation accuracy

### 5.1 DeepL (primary engine)

| Option | Now | Proposed | Why | Confidence |
|---|---|---|---|---|
| `source_lang` | unset | `EN` or `FR` from the turn's side | Short sentences can be misdetected by DeepL too; required for glossaries. | High |
| `target_lang` | `FR` / `EN-US` | keep | - | High |
| `formality` | unset | `prefer_more` when target FR (vous); `prefer_less` when the user toggles "tu" | French supports formality; the curriculum teaches "when in doubt, vous". `prefer_*` never errors. | High |
| `context` | unset | previous 1-2 turns' originals (both sides), max ~300 chars | Documented as not translated and not billed; resolves pronouns, gender, "it", ellipsis. Not for instructions. | High (docs), Medium (gain) |
| `glossary_id` | unset | one EN->FR and one FR->EN glossary (section 5.3) | Forces faith terms and names; Free API supports glossaries (up to 1,000 per account). | High |
| `split_sentences` | default (1) | `nonewlines` | Whisper does not insert meaningful newlines; avoids odd splits. Minor. | Medium |
| `preserve_formatting` | false | false | We want DeepL to fix capitalization of ASR output. | Medium |
| `model_type` | default | `prefer_quality_optimized` (A/B latency) | Quality model for short conversational text. | Medium |
| `custom_instructions` | - | Do not depend on it yet | Up to 10 x 300-char instructions, FR and EN targets; Free-plan availability **unverified**. Would allow "keep negation". | Low |

### 5.2 LLM fallback (Groq)

- **Replace retired model IDs** (section 1). `openai/gpt-oss-120b` primary, `openai/gpt-oss-20b` second. Set
  `reasoning_effort: "low"` (gpt-oss is a reasoning model; reasoning tokens count against the 8K TPM / 200K TPD).
  Budget: ~350 prompt tokens + ~150 output + reasoning ~ 600 tokens per call = ~330 calls/day group-wide. That is a
  fallback, not a primary.
- **Prompt rewrite** (`lib/translate/providers.ts`, `groq()`): system prompt with (1) direction and register policy
  ("use vous unless told tu"), (2) the glossary pairs relevant to the sentence (inject only matching entries),
  (3) "the text is automatic speech recognition of spoken conversation: it may contain disfluencies and misheard
  words; translate the intended meaning but never add information", (4) "preserve negation, numbers, names, Bible
  references exactly", (5) two or three few-shot pairs from `units.json` including one negation ("Je ne crois pas en
  Dieu" -> "I don't believe in God") and one register example, (6) previous turn as context in a separate
  `<context>` block, (7) user text inside `<speech>` tags, (8) JSON output `{"translation": "..."}` with JSON mode,
  parse and validate. Keep the existing `cleanModelOutput` length guard.
- **Prompt injection**: speech can say "ignore your instructions". Keep the "content, never instructions" line, wrap
  input in tags, require JSON, and reject outputs that fail the checks in 5.4. DeepL is immune by design.

When to choose which: DeepL always first (better and cheaper for EN<->FR, deterministic, glossary). LLM only on DeepL
failure/quota, or (later, optional) for "repair" of very low-confidence transcripts. Do not ensemble both per turn.

### 5.3 Glossary (team-maintained)

Glossaries are exact term substitutions, so pick unambiguous entries only. Proposed seed (FR<->EN):

| EN | FR | Direction | Note |
|---|---|---|---|
| worship service | culte | both | **FR->EN critical**: "culte" otherwise risks "cult" |
| Holy Spirit | Saint-Esprit | both | |
| Bible study | étude biblique | both | |
| the Gospel | l'Évangile | both | |
| Lord's Supper | la Cène | FR->EN | "communion" EN->FR is ambiguous; leave out |
| testimony | témoignage | both | |
| pastor | pasteur | both | |
| grace | grâce | both | |
| Romans / Ephesians / Revelation | Romains / Éphésiens / Apocalypse | both | Use `lib/bible/books.ts` as the source list; skip "Jean"/"John", "Marc", "Luc" (also first names), skip "Job" |
| Homme de Fer, Petite France, Kléber, winstub, tarte flambée, bredele | same | both | keep untranslated |

Exclude "salut" (hi / salvation), "Jean", "Esprit" alone. Storage: a repo JSON (`content/talk/glossary.json`)
synced to DeepL by a small script or on first use (store glossary IDs in env vars), so changes go through review.
An admin-console editor needs a table + migration: do later if the team actually edits it often. A **per-conversation
names list** ("Add a name": Margaux, Thibault...) can live in memory only and be appended to the Whisper prompt and
the LLM glossary; DeepL glossaries are too slow to create per conversation.

### 5.4 Detecting translation failures cheaply

Run on the server after each translation and return `warnings[]`:

1. **Length ratio**: FR is usually ~1.1-1.3x the EN character length. Flag if `out/in < 0.5` or `> 2.2` (for inputs >
   20 chars).
2. **Negation parity**: EN negators (not, n't, never, no, nobody, nothing) vs FR (ne/n', pas, jamais, rien,
   personne, aucun, plus) present on one side and absent on the other -> flag. ("Je n'ai pas le temps" must not become
   "I have time".)
3. **Numbers and references**: digits and number words (deux, vingt-trois...) must map; Bible references (book +
   chapter + verse, via `lib/bible/books.ts`) must survive.
4. **Output language**: run the same EN/FR text check (4.2 b) on the output; the target must win.
5. **Back-translation**: only on flagged turns or when the user asks "Check" (costs DeepL characters; ~2x). Show the
   back-translation in the speaker's language.

A flagged turn shows a small "?" chip; tapping offers "Check meaning" (back-translation) and "Try again".

---

## 6. Human in the loop (UI)

| Feature | Where | Cost | Value |
|---|---|---|---|
| Tap a bubble -> **Edit what I said** -> re-translate | `ChatThread.tsx`, `SideBySide.tsx`, `TalkScreen.tsx` (`patchTurn`, `translateTurn`) | DeepL chars only | High: fixes names and faith terms instantly |
| **Wrong language** (flip side) | same | If the text is fine: re-translate. If Whisper translated: re-transcribe the kept clip with forced language (keep last ~5 clips' audio in memory only) | High |
| **That's not what I said** (delete + "say it again") | same | 0 | Medium; also logs a local diagnostic event |
| Undo last delete | same | 0 | Low |
| Confidence cue: dim original text when `lowConfidence`, "?" chip when translation warnings | bubbles | 0 | Medium; calibrate before showing to avoid alarm fatigue |
| Repeat-back for important phrases ("Check" = back-translation shown to the speaker) | bubble action | 2x DeepL chars for that turn | Medium for prayer requests, addresses, times |
| n-best alternatives | - | Not available from Groq Whisper API | Not possible; skip |
| Phrasebook match: if the normalized transcript equals a `units.json` phrase, use its curated translation (and "tu" form) | `lib/talk` new helper | 0 | Medium for scripted phrases; instant and exact |

---

## 7. Turn-taking and speaker logic

- **Language = speaker** is the only practical attribution with one phone. Keep it, but make it correctable (6) and
  make the bubble's language label visible enough that people notice errors.
- **Code-switching** ("on a un meeting", English names inside French): Whisper may translate the whole clip into one
  language. The text check + glossary + editing cover most of it; no automatic fix.
- **A French speaker answering in English** (common with young Strasbourgeois): the bubble lands on the English side
  and gets translated to French; harmless. Do not "correct" it.
- **Overlap and quick replies** produce one clip with two languages. Mitigations: adaptive hang time (3.5), and in
  noisy places push-to-talk. There is no free diarization that would fix this reliably.
- **Read-aloud loop**: already handled by `isMuted`; keep echo cancellation on; test on device (R1-R3).
- **Push-to-talk vs hands-free**: hands-free is friendlier in a quiet room; push-to-talk wins in cafés, trams, outdoor
  events (no false triggers, exact language, exact start and end, fewer wasted clips against the 10 s minimum).
  Offer both; remember the choice per device.
- **Safari backup as a second opinion**: not available in the Home Screen app where most use happens, and running it
  alongside MediaRecorder on iOS is fragile. Keep it as a fallback only.
- **Ensembles** (two engines per clip and reconcile): doubles Groq quota or needs a second free STT provider with
  its own key and privacy terms. Do not do.

---

## 8. Latency vs accuracy

Today's turn-around is roughly: 900 ms end-of-speech hang + upload (~0.2-0.5 s on 4G) + Groq Whisper (~0.3-1 s,
estimate) + DeepL (~0.2-0.5 s) = **about 2-3 s** (unmeasured; the diagnostics will measure it).

| Idea | Realistic on free tier? | Plan |
|---|---|---|
| Pipeline: start STT of clip N+1 while clip N translates; commit in order | Yes | Do next: change `handleClip` so `transcribe()` starts immediately (max 2 in flight) and only the commit step goes through the serial queue |
| Streaming partials by re-sending growing audio (LocalAgreement, Macháček et al., ~3.3 s latency) | No: each partial is billed >= 10 s; 20 RPM shared | Do not do |
| Speculative translation of partial text | No partials to speculate on | Do not do |
| Cache translations (in-memory Map keyed by text+direction+formality) and phrasebook hits | Yes | Do now; tiny |
| Shorter hang time | Trade-off against split sentences | A/B only |
| whisper-large-v3 (slower than turbo) | Yes | A/B; accept up to +300 ms p50 if WER/LID improve |

---

## 9. Evaluation method

### 9.1 Diagnostics (local only, hidden)

- Enable with `?diag=1` on `/translate/talk` or five taps on the "AI audio processing used" line; stored in
  `localStorage` (per-viewer convenience) and never sent anywhere.
- Per turn record: timestamps (VAD end, upload start, STT done, translate done), clip duration/peak/floor/size/mime,
  model, `language` sent and returned, text-check result, retries, per-segment `avg_logprob` / `no_speech_prob` /
  `compression_ratio`, drop reason, translation engine, warnings, user corrections (edit, flip, delete).
- Server returns the extra fields only when the request carries `diag=1` from an approved user; nothing logged.
- **Export**: "Copy diagnostics" / Share sheet -> JSON (no audio by default). Optional "Include audio" switch that
  saves the clips as a .zip to the device for testers who consent, so WER can be re-run on the same audio when we
  change settings. Remind testers to get the other person's consent before keeping audio.
- **A/B flags** in the diag panel (sent as form fields, honoured only with `diag=1`): model (turbo / v3), prompt
  (off / on), endSilence (700 / 900 / 1200), noiseSuppression (on / off), arm ratio, push-to-talk, DeepL
  formality/context/glossary on/off.

### 9.2 Test set (build in one evening with 6-8 team members and 2-3 French speakers)

| Set | Content | Size |
|---|---|---|
| S1 scripted EN | 40 English phrases from `units.json` `en` fields (logistics, faith, u16 negations) | each tester |
| S2 scripted FR (learner) | 40 `fr` phrases, incl. all of u13, u14, u17 key verses and references ("Romains, chapitre trois, verset vingt-trois") | each tester |
| S3 scripted FR (native) | same 40 read by French/Alsatian speakers | 2-3 speakers |
| S4 short replies | Oui, Non, Merci, D'accord, Thank you, OK, Pas de souci, Bien sûr (x3 each) | everyone |
| S5 unscripted dialogues | 5-minute role plays: directions, café order, invitation to a Bible study, "I'm not religious" | 6 pairs |
| S6 noise-only | 10 min each: café, tram, street, church hall chatter, with nobody addressing the phone | 4 places |

Conditions: quiet room vs café vs street/tram; phone flat on table between speakers at ~40-60 cm; male and female
voices; at least two strongly accented learners. Reference transcripts for S1-S4 come from the script; for S5 the
French speaker corrects the exported transcripts.

### 9.3 Metrics and targets (targets, not current values)

| Metric | How | Target quiet | Target noisy |
|---|---|---|---|
| WER, native EN (S1) | normalized WER script on export | <= 8% | <= 15% |
| WER, native FR (S3) | same | <= 10% | <= 18% |
| WER, learner FR (S2) | same | <= 25% | <= 35% |
| Faith/proper-noun term accuracy (S2, S3) | exact match on a term list | >= 95% | >= 90% |
| Language-ID accuracy (all, clips >= 1 s) | detected side vs truth | >= 98% | >= 95% |
| Short replies kept and correct (S4) | count | >= 90% | >= 80% |
| Hallucinated bubbles (S6) | bubbles per 10 min noise-only | <= 0.5 | <= 1 |
| First/last word clipped | manual check on S1-S3 | <= 3% | <= 5% |
| Translation critical errors (negation, number, name, register, added content) | 0-3 adequacy rubric by a French speaker on S5; critical = 0 score | <= 2% of turns | <= 3% |
| Register (vous unless "tu" toggled) | count on S5 | 100% | 100% |
| Latency end-of-speech -> translation shown | diag timestamps | p50 <= 2.0 s, p90 <= 3.5 s | same |
| Quota | clips per conversation-minute | <= 6 | <= 6 |

Adequacy rubric: 3 = meaning and tone fully preserved; 2 = minor wording issue; 1 = meaning partly lost; 0 = wrong,
negation flipped, number wrong, content added, or wrong person (tu/vous) in a way that offends.

### 9.4 Real-phone test protocol (run before shipping each phase)

Devices: at least one older iPhone (iOS 17/18) and one current (iOS 26+), installed Home Screen app **and** Safari
tab; one Android phone as a control.

1. **Formats (F1)**: in diag, read `MediaRecorder.isTypeSupported` results and the actual mime/size per clip; with
   PCM capture, confirm WAV 16 kHz mono and size ~32 KB/s.
2. **Onset (O1)**: say "Je crois en Dieu", "Holy Spirit", "S'il vous plaît", "Faith is a gift" starting softly; check
   the first word in S1/S2 exports. Compare old capture vs pre-roll.
3. **Endings (O2)**: sentences ending in soft consonants ("...la vie éternelle", "...thanks"). Check last word.
4. **Read aloud (R1-R3)**: Read aloud on; confirm (R1) the French translation is audible from the loudspeaker at a
   café table, not the earpiece, (R2) no re-transcription of the phone's own voice in 20 turns, (R3) no crackle. Repeat
   with `audioSession.type="play-and-record"` if testing that flag. Start each run from a fresh app launch.
5. **Noise (N1)**: S6 noise-only runs per place: count bubbles. Then the same with noiseSuppression off.
6. **Language (L1)**: S2 learners plus Alsatian-accented native speakers; count side errors; record cases where the
   text came back in German/English (Whisper translated) and whether the retry fixed them.
7. **Lock / app switch (P1)**: lock the phone mid-utterance; confirm nothing is sent after unlock and the mic is
   released (current behaviour) and that the pre-roll buffer is cleared.
8. **Quota (Q1)**: 3-4 phones talking at once for 5 minutes; confirm per-minute group limit messages behave and that
   retries do not push the group over 20 RPM.
9. **Battery/heat (B1)** (Silero phase only): 30 minutes continuous listening; note battery % and heat versus the
   energy VAD.

Ship a phase only if its acceptance criteria (section 11) hold on both iPhones in the Home Screen app.

---

## 10. Ranked improvements

Gain/effort/risk are estimates (H/M/L). Quota = extra Groq audio-seconds or DeepL characters.

| # | Improvement | Accuracy gain | Effort | Risk | Quota cost | Confidence | Bucket |
|---|---|---|---|---|---|---|---|
| 1 | Replace retired Groq LLM IDs (`openai/gpt-oss-120b,openai/gpt-oss-20b`), `reasoning_effort: low` | H (translation works at all when DeepL fails) | 15 min | L | uses LLM TPD only on fallback | High | Do now |
| 2 | Text-based EN/FR check + {en,fr} constraint + single forced retry | H on misdetections | 0.5-1 day | L | +1 clip on a few % | Medium | Do now |
| 3 | Per-segment confidence rules (4.4) + de-loop + return confidence | M-H on hallucinations | 0.5 day | L | 0 | Medium | Do now |
| 4 | Fix SUSPECT short-clip rule (keep "Oui", "Merci" unless quiet or doubted) | M on short replies | 1 h | L (slightly more "Thank you." hallucinations; covered by #3) | 0 | High | Do now |
| 5 | DeepL `source_lang`, `formality`, `context`, `split_sentences` | M-H on register, pronouns | 2-3 h | L | context not billed (docs) | High | Do now |
| 6 | Diagnostics panel + export + A/B flags | enables everything else | 1-2 days | L | 0 | High | Do now |
| 7 | Tap-to-edit / wrong-language / delete on bubbles | H perceived accuracy | 1 day | L | small DeepL | High | Do now |
| 8 | Float time-domain + earlier arming (`armRatio` 1.5) + spectral cue | M on clipping and noise triggers | 0.5 day | M (more false arms; they are discarded) | 0 | Medium | Do now |
| 9 | Translation cache + phrasebook exact matches from `units.json` | M on scripted phrases | 0.5 day | L | saves DeepL | Medium | Do now |
| 10 | PCM AudioWorklet capture, 600 ms pre-roll, 300 ms tail, trim, WAV 16 kHz | H on clipped words, M on hallucination | 1-2 days | M (iOS worklet quirks) | 0 | Medium | Do next |
| 11 | DeepL glossaries (EN->FR, FR->EN) from repo JSON | M-H on faith terms | 0.5 day | L | 0 | High | Do next |
| 12 | Whisper `prompt` (vocabulary + previous turn), behind A/B | M on names and faith terms | 0.5 day | M (echo, loops) | 0 | Medium | Do next (A/B) |
| 13 | `whisper-large-v3` A/B, switch if better | M (unknown on our audio) | 1 h + test | L | 0 (same limits) | Medium | Do next (A/B) |
| 14 | Push-to-talk "Noisy place" mode with `language` | H in noise | 1 day | L | saves quota | High | Do next |
| 15 | Soft cap 12 s / hard 20 s; adaptive hang time | M on merged/split sentences | 0.5 day | L | 0 | Medium | Do next |
| 16 | Pipelined STT with ordered commit | latency only | 0.5 day | M (ordering bugs) | 0 | High | Do next |
| 17 | LLM fallback prompt rewrite (register, glossary, negation, JSON, context) | M when fallback runs | 0.5 day | L | more tokens | Medium | Do next |
| 18 | Translation warnings (length, negation, numbers, language) + "?" chip | M on critical errors | 0.5 day | L (false alarms) | 0 | Medium | Do next |
| 19 | Back-translation "Check" on demand | M for important phrases | 0.5 day | L | 2x DeepL for that turn | High | Do next |
| 20 | Silero VAD gate (self-hosted, single-thread ORT) | M-H in noise | 2-3 days | M-H (bundle ~3-5 MB compressed, iOS worklet, battery) | 0 | Low-Medium | Later (flag) |
| 21 | Low-confidence short-clip retry with other language | M | 0.5 day | M (quota) | +1 clip on flagged | Low | Later, only if data shows need |
| 22 | Admin-console glossary editor (table + migration) | L-M | 1-2 days | L | 0 | High | Later |
| 23 | `navigator.audioSession` / noiseSuppression changes | unknown | 1 h each | M-H | 0 | Low | Test only |
| - | Two STT engines per clip / two-pass on every clip | - | - | quota x2 | - | - | **Do not do** |
| - | Streaming partials by re-sending audio | - | - | quota x N | - | - | **Do not do** |
| - | On-device Whisper on iPhone (WebGPU/WASM) | - | very high | heat, memory, download size | 0 | - | **Do not do** |
| - | Forcing language by turn alternation | - | - | silent errors | - | - | **Do not do** |
| - | Server-side storage of audio/transcripts for evaluation | - | - | privacy promise in README/SETUP | - | - | **Do not do** |

---

## 11. Implementation plan (phases, specific changes, acceptance criteria)

### Phase 0: today (config and docs, no behaviour risk)

1. Vercel env: `GROQ_TRANSLATE_MODELS=openai/gpt-oss-120b,openai/gpt-oss-20b`; check the Groq console model list
   first (sources disagree on a Qwen successor ID). In `lib/translate/providers.ts` `translate()`, change the default
   string to the same; in `groq()` add `reasoning_effort: "low"` and raise `max_tokens` to ~600 so reasoning does not
   truncate the answer (verify the parameter on Groq's model page).
2. Align README/SETUP limits with `lib/talk/api.ts` and `app/api/translate/route.ts`.
- **Accept**: with `DEEPL_API_KEY` unset in a preview deployment, Translate and Conversation mode still translate.

### Phase 1: "do now" (about 1 week)

3. `lib/talk/lang.ts`: add `textLanguage(text): { lang: "en" | "fr" | "", score }` (stop-word lists of ~40 words each,
   French diacritics, elision `l'`, `j'`, `qu'`). Add `resolveSide(whisperLang, text)`: if Whisper says en/fr and the
   text agrees or is weak, keep; if they disagree strongly, use the text; if Whisper says other, use the text.
4. `app/api/stt/route.ts`: after the first call, if `language` not in {en, fr} **or** `textLanguage` is not en/fr with
   a strong score (Whisper translated into German etc.), retry once with `language=fr` (or `en` if the text check says
   English). Count the retry against the same per-user and group limiters. Return `retried: true` for diagnostics.
5. `app/api/stt/route.ts` + `lib/talk/hallucination.ts`: type `segments` fully (`text`, `avg_logprob`,
   `no_speech_prob`, `compression_ratio`, `start`, `end`); filter per segment with the table in 4.4; rebuild `text`
   from kept segments; add `delooping`; return `confidence` and `lowConfidence`.
6. `lib/talk/hallucination.ts` `shouldDropTranscript`: change `SUSPECT.has(n) && (short || quiet || doubted)` to
   `SUSPECT.has(n) && (quiet || doubted || (short && clip.noSpeechProb === undefined))`, and remove "oui" from
   SUSPECT entirely (it is not a known Whisper hallucination).
7. `lib/translate/providers.ts` `deepl()`: accept `{ source, formality, context }`; send `source_lang`
   (`EN`/`FR`), `formality` (`prefer_more` default for FR, `prefer_less` when the user picked "tu"),
   `context` (previous two originals, joined, <= 300 chars), `split_sentences: "nonewlines"`. Thread these through
   `app/api/translate/route.ts` (validate lengths; `context` does not count toward `use_translate_chars` since DeepL
   does not bill it, but cap it) and `lib/talk/client.ts` `translate()`.
8. `TalkScreen.tsx`: add a "Vous / Tu" toggle in the header (default Vous, saved in settings); pass previous turns as
   context; in-memory translation cache.
9. Phrasebook: new `lib/talk/phrasebook.ts` building a Map from `normalizeTranscript(fr|en)` -> curated translation
   (and `tu` variant) from `content/french/units.json`; check before calling `/api/translate`.
10. Bubbles: tap -> sheet with Edit text, Wrong language, Delete, Check meaning (Phase 2), Read aloud. Edits call
    `translateTurn` again; "Wrong language" flips `side` and re-translates; keep the last 5 clips' blobs in a
    `useRef` (memory only, cleared on Clear/stop) for a forced-language re-transcription when the text itself is
    wrong.
11. `useVoiceCapture.ts` / `vad.ts`: switch to `Float32Array` + `getFloatTimeDomainData` (add `rmsFromFloats`);
    `armRatio: 1.5`; add a band-energy ratio (300-3400 Hz vs total, from `getFloatFrequencyData`) as a required
    condition for `start` when the floor is high (> 0.02).
12. Diagnostics panel (`components/talk/Diagnostics.tsx`), flags, export; server fields only with `diag=1`.
- **Accept** (section 9 protocol, both iPhones, Home Screen app): LID >= 95% on S1-S3 quiet; S4 short replies kept
  >= 85%; S6 hallucinated bubbles <= 1 per 10 min in a café; no "tu" in FR output with the Vous setting on S5;
  diagnostics export works offline-safe and contains no audio unless switched on.

### Phase 2: "do next" (about 2 weeks, driven by Phase 1 data)

13. PCM capture: `public/worklets/capture.js` AudioWorklet (or `ScriptProcessor` fallback) that downsamples to 16 kHz
    mono, keeps a 600 ms ring buffer, and posts 20 ms frames; `useVoiceCapture.ts` builds the clip from ring + live
    frames + 300 ms tail, trims trailing silence, encodes WAV (`lib/talk/wav.ts`), `ext: "wav"` (already accepted).
    Keep MediaRecorder as fallback when `audioWorklet` is missing.
14. VAD: soft cap (`softCapMs: 12000`, end at first 300 ms pause), `maxMs: 20000`; adaptive `endSilenceMs`
    (1100 ms when speech < 1.5 s, 700 ms when > 6 s, else 900 ms).
15. DeepL glossaries: `content/talk/glossary.json` (reviewed by a French speaker), a script under `scripts/` that
    creates/updates the two glossaries and prints IDs for `DEEPL_GLOSSARY_EN_FR` / `DEEPL_GLOSSARY_FR_EN` env vars;
    `deepl()` sends `glossary_id` when set.
16. Whisper prompt A/B: `content/talk/prompts.json`; `app/api/stt/route.ts` appends `prompt` when the flag is on (and
    always in push-to-talk mode with the matching language), plus the previous same-language turn sent by the
    client (`context` form field, <= 120 chars). Add the prompt-echo guard.
17. Model A/B: `STT_MODEL` env var (default stays turbo until data says otherwise), and a diag flag override.
18. Push-to-talk "Noisy place" mode: two big buttons (reuse `TalkButton`), sends `language`; VAD still trims; same
    pre-roll.
19. Pipelined STT: in `TalkScreen.tsx` `handleClip`, start `transcribe(clip)` immediately (limit 2 in flight), push
    only the "apply result + translate" step to the serial queue awaiting that promise.
20. Translation warnings (5.4) server-side; "?" chip and on-demand back-translation ("Check meaning").
21. LLM fallback prompt rewrite (5.2) with JSON output and glossary injection.
- **Accept**: first/last word clipped <= 3% (quiet) on S1-S3; faith-term accuracy >= 95% with the better of
  prompt on/off; p50 latency <= 2.0 s, p90 <= 3.5 s; no regression on S6 hallucinations; group stays under 20 RPM in
  test Q1; translation critical errors <= 2% on S5.

### Phase 3: "later, behind flags"

22. Silero VAD gate via `@ricky0123/vad-web` (self-hosted assets, `numThreads = 1`, cached by the service worker),
    only after B1 shows acceptable battery/heat. Accept: S6 hallucinated bubbles halved vs Phase 2 at equal S1-S3
    clipping.
23. Low-confidence short-clip retry with the other language, only if Phase 1-2 data shows > 3% LID errors on clips
    < 2 s.
24. Admin-console glossary editor (new table + migration + sync), only if the team edits the glossary more than
    monthly.

---

## 12. What must be verified on real iPhones before shipping

- Actual mime type and bitrate MediaRecorder produces per iOS version; whether WebM/Opus recording is now used.
- AudioWorklet capture stability in the Home Screen app across lock/unlock, app switch, calls, AirPods.
- Read aloud routing (loudspeaker vs earpiece) and crackle with echo cancellation on (WebKit 326286), and whether
  `audioSession.type` helps.
- Whether noiseSuppression on/off changes Whisper WER in cafés (unknown direction).
- Whether a Whisper prompt changes language detection on Groq (undocumented).
- Whether Groq applies temperature fallback at `temperature=0` (undocumented).
- Real LID error rate for our learners and Alsatian-accented speakers; how often the forced retry fires.
- Battery and heat of continuous listening (and of Silero, if tried).
- DeepL Free behaviour for `custom_instructions`, `model_type`, and whether `context` affects quota as documented.

---

## 13. Sources

Groq
- Rate limits (free plan table; per-organization; Whisper 20 RPM, 2K RPD, 7.2K ASH, 28.8K ASD): https://console.groq.com/docs/rate-limits (read via search excerpts; host blocked from this sandbox)
- Speech to text docs (verbose_json metadata fields, prompt for spelling and style): https://console.groq.com/docs/speech-to-text (search excerpts)
- whisper-large-v3-turbo model page (10 s minimum per segment): https://console.groq.com/docs/model/whisper-large-v3-turbo (search excerpt)
- ASR model guide (WER 10.3% large-v3 vs 12% turbo): https://groq.com/GroqDocs/Groq%20ASR%20Model%20Guide.pdf (search excerpt)
- Turbo launch post: https://groq.com/whisper-large-v3-turbo-now-available-on-groq-combining-speed-quality-for-speech-recognition/
- Chunking tutorial (Groq re-encodes to 16 kHz mono): https://community.groq.com/t/chunking-longer-audio-files-for-whisper-models-on-groq/162
- Deprecations (Llama 3.3 70B and 3.1 8B retired 2026-08-16 for free/dev tiers; replacements gpt-oss): https://console.groq.com/docs/deprecations (search excerpt)
- GitHub issue quoting the deprecation and the free table read 2026-09-26: https://github.com/robhunter/agentdeals/issues/1993
- gpt-oss-120b on Groq (JSON modes, reasoning_effort): https://console.groq.com/docs/model/openai/gpt-oss-120b (search excerpt)

Whisper behaviour
- Whisper paper: https://cdn.openai.com/papers/whisper.pdf
- Reference `transcribe()` defaults (2.4 / -1.0 / 0.6, temperature fallback): https://www.mintlify.com/openai/whisper/api/transcribe
- OpenAI transcription API (temperature 0 auto-fallback wording): https://developers.openai.com/api/docs/api-reference/audio/createTranscription
- Prompt only uses last 224 tokens; style not instructions: https://learn.microsoft.com/en-us/answers/questions/1378208/how-to-leverage-whisper-model-to-do-prompt and https://github.com/openai/whisper/discussions/1824
- Prompt-induced loops (forum, unverified): https://community.openai.com/t/whisper-prompt-leads-to-hallucinations/174896
- Wrong language -> translation instead of transcription (forum): https://community.openai.com/t/whisper-3-detects-incorrect-language-translates-instead-of-transcribes/828870 and https://community.openai.com/t/solved-whisper-translates-into-welsh/120780
- Non-speech hallucinations, "bag of hallucinations" (Barański et al., ICASSP 2025): https://arxiv.org/abs/2501.11378
- Careless Whisper (Koenecke et al., FAccT 2024): https://koenecke.infosci.cornell.edu/files/CarelessWhisper_ExtendedAbstract.pdf and https://news.cornell.edu/index%2Ephp/node/328846
- Calm-Whisper: https://arxiv.org/pdf/2505.12969
- LID under accents (table cited in search; attribution to this paper not fully verified): https://arxiv.org/pdf/2605.23235
- Code-switching LID/translation behaviour: https://arxiv.org/pdf/2403.05887
- Streaming Whisper (LocalAgreement, 3.3 s): https://arxiv.org/abs/2307.14743 and https://github.com/ufal/whisper_streaming

DeepL
- Translate text reference (formality values, split_sentences, preserve_formatting, model_type, glossary_ids): https://developers.deepl.com/api-reference/translate/request-translation (search excerpts; host blocked)
- Formality-supported languages incl. FR: https://developers.deepl.com/docs/api-reference
- Working with context: https://developers.deepl.com/docs/best-practices/working-with-context
- Changelog (context GA; not billed): https://developers.deepl.com/docs/resources/roadmap-and-release-notes
- Custom instructions (10 x 300 chars; FR/EN targets): https://developers.deepl.com/docs/best-practices/custom-instructions
- Glossaries on API Free and Pro: https://www.deepl.com/blog/announcing-glossary-support-for-deepl-api

iOS / WebKit / Web APIs
- Echo cancellation on by default (WebKit): https://bugs.webkit.org/show_bug.cgi?id=257495
- Crackle with EC on, earpiece routing with EC off (iOS 26.2-27): https://bugs.webkit.org/show_bug.cgi?id=326286
- Output routing changes when capture starts: https://bugs.webkit.org/show_bug.cgi?id=218012
- audioSession with capture (fixed 2024): https://bugs.webkit.org/show_bug.cgi?id=271305
- Audio Session API: https://developer.mozilla.org/en-US/docs/Web/API/Audio_Session_API and https://www.w3.org/TR/audio-session/
- MediaRecorder empty early chunks on Safari 26: https://bugs.webkit.org/show_bug.cgi?id=301507
- MediaRecorder first-data timing (W3C thread): https://lists.w3.org/Archives/Public/public-webrtc-logs/2024Sep/0037.html
- WebM Opus on iOS (playback history): https://bugs.webkit.org/show_bug.cgi?id=238546
- Speech recognition unavailable in Home Screen web apps: https://bugs.webkit.org/show_bug.cgi?id=225298

VAD
- Silero VAD: https://github.com/snakers4/silero-vad
- Silero ONNX sizes (v5 2.22 MB, int8 208 KB): https://k2-fsa.github.io/sherpa/onnx/vad/silero-vad.html
- vad-web (MicVAD, Silero via ONNX Runtime Web): https://github.com/ricky0123/vad ; version 0.0.31, ISC, 2026-09-12 and onnxruntime-web 1.30.0, MIT, from https://registry.npmjs.org/
- VAD benchmark (vendor): https://picovoice.ai/docs/benchmark/vad/ ; window-size study: https://arxiv.org/abs/2601.17270
- ONNX Runtime Web (SIMD/threads fallback): https://opensource.microsoft.com/blog/2021/09/02/onnx-runtime-web-running-your-machine-learning-model-in-browser/

Unverified or conflicting items, collected: Safari 18.4 WebM recording (secondary source); vad-web default thresholds
(from memory); ORT wasm size (third-party measurement); Groq temperature fallback; Groq prompt effect on LID; DeepL
`custom_instructions` on Free; one aggregator listing 30 RPM / 14,400 RPD for turbo (conflicts with Groq's table;
ignored); a Qwen successor model ID that differs between Groq's own pages.


---

## 14. Implementation status

Built after this evaluation (owner's decisions: Phase 0, all of Phase 1, all of Phase 2; no Phase 3). Nothing here has run against a real microphone, Groq, DeepL or an iPhone: only type checks, `scripts/check-talk.mjs` (pure logic) and desktop-Chromium screenshots of the demo mode.

**Shipped (plan item: status).** 1-2 Phase 0: done (models were already in code; README/SETUP limits aligned). 3 text language check and `resolveSide`: done (`lib/talk/lang.ts`). 4 forced-language retry: done, counted by the per-user and group limiters, not by the daily RPC. 5 segment rules, de-looping, `confidence`/`lowConfidence`: done. 6 SUSPECT rule and "oui": done. 7 DeepL `source_lang`, `formality: prefer_more` for French, `context`, `split_sentences`: done. 8 partly, by decision: no vous/tu toggle (vous only); previous-turns context and the in-memory cache are done. 9 phrasebook: done (loaded on demand from `units.json`). 10 bubble sheet: done. 11 float time-domain, 1.5x arm, band check: done (band 300-3400 Hz, needed only when the floor exceeds 0.02, minimum share 0.2: tune from diagnostics). 12 diagnostics: done. 13 PCM worklet, pre-roll, tail trim, WAV: done, with a 1.5 s watchdog and MediaRecorder fallback. 14 soft/hard cap and adaptive hang: done. 15 glossary file, sync script, `glossary_id`: done. 16 Whisper prompt: done, OFF by default and also off in Noisy place mode until the switch is on (a deliberate difference from the plan's "always in push-to-talk"). 17 `STT_MODEL` and diagnostics override: done. 18 Noisy place: done (tap a language, then one sentence; the mic stays open and only learns the room while no language is chosen). 19 pipelined STT: done (two in flight, ordered commit). 20 warnings and "Check meaning": done. 21 LLM prompt rewrite with JSON and glossary: done, with a plain-prompt fall-through. Skipped: `model_type` A/B, `custom_instructions` (unverified on Free), ScriptProcessor fallback (MediaRecorder is the fallback), Phase 3.

**Environment variables.** `STT_MODEL` (default `whisper-large-v3-turbo`, also `whisper-large-v3`), `DEEPL_GLOSSARY_EN_FR`, `DEEPL_GLOSSARY_FR_EN` (from `node scripts/sync-deepl-glossary.mjs`; DeepL v2 glossaries get new ids on every sync, and a stale id only makes the app ask DeepL again without it).

**Flags** (localStorage `le-nid-talk-flags`, hidden diagnostics panel, honoured only while diagnostics are on; otherwise the defaults apply). ON: PCM capture, text check, language retry, early arm, band check, adaptive pause, soft cap, pipelining, phrasebook, cache, context, warnings. OFF: Whisper vocabulary prompt, keep audio. Also: model (server default / turbo / large-v3), pause 0.7/0.9/1.2 s or automatic, phone noise suppression (on). Server-side overrides (`model`, `prompt`, `retry`) are read only when the request carries `diag=1`.

**Opening diagnostics.** Tap the title five times, or `?diag=1`. Export is a JSON download with a copy fallback; audio only via the explicit "keep audio" switch (last 10 clips, memory only, shared through the share sheet).

**Deliberate choices to review.** Wrong language re-listens with the language forced (a normal voice request: it uses the daily budget again; only the server's automatic retry does not). Clips kept for re-listening: last 5, memory only, cleared with Clear and on leaving the page. The LLM prompt says vous always; French Protestant prayer to God often uses "tu", so a French speaker should say whether prayers need an exception.

**Real-phone steps** are sections 9.4 and 12 unchanged, plus: (1) confirm in Diagnostics that capture says `pcm` in the Home Screen app and that clip sizes are about 32 KB per second; if it says `recorder`, the worklet was refused, so switch the PCM flag off and note the iOS version. (2) Soft-onset test (O1) with PCM on and off. (3) Noisy place: 20 sentences in a cafe, count wrong sides (should be zero). (4) Read aloud with the silent worklet output node connected (R1-R3): if audio crackles or moves to the earpiece, turn PCM off and report. (5) Compare `whisper-large-v3` with turbo on the S1-S4 sets using the JSON export. (6) Run the glossary sync, set both ids, and check that "culte" comes out as "worship service".
