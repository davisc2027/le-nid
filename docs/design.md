# Strasbourg Mission Trip App: Graphics + Gamified Design Plan

## 1. Identity
- **Name ideas:** *Le Nid* ("the nest": the team gathers, then takes off), *Envol* ("take-off"), *Cigogne*, *Allons-y Stras*. Working pick: **Le Nid**. Tagline: "Prépare ton envol."
- **Tone:** warm, playful in French practice, calm in scripture and logistics. The logistics screens (itinerary, files, to-dos) never gamify. They should look clean and trustworthy.

## 2. Palette (Tailwind tokens in CSS vars, `class` dark mode + `prefers-color-scheme`)
| Token | Light | Dark | Source |
|---|---|---|---|
| `grès` (primary) | #A8412E | #E07A5F | Cathedral red Vosges sandstone. White text on light passes AA (~6:1) |
| `colombage` (ink/timber) | #3B2A20 | #F3E9DC | Dark half-timber beams |
| `torchis` (surface) | #FAF5EC | #1B1714 | Cream plaster infill |
| `ill` (secondary) | #2F7A85 | #6FB8C2 | Ill river canals (white text ~4.9:1) |
| `bec` (accent/XP) | #F28C28 | #F6A55A | Stork beak and legs. Use with dark text only |
| `géranium` (error/heart) | #C8283C | #FF6B7A | Window-box geraniums |
| `sapin` (success) | #3C7A3A | #7CC27A | Vosges forest |
| `vitrail` (scripture accents) | #2B4C8C / #D9A520 | #8FA9E6 / #F0C75E | Cathedral stained glass: cobalt + gold |
- Dark mode is warm charcoal, not pure black. It is the default after 21:00 for evening devotion use, and the user can override it.
- Correct/wrong feedback never relies on colour alone: show an icon and text too (check / x, "Bien joué !" / "Presque…").

## 3. Typography (all SIL OFL, via `next/font`, latin + latin-ext subset, woff2)
- **Display/UI:** *Nunito* (rounded and friendly, full French diacritics). Use 800 for buttons/headings and 400–600 for body. Alternative: *Fredoka* for headings only.
- **Scripture:** *EB Garamond* or *Cormorant Garamond* (verse text 20–22px, line-height 1.6). English gloss in Nunito, muted.
- **Accessibility option:** *Atkinson Hyperlegible* toggle (OFL) in settings.
- Cap it at 2 families per screen (~60 KB total). Never use Duolingo's proprietary "Feather Bold".

## 4. Mascot: the stork ("Odile", after Alsace's patron saint; alt: "Gus")
- Simple geometric stork: white body, black wingtips, orange beak and legs, a small red-sandstone scarf, sometimes a backpack (the "missionary traveller"). Rounded shapes, 2–3px stroke and flat fills, so one SVG works at 24px and 240px.
- **Expressions/poses (8, one SVG each, shared body with swapped eye/beak/wing groups):** idle blink, cheer (wings up), proud (chest out with stamp), thinking (wing on chin), oops (sheepish, no scolding), sleepy (streak at risk, in a nest), praying/calm (scripture track, eyes closed), waving (onboarding/install).
- **Rules:** she never guilt-trips (unlike the Duo-owl meme). Reminders use an encouraging tone. In-app she speaks French with an English subtitle.
- **Production:** sketch → Figma/Inkscape vector → SVGO. Animate key poses as CSS keyframes on SVG groups. Only the 2 celebration animations become Lottie (made in the LottieFiles Creator free tier or exported via Glaxnimate, which is GPL; the output files are yours).

## 5. App icon + splash
- The stork's head in profile over a red-sandstone rounded square with a cream half-timber "X" beam pattern behind it. It must read at 48px: test as a monochrome silhouette.
- PWA manifest: 192/512 PNG + maskable variant (safe zone 80%), Apple touch icon 180, `theme_color` #A8412E, splash cream. Generate with `pwa-asset-generator` (MIT).

