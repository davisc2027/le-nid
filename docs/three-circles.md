# Three Circles: a guide for team leaders

Three Circles is a simple way to talk about faith and the gospel using a drawing of three circles. In the app it is on the
**Learn** tab (the card at the top: "Share the gospel: Three Circles"). It is for the whole team.

It has three parts:

* **Watch**: the circles build up one step at a time, with the sentence to say and the verse to open. Switch English / Français
  at the top. **Show them (full screen)** hides everything except the circles and big text, keeps the screen awake, and ends with
  a closing question. Hold it up, or hand it over, for a short moment.
* **Words**: every sentence and key word in French, with the phone's French voice (speaker = normal, turtle = slow) and the
  English meaning. The microphone is an optional "say it" try; nothing is graded.
* **Practice**: put the steps in order, fill in the missing word, and a role-play that walks you through the whole conversation
  (tap to show each French sentence). The first practice of the day earns a few XP.

The credit line at the bottom is intentional: "Based on the Three Circles conversation framework (Life on Mission, NAMB)". The
wording and drawing are our own.

## Using it face to face in five minutes

1. **Start with the person, not the drawing.** Ask an opener from the Words tab ("Comment la foi était-elle présente dans votre
   famille quand vous étiez enfant ?"). Listen first. Many people here are Catholic or Protestant by background; do not assume
   they have no faith.
2. **Ask permission.** "Puis-je vous montrer quelque chose qui m'aide à réfléchir à la vie et à la foi ?" If the answer is no,
   thank them and stop. No pressure.
3. **Draw or show the circles, one at a time** (about a minute each):
   1. **God's design**: God made the world good, and made us to know him and live in peace.
   2. **Brokenness**: something went wrong; sin broke our relationship with God and each other, and we cannot fix it ourselves.
   3. **The gospel**: Jesus came, died for our sin and rose again.
   4. **Repent and believe** (the arrow): we turn from our own way and trust Jesus.
   5. **Recover and pursue** (the second arrow): we begin to live as God designed, with him and with others.
4. **Close gently.** Ask "Où vous situez-vous en ce moment ?" and then listen. Offer a next step only if they seem open:
   "Aimeriez-vous en reparler ?" It is fine if they are not ready.

## Listening phrases

Use these between the steps. They matter more than the drawing.

| French | English |
|---|---|
| Dites-m'en plus à ce sujet. | Tell me more about that. |
| Qu'en pensez-vous ? | What do you think? |
| Je comprends. | I understand. |
| J'aimerais beaucoup entendre votre histoire. | I'd love to hear your story. |
| Merci de partager cela avec moi. | Thank you for sharing that with me. |
| Puis-je vous poser une question ? | Can I ask you something? |
| Sans aucune pression. | No pressure at all. |

(The live list is on the Words tab and can be edited by admins, so it may differ from this table.)

## Tip: draw it on paper

The phone is a helper, not the point. Drawing three circles on a napkin or a scrap of paper while you talk keeps it relaxed
and personal, and the person can keep the drawing. Practise drawing it in about a minute: one circle on top, two below,
cracks in the brokenness circle, a cross in the gospel circle, then the two arrows. Use the Show-them screen when you have
no pen, or when a picture helps with a language gap.

## For admins: changing the wording

**Admin, Content tab, Three Circles.** Sub-tabs: Intro, 1 Design, 2 Brokenness, 3 Gospel, Arrows, Words, Questions.

* Every field has an English box and a Français box with a character limit (circle and arrow labels 24 characters, what to say
  320), so the text always fits the circles. **Save** changes it for everyone straight away.
* **Verses** are typed as references (for example `Romans 3:23` or `Romains 3:23`, up to three per step). The text itself is
  never stored here: it is read from the app's own Bible in each language.
* **Reset this step to the original** removes your edits for that step and brings back the wording that ships with the app.
* **Reviewed by a native speaker**: until it is ticked and saved, learners see a small "Draft French" note on French text. Tick
  it only after a native speaker and the pastor have checked the French and the theology.
* Words: add, remove and reorder the vocabulary rows. Questions: the conversation openers, listening phrases and closing
  questions (the first closing question is the one shown big at the end of Show them).
* The editor needs the database table from `supabase/migrations/0017_app_content.sql`. If it has not been run, the editor says
  "Run migration 0017 first" and everyone sees the original wording; nothing breaks.

The original wording lives in `content/gospel/three-circles.json`. After changing it run `node scripts/check-gospel.mjs`.
