# Le Nid promo: script and storyboard

Target: 35 to 45 seconds, 1920x1080, 30 fps. One story, told by Odile the stork:
**a nervous little stork gets the nest ready, one small step at a time, until the whole flock flies to Strasbourg together.**

The brief came in three stacked prompts; this cut satisfies all three:

1. Dynamic motion graphics with voiceover, built from the real app (to-dos, itinerary, files, plus French, scripture, culture), playful, centred on Odile and her movements.
2. Headlines rewritten as one story with a beginning, a progression and an ending; each scene leads into the next.
3. Smoother transitions; 35 to 45 seconds is fine.

## The through-lines (what carries the eye from scene to scene)

- **Odile herself.** She never leaves the frame. Each scene ends with her moving (a hop, a flight, a jump) and the next scene starts where she lands.
- **The bottom nav of the real app.** Once the phone appears, Odile stands on its tab bar. To move to the next feature she hops to the next tab, the pill follows her and the screen slides over. No cuts.
- **A "Trip readiness" bar** (the app's lesson-track style progress bar, with Odile's nest at the end) fills 0 → 25 → 50 → 75 → 100% across the story.
- **One continuous Strasbourg.** The app's backdrop (half-timbered houses, the Ill, the cathedral) stays behind everything. The sky goes from dawn to golden evening as the story moves forward.

## Voiceover (written first)

Voice: Kokoro TTS (offline, Apache-2.0 model), `af_heart` for the narrator. The two French lines use the French voice `ff_siwis`.

| # | Scene | Headline on screen | Voiceover |
|---|-------|--------------------|-----------|
| 1 | The nest (beginning) | **Odile has a big trip coming.** *Strasbourg · March 2027 · 35 of us* | "This is Odile. In March, she's leading thirty-five of us to Strasbourg. And honestly? She's a little nervous." |
| 2 | To-dos | **So she starts with the nest.** | "So she starts with the nest. Passport? Check. Packing list? Check. One to-do at a time." |
| 3 | Itinerary | **Then she maps out every day.** | "Next, she maps the trip. Every day, every tram, every meeting spot, right in your pocket." |
| 4 | Files | **Every paper, tucked in.** | "Tickets, forms, insurance. Every document, tucked safely in the nest." |
| 5 | Learn (the Duolingo part) | **A little practice, every day.** | "Then a few minutes a day. French..." *(FR: "Bonjour !")* "...scripture memory, and culture, with streaks that keep the whole team going." |
| 6 | Departure (ending) | **Until the whole flock is ready.** | "By March, we won't just be packed. We'll be ready. Together." |
| 7 | End card | **Le Nid** · *Ready together.* | "Le Nid." *(FR: "On y va !")* |

## Storyboard and transitions

1. **The nest (0 to ~8 s).** Dawn. We start close on a chimney top in the app's Strasbourg backdrop. Odile is asleep in her nest (sleepy mood, z's). A notification card pops up: *Strasbourg · March 2027 · 35 travelers*. She startles awake (oops face, sweat drop, nervous shrug). The readiness bar appears at 0%.
   *Transition:* she leaps out of the nest. The camera pulls back to reveal the city, and the Le Nid phone rises into frame. She glides down and lands on its tab bar, right on **To-dos**.
2. **To-dos (~8 to ~15 s).** The real to-do list: Passport, Packing list, Consent form. Each item checks off in time with "Check!", with Odile pecking and a sparkle. The tab badge counts 3 → 2 → 1 → 0. Readiness 25%.
   *Transition:* happy bounce, then she hops left to **Itinerary**; the pill follows her and the screen slides.
3. **Itinerary (~15 to ~21 s).** Day cards scroll up like a journey: arrival, tram to Petite France, the cathedral, serving with the church. Odile tilts her head, following along. Readiness 50%.
   *Transition:* she takes a flapping hop all the way to **Files**; the screen slides on.
4. **Files (~21 to ~26 s).** Flight tickets, consent form and insurance fly in from off-screen and drop into the list one by one; Odile catches the last one with a salute. Readiness 75%.
   *Transition:* she hops back to **Learn**.
5. **Learn (~26 to ~34 s).** A French lesson card: *How do you say "hello"?* "Bonjour" is tapped; Odile jumps with sparkles, +10 XP, the streak flame ticks up. A verse card (Psalm 46:1) and a culture card slide past. The group goal ("Raise the spire") fills. Readiness 100%.
   *Transition:* victory jump with confetti. The phone sinks away and Odile takes off into the sky.
6. **Departure (~35 to ~40 s).** Golden evening over Strasbourg. Odile swoops back in low over the rooftops with a V of 34 storks behind her (the rest of the 35), climbing toward the cathedral, and does a loop-the-loop.
   *Transition:* the camera pushes back in on her chimney, the exact framing of the opening shot, and she drops into her nest.
7. **End card (~40 to 44 s).** Bookend: same nest, same chimney, but now it's golden hour and she's beaming, not nervous. She waves; "Le Nid" settles in on the left with *Ready together. Strasbourg · March 2027 · 35 of us*, and the flock flies on overhead.

## Production notes

- `index.html` is a self-contained scene deck. Every motion hangs off one master clock (Web Animations API, all paused and seeked), so `?t=12.5` shows exactly that moment and rendering is frame-exact. Open it in a browser and it plays in real time with the voiceover; press Space to pause and the arrow keys to scrub.
- Odile's drawing, moods and motion keyframes (jump, bounce, victory, shrug, wave, hop, flap, blink, bob) are ported 1:1 from `components/art/Stork.tsx`, `lib/odile-motion.ts` and the "Odile motion" section of `app/globals.css`. Colors are the app's tokens; type is Nunito and EB Garamond, as in the app.
- `render.mjs` captures 30 fps frames with Playwright (Chromium) and pipes them to ffmpeg; `make_audio.py` builds the voiceover (Kokoro) and a small synthesized music bed with soft sfx, then everything is muxed into `le-nid-promo.mp4`.
- `timeline.js` is the single source of timing for both the picture and the sound. Change a time there, then rebuild both.
- `le-nid-promo.srt` holds captions for muted autoplay (most social players accept it as a sidecar file).

## Rebuilding

Free tools only: Python 3 with `kokoro-onnx` and `soundfile`, Node 22 with Playwright, and ffmpeg.

```sh
# 1. voice (models: kokoro-v1.0.int8.onnx -> kokoro.onnx, voices-v1.0.bin -> voices.bin,
#    from github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0; ~120 MB, keep them out of the repo)
python -m venv venv && venv/bin/pip install kokoro-onnx soundfile
venv/bin/python promo/make_vo.py <model_dir> <vo_dir>

# 2. soundtrack
venv/bin/python promo/make_audio.py <vo_dir> promo/build/mix.wav
ffmpeg -i promo/build/mix.wav -af loudnorm=I=-16:TP=-1.5:LRA=11 -ar 48000 -c:a aac -b:a 160k promo/audio/le-nid-mix.m4a

# 3. picture (uses an existing Chromium; set CHROME=/path/to/chrome if it can't find one)
node promo/render.mjs                    # -> promo/build/video.mp4
node promo/render.mjs --stills 3.5,20    # quick PNG checks

# 4. mux
ffmpeg -i promo/build/video.mp4 -i promo/audio/le-nid-mix.m4a -map 0:v -map 1:a -c copy -movflags +faststart promo/le-nid-promo.mp4
```

`promo/build/` is scratch output and is git-ignored.