## 6. Illustration style + cheap asset sourcing
- **Style:** flat vector with subtle paper grain. Landmarks are simplified line + 3-tone fills (sandstone, timber, cream). Use the same stroke weight as the mascot. Avoid photos in-app except optional itinerary hero images.
- **Landmark set (12 SVGs, hand-traced from your own photos or CC0 refs):** Cathédrale, Maison Kammerzell, Petite France, Ponts Couverts, Barrage Vauban, Place Kléber, Palais Rohan, Église Saint-Thomas, Orangerie (with stork nests), Parlement européen, Ill boat, Christmas market stall.
- **Free resources (check each license at download; keep a `CREDITS.md`):**
  - Icons: **Lucide** (ISC), **Phosphor** (MIT), **Tabler** (MIT). Pick ONE (Phosphor's "duotone" fits the playful skin).
  - Emoji/stickers: **Fluent Emoji** by Microsoft (MIT, 3D/flat), **Noto Emoji + Noto animated emoji** (Apache 2.0 / OFL font), **OpenMoji** (CC BY-SA 4.0; needs attribution and share-alike), **Twemoji** graphics (CC BY 4.0).
  - Illustrations: **Open Peeps / Open Doodles** (CC0, Pablo Stanley), **unDraw** (free unDraw license, no attribution, recolor to palette), **Humaaans** (check current Blush terms).
  - Animation: **LottieFiles free animations** (Lottie Simple License, commercial OK, verify per file). Players: `lottie-web` / `@lottiefiles/dotlottie-web` (MIT). Confetti: `canvas-confetti` (ISC).
  - Sounds: **Kenney** "Interface Sounds", "UI Audio", "Digital Audio" (CC0). **Freesound** filtered to CC0. Optionally make your own in jsfxr (free).
  - Game UI shapes/badges: **Kenney** UI packs (CC0). Map tiles if needed: OpenStreetMap (ODbL, attribution).
  - Reference photos: Wikimedia Commons (mostly CC BY-SA). Use for tracing reference only, or credit them if shown.
- **Do not use:** Duolingo's owl, its green (#58CC02) as primary, its Feather font, its sound effects, or its path artwork. The open clones (RikhiSingh/Duolingo-Clone, AntonioErdeljac next14-duolingo-clone, LibreLingo, which is AGPL) are for **layout and mechanics reference only**. Their bundled images and audio may not be licensed for reuse.

## 7. What to emulate from Duolingo's design language (principles, not assets)
- Chunky "3D" buttons: a solid fill plus a 4px darker bottom border that collapses on press (`active:translate-y-1 active:border-b-0`).
- One task per screen; big tap targets; a top progress bar that fills with a slight overshoot.
- A bottom feedback sheet slides up green/red with the answer and a single "Continuer" button.
- A zig-zag path of round nodes with a "you are here" bounce; character moments at lesson start and end.
- Instant, juicy feedback (sound, haptic, colour, motion together) in under 100 ms.

## 8. Screen-by-screen (mobile-first 360–430px; bottom tab bar: Accueil · Programme · À faire · Français · Plus)
- **Home feed:** the greeting card shows stork + streak flame + today's XP ring + "next up" (next meeting / next due to-do). Below it: announcements as cards (pinned on top, unread dot, leader avatar, time-ago) and a trip-wide goal widget (spire progress). Pull-to-refresh. The install/push prompt card shows until done.
- **Itinerary:** day chips (horizontally scrollable) → vertical timeline, with time on the left and a card for each item (icon by type: train, church, meal, ministry). Tap opens the address in Maps. Show a "Hors ligne ✓" badge when cached. The current item is highlighted when in-trip.
- **Files:** grouped by meeting (accordion). Each file row has a type icon, title, size and download/offline toggle. Locked future files show a padlock + "Disponible le 12 mars" (timed release) with a soft blurred thumbnail. No gamification.
- **To-dos:** segmented control À faire / Fait. Cards show the due chip (red ≤1 day, amber ≤5), a checkbox, and an upload button for docs (passport → "privé" lock icon). Completion triggers a small check-burst and haptic, never confetti. Admin view adds a completion matrix (people × tasks).
- **French hub:** a two-card switcher at the top: **Conversation** (playful skin) | **Écriture** (calm skin), plus a shared "Révision du jour" FSRS queue button with a count badge.
- **Conversational path:** see §9A. **Lesson player:** X / progress bar / exercise / big bottom CTA. The word bank uses chip tiles that fly into slots.
- **Scripture ladder:** see §9B. The verse card is centred, with the ladder stage as 6 dots and a "Révéler" press-and-hold.
- **Translate:** two stacked panes (FR / EN) with a swap button in between. A big mic FAB plus a text field. Output has play-TTS, copy and "save to phrasebook" star buttons. Saved phrases sit below as chips. If offline, the panel greys out with "Connexion requise" plus a phrasebook fallback. Quick-phrase chips include "Où est…", "Je m'appelle…" and "Merci beaucoup".

## 9. Two distinct skins (same components, different tokens via `data-skin`)
### A. Conversation: "La Balade" (playful path map)
- A vertical scrolling illustrated map of Strasbourg: the path winds along the Ill from the train station to the Cathedral. Each **unit = a landmark** (§6 list, 10–12 units), and lessons are round stepping-stone nodes between landmarks.
- Node states: locked (grey stone), current (bouncing, stork standing on it), done (sandstone red + check), perfect (gold rim). A unit checkpoint shows the landmark illustration, which colours in from grey line art when completed.
- Background: cream with faint half-timber patterning, canal water ribbons in `ill` blue, small storks flying past (CSS, paused under reduced motion).
### B. Scripture: "La Rosace" (calm parchment + stained glass)
- Parchment texture (CSS noise gradient, no image), Garamond type, muted gold/cobalt, slower 300–400 ms easing and no bouncing.
- The home of the track is the cathedral's **rose window**: each verse in the set is one petal. Petals fill with coloured glass by ladder stage (1–6) and glow softly when mastered. Personal verses become an outer ring.
- No timers, no leaderboard and no loud sounds here: only a soft chime and the "praying" stork. Streak counts but is shown small.

## 10. Gamification layer
- **XP:** 10/lesson, +5 perfect, +2 per FSRS review, +15 verse stage-up. It feeds a daily goal ring (user picks 10/20/30 XP).
- **Streaks:** flame icon in `bec` orange, counted in the user's timezone, 1 freeze/week (shown as a little stork nest "repos"). Milestones at 3/7/14/30 days get a stork-pose card.
- **Passport ("Passeport de Strasbourg"):** a book-like screen with ink-stamp badges (SVG with rough-edge mask, slight random rotation). Stamps: each unit landmark, first verse mastered, rose window complete, 7-day streak, "Bonjour ×50", first translate, every to-do done before deadline (a logistics nudge), trip-day stamps unlocked at real locations (optional geofence, stretch).
- **Unit-completion moment:** the landmark colours in, the stork lands with a stamp, a Lottie stamp "thunk" plays with confetti in palette colours, and a share card PNG is offered (canvas render).
- **Leaderboard (opt-in, weekly):** off by default. It shows first names + avatars, top 10 + you, and resets Monday. A "team" tab compares small groups instead of individuals to reduce pressure. Never on the scripture skin.
- **Trip-wide goals:** "Construisons la flèche": everyone's XP raises the cathedral spire to its real 142 m (1 m per N XP), and milestone storeys unlock a group reward set by leaders (e.g. a Flammekueche night). A second goal fills the rose window with all team verses.
- **Sounds (≤8 files, <15 KB each, m4a/mp3, preloaded on lesson start):** correct, wrong (soft), lesson complete, stamp, streak, tap (very soft). Global mute; sound is off by default outside lessons.
- **Haptics:** `navigator.vibrate` (Android: 10 ms tap, [20,40,20] correct, 60 ms wrong). iOS Safari has no Vibration API, so it relies on sound + motion. Wrap everything in one `feedback()` helper so it degrades gracefully.

## 11. Micro-interactions
- Button press: 80 ms sink. Progress bar: spring overshoot. Correct answer: tile pulses green and shows a check. Wrong: 6px shake (disabled under reduced motion) and the answer is shown.
- XP counter rolls up with a +10 floating chip. The streak flame flickers once on the first lesson of the day.
- Scripture reveal: hold-to-reveal fades words in sequence. The cloze blank glows gold on focus. Word-diff shows missed words underlined (not just red).
- Push opt-in: the stork carries an envelope, with a 3-step illustrated iOS "Add to Home Screen" guide.
- Use skeleton shimmers (cream → sandstone tint) instead of spinners. Optimistic to-do checks.

## 12. Accessibility
- WCAG AA contrast in both themes (validate tokens with a contrast checker in CI). Focus rings use 3px `ill` blue.
- Tap targets ≥44px. Text scales to 200% without breaking layout (rem everywhere, no fixed-height cards).
- `prefers-reduced-motion`: no bounce/shake/confetti, using fades instead. A Lottie static first frame stands in.
- Use `lang="fr"` on French spans so screen readers pronounce them correctly. Add aria-live for feedback sheets. Mascot SVGs get `aria-hidden` and the message is given as text.
- Never colour alone; there is a mute toggle and every sound has a visual equivalent. A dyslexia-friendly font toggle is available, plus an option to hide the leaderboard and streaks entirely.
- Lenient grading copy says "Petite faute d'accent, c'est bon !" rather than marking it wrong.

## 13. Performance (hotel Wi-Fi, low-end Android)
- Budgets: first load JS <150 KB gzipped on non-lesson routes, LCP <2.5s on Slow 4G. Lesson pack JSON ≤50 KB/unit.
- SVG sprite for icons (one cached file) and inline mascot SVGs (~3–6 KB each after SVGO). Landmarks lazy-loaded per visible unit.
- Lottie only for 2 celebrations, dynamically imported, using the dotLottie format (smaller). CSS animations everywhere else. Confetti is loaded on demand.
- Serwist precaches the shell, fonts, sprite, sounds, mascot and the current + next lesson pack. Use stale-while-revalidate for the feed and itinerary.
- Images go through `next/image` with AVIF/WebP, ≤80 KB heroes, and blur placeholders. No video.
- Show a "Mode économie" toggle when `navigator.connection.saveData` is set or the connection is slow: it disables Lottie, sounds and parallax.
- Test on a ~€100 Android (Chrome DevTools 4× CPU throttle) and an older iPhone SE.

## 14. Production order (cheap path)
1. Tokens + type + buttons in Tailwind (M0–M1). 2. Mascot 8 poses + icon (one weekend, Inkscape/Figma free). 3. Path map + 10 landmarks (traced, ~1 hr each). 4. Rose window as a generated SVG (petals computed in code, no artwork needed). 5. Stamps (one template + per-landmark glyph). 6. Sounds from Kenney CC0. 7. 2 Lotties last.

## Open questions
1. Final app name, and is a saint's name ("Odile") for the mascot welcome, or prefer neutral ("Gus")?
2. Is anyone on the team able to draw, or should the mascot and landmarks be traced/AI-assisted (and is AI-generated art acceptable to leaders)?
3. Leaderboard: individual, team-based, or both? Do leaders want to see everyone's XP even when users opt out?
4. What should trip-wide goal rewards be, and who approves them?
5. Should the scripture track show streaks/XP at all, or stay completely ungamified?
6. Dark mode default: follow the system or the auto-evening schedule?
7. Geofenced trip-day stamps: worth location permission prompts, or keep stamps manual (leader-awarded QR codes)?
8. Do church/organization brand colours or logo need to appear anywhere?
9. Sounds on by default in lessons for teens in group settings, or off?

## Decisions (Davis)
Name: Le Nid. Mascot: Odile. Art: AI-assisted + open packs. Leaderboard: teams + opt-in individual. Scripture track: full XP and streaks (same game layer as French). Sounds off by default. Dark mode follows system. Passport stamps: location-based (needs location permission; add a leader manual-award fallback for indoor/GPS failures). No church branding. Group-goal rewards: cosmetic only (spire illustration + celebration screen).
