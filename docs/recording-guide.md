# Recording French phrases for Le Nid

Thank you for lending your voice! Learners hear your recording as the model and compare their own voice with it.

**What you need:** an iPhone (or any phone) with the Voice Memos app, a quiet room, and the phrase list your contact sends you (a table with a **file** column, for example `s-il-vous-plait`).

**The room:** a small, soft room (a bedroom with curtains, or a closet of clothes); windows shut; no fan, music, TV or dishwasher; phone on airplane mode.

**The phone:** hold it 15-20 cm (a hand's width) from your mouth, slightly to the side so your breath doesn't hit it; keep the same spot, distance and room for the whole session.

**How to say it:** your normal, clear, everyday French at a natural pace, as you would say it to a visitor; keep the usual liaisons; a regional accent is welcome. Don't read the English, and say only the French phrase.

**One clean take per phrase:** tap record, wait one second, say the phrase once, wait one second, stop. If you stumble, delete it and record again.

**Loudness:** speak at a normal conversational volume, not whispered and not projected. If the waveform touches the top and bottom edges, move the phone a little further away.

**Naming:** rename each memo to the exact **file** name from the list (lowercase, hyphens, no accents, no extension), for example `bien-sur`.

**Trimming:** you don't need to trim; leaving about a second of silence at each end is fine.

**Sending:** share the memos (or a zipped folder) with your contact. Sessions of 30 minutes with breaks are plenty.

**Voices:** we need one woman and one man to record the same list; tell your contact which you are.

**Permission:** you will be asked to sign a short release so Le Nid may use the recordings in the app.

## For the person preparing the files

Put each file in `public/reference/f1/` (woman) or `public/reference/m1/` (man) as `<file>.m4a`. Optionally normalize first:

```
ffmpeg -i in.m4a -af "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.15,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.15,areverse,highpass=f=70,loudnorm=I=-18:TP=-1.5:LRA=11" -ac 1 -ar 44100 -c:a aac -b:a 48k out.m4a
```

(This trims to a 150 ms pad and sets -18 LUFS, as plan §4.3 recommends.) Then run `node scripts/build-reference-manifest.mjs` and commit. The app picks the recordings up after the next deploy. Check progress with `node scripts/make-reference-list.mjs --only say-it`.
