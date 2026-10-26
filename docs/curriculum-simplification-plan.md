# Curriculum simplification plan: less complex French early on

Status: **plan only** (nothing built). Scope when built: `content/french/units.json`, `content/french/culture.json`,
`lib/french/exercises.ts` (tier map, pair tables, frontier), `lib/french/lexicon.ts` (glosses), `lib/speech/select.ts`
and its test, `app/(app)/french/practice/page.tsx`, `scripts/check-curriculum.mjs`, `docs/curriculum.md`.
Builds **on top of** [difficulty-plan.md](difficulty-plan.md) (typing ramp, tiers by unit), which is being finished
now: start only once that work is merged and `node scripts/check-curriculum.mjs` is green.

**The owner's point.** Not "make answers more obvious" but "use less complex French early". The 35 learners (many
with no French, iPhones, trip in March 2027) meet 10 to 19 new words per lesson from lesson 1 on, and sentences such
as *Vous habitez ici depuis longtemps ?* (u1-l3: 5 words, *habiter*, *depuis*, inversion-free question with a time
adverbial) in lesson 5. Beginner courses add about 3 to 6 new words per lesson with 1-3 word phrases, then build
longer sentences out of pieces already known.

**Decision in one line.** Re-sequence, don't rewrite: no existing `fr` text and no lesson id changes; long phrases
move later (to new "part 2" units u19, u20 or a later existing lesson), 18 short new phrases fill the gaps, five
lessons are added (u0-l3, u13-l3, u5-l6, u9-l5, plus u19 ×3 and u20 ×4), 60 → **71 lessons**, 468 → **486 phrases**.
Every saved card and every finished lesson stays valid without a database migration.

## 1. How load is measured

Measured with a scratch script on the real `units.json` (to be rebuilt inside `check-curriculum.mjs`, section 6):

* **New words**: word tokens (lower-cased; elisions split, so *l'*, *d'*, *j'* are words; hyphenated words kept
  whole; place and person names such as Marie, Strasbourg, Texas, Kléber, Homme de Fer ignored) never seen in an
  earlier lesson or earlier in the same lesson.
* **Load**: the same, except that a listed formulaic chunk counts once however many words it has (*s'il vous
  plaît*, *je ne sais pas*, *je vous en prie*, *il y a*, *est-ce que/qu'*, *qu'est-ce que/qui*, *est-ce qu'il y a*,
  *un peu*, *au revoir*, *à bientôt*, *à plus tard*, *bien sûr*, *pas mal*, *ça va*, *quelque chose*, *tout droit*,
  *à gauche*, *à droite*, *de rien*, *merci beaucoup*, *il fait*, *il est*, *on est*, *aujourd'hui*, *d'accord*,
  *c'est*, *au feu*). Adults store these as single items (formulaic sequences), so they cost one slot.
* **Units**: words per phrase (`nWords`) with those chunks collapsed (*Pouvez-vous répéter, s'il vous plaît ?* = 3).
* **Structures**: first lesson where a construction appears (regexes in section 6).

### 1.1 Current load per lesson (60 lessons, course order; tier = difficulty-plan tier)

| # | Lesson | Tier | Phrases | New words | Load | Words avg/max | Structures first seen | Verse |
|---|---|---|---|---|---|---|---|---|
| 1 | u0-l1 | T0 | 7 | 15 | 7 | 1.9/4 |  |
| 2 | u0-l2 | T0 | 8 | 10 | 8 | 1.6/3 | vous+verb |
| 3 | u1-l1 | T0 | 8 | 11 | 9 | 1.6/2 |  |
| 4 | u1-l2 | T0 | 6 | 10 | 10 | 2.7/4 | je+verb |
| 5 | u1-l3 | T0 | 7 | 18 | 16 | 3.7/6 | être, depuis |
| 6 | u1-l4 | T0 | 8 | 14 | 13 | 2.6/4 | imparfait, imperative |
| 7 | u11-l1 | T1 | 8 | 17 | 16 | 3.9/5 | modal+inf, qu'est-ce que |
| 8 | u11-l2 | T1 | 8 | 10 | 10 | 3.2/5 | ne…pas, si/que clause |
| 9 | u12-l1 | T1 | 7 | 15 | 15 | 4.4/6 |  |
| 10 | u12-l2 | T1 | 7 | 12 | 12 | 4.3/7 |  |
| 11 | u5-l1 | T1 | 8 | 6 | 6 | 1.0/1 |  |
| 12 | u5-l2 | T1 | 8 | 8 | 8 | 1.0/1 |  |
| 13 | u5-l3 | T1 | 8 | 14 | 14 | 4.5/6 |  |
| 14 | u5-l4 | T1 | 8 | 18 | 18 | 3.6/6 |  |
| 15 | u5-l5 | T1 | 8 | 12 | 12 | 1.6/4 |  |
| 16 | u13-l1 | T1 | 8 | 7 | 7 | 1.9/4 |  |
| 17 | u13-l2 | T1 | 9 | 10 | 10 | 2.3/3 |  |
| 18 | u2-l1 | T2 | 8 | 12 | 12 | 4.5/7 |  |
| 19 | u2-l2 | T2 | 8 | 10 | 10 | 3.1/6 |  |
| 20 | u2-l3 | T2 | 8 | 10 | 10 | 6.2/8 | est-ce que |
| 21 | u2-l4 | T2 | 8 | 11 | 11 | 5.6/7 |  |
| 22 | u3-l1 | T2 | 9 | 12 | 12 | 4.4/7 |  |
| 23 | u3-l2 | T2 | 7 | 5 | 5 | 2.1/4 |  |
| 24 | u3-l3 | T2 | 8 | 14 | 14 | 5.1/7 | futur proche |
| 25 | u3-l4 | T2 | 8 | 12 | 12 | 4.8/6 |  |
| 26 | u9-l1 | T2 | 8 | 10 | 10 | 3.5/5 |  |
| 27 | u9-l2 | T2 | 7 | 11 | 11 | 3.6/5 |  |
| 28 | u9-l3 | T2 | 8 | 15 | 15 | 3.8/5 |  |
| 29 | u9-l4 | T2 | 8 | 9 | 9 | 3.0/5 |  |
| 30 | u4-l1 | T3 | 8 | 13 | 12 | 5.0/7 |  |
| 31 | u4-l2 | T3 | 7 | 7 | 6 | 3.9/5 | subjunctive |
| 32 | u4-l3 | T3 | 7 | 15 | 15 | 6.4/8 |  |
| 33 | u4-l4 | T3 | 8 | 6 | 6 | 4.1/6 |  |
| 34 | u14-l1 | T3 | 7 | 15 | 15 | 4.3/7 | passé composé | JHN 3:16
| 35 | u14-l2 | T3 | 6 | 10 | 10 | 4.2/6 |  | ROM 3:23
| 36 | u14-l3 | T3 | 8 | 5 | 5 | 4.8/7 |  | ROM 6:23
| 37 | u14-l4 | T3 | 6 | 9 | 9 | 4.5/6 |  | ROM 5:8
| 38 | u6-l1 | T3 | 8 | 8 | 8 | 4.1/5 |  |
| 39 | u6-l2 | T3 | 8 | 9 | 9 | 4.4/7 |  |
| 40 | u15-l1 | T4 | 8 | 10 | 10 | 5.2/8 |  |
| 41 | u15-l2 | T4 | 8 | 7 | 7 | 4.9/6 |  |
| 42 | u15-l3 | T4 | 9 | 9 | 9 | 5.1/8 |  |
| 43 | u8-l1 | T4 | 8 | 11 | 11 | 3.9/6 |  |
| 44 | u8-l2 | T4 | 8 | 9 | 9 | 5.2/7 |  |
| 45 | u8-l3 | T4 | 9 | 9 | 9 | 3.7/6 |  |
| 46 | u16-l1 | T4 | 8 | 8 | 8 | 4.6/6 |  |
| 47 | u16-l2 | T4 | 9 | 5 | 5 | 4.1/6 |  |
| 48 | u16-l3 | T4 | 8 | 11 | 11 | 4.8/6 |  |
| 49 | u7-l1 | T4 | 8 | 12 | 12 | 6.6/8 |  |
| 50 | u7-l2 | T4 | 7 | 9 | 9 | 5.6/8 |  |
| 51 | u17-l1 | T4 | 9 | 11 | 11 | 5.4/8 |  | EPH 2:8-9
| 52 | u17-l2 | T4 | 7 | 8 | 8 | 4.3/6 | futur simple | ROM 10:9
| 53 | u17-l3 | T4 | 7 | 4 | 4 | 4.4/9 |  | JHN 14:6
| 54 | u17-l4 | T4 | 8 | 11 | 11 | 5.1/9 |  | REV 3:20
| 55 | u10-l1 | T4 | 8 | 12 | 12 | 5.1/8 |  |
| 56 | u10-l2 | T4 | 8 | 15 | 15 | 5.9/8 |  |
| 57 | u10-l3 | T4 | 7 | 8 | 8 | 5.3/9 |  |
| 58 | u18-l1 | T4 | 9 | 6 | 6 | 5.3/8 |  |
| 59 | u18-l2 | T4 | 8 | 8 | 8 | 4.4/6 |  |
| 60 | u18-l3 | T4 | 8 | 8 | 8 | 4.6/7 |  |

| Tier (lessons) | New words mean / max | Load mean / max | Words per phrase mean / max |
|---|---|---|---|
| T0 (1-6) | 13.0 / 18 | 10.5 / 16 | 2.4 / 6 |
| T1 (7-17) | 11.7 / 18 | 11.6 / 18 | 2.9 / 7 |
| T2 (18-29) | 10.9 / 15 | 10.9 / 15 | 4.1 / 8 |
| T3 (30-39) | 9.7 / 15 | 9.5 / 15 | 4.6 / 8 |
| T4 (40-60) | 9.1 / 15 | 9.1 / 15 | 4.9 / 9 |

**Findings.** (1) Load is *highest* at the start and falls later: the reverse of a ramp. (2) Grammar arrives in
the first six lessons: *depuis*, être, an imperative with a reflexive (*Prenez soin de vous*) and the imperfect
(*C'était un plaisir*) by lesson 6; modal + infinitive and *qu'est-ce que* by lesson 7. (3) Lessons 9-10 (u12) and
13-14 (u5-l3/l4) average 4.3-4.5 words with 6-7 word maxima. (4) Evangelism-critical phrases land late: *Dieu vous
aime* and *Puis-je prier pour vous ?* at 31, an invitation (*Vous êtes invité*) at 58, testimony at 41. (5) Basic
politeness (*Merci*, *Pardon*, *Excusez-moi*, *De rien*) is lesson 23 and *Merci beaucoup* 19.

## 2. Target ramp

| Tier (units) | Max load per lesson | Max units per phrase (known-only phrase) | Mean words per phrase | Phrases per lesson | New-structure budget |
|---|---|---|---|---|---|
| T0 u0, u1 | **7** | **3** (5) | ≤ 2.5 | 5-7 | 1 per lesson, only: greeting formulas, intonation yes/no question, *vous avez / vous êtes / je m'appelle* as chunks |
| T1 u11, u13, u12, u5 | **9** | **4** (6) | ≤ 3.0 | 5-8 | 1 per lesson: je/vous/nous + present, *ne … pas*, *pouvez-vous / vous pouvez* + infinitive, *puis-je* (chunk), *qu'est-ce que* (chunk), *il est* + time, *on est* + day, *si vous voulez* |
| T2 u2, u3, u9 | **11** | **5** (7) | ≤ 4.2 | 5-9 | 2 per lesson: *où est / où sont*, *est-ce que*, imperative (*Tournez*, *Traversez*), *il fait*, *j'ai* + noun, partitive, *je voudrais*, *C'était* (chunk) |
| T3 u19, u4, u14, u6 | **13** | **6** (8) | ≤ 5.0 | 5-10 | 2 per lesson: *depuis*, *aller* + infinitive, passé composé as chunk (*Jésus a changé ma vie*), object pronouns, subjunctive formulas (*Que Dieu vous bénisse*) |
| T4 u15, u20, u8, u16, u7, u17, u10, u18 | **15** | **8** (10) | ≤ 6.0 | 5-10 | free: productive passé composé, imperfect, future, *si* / *que* clauses |
| Verse lessons (`verse` set) | tier cap **+4** | tier cap **+1** | - | - | exempt: the pieces keep the exact Bible wording |

"Known-only phrase" means every token was taught before (an earlier lesson or an earlier phrase of the same lesson):
such a phrase may be up to 2 units longer, which is how longer sentences enter (*Ça va bien, et vous ?* after *Ça va
?*, *Très bien* and *Et vous ?*). Load counts chunks once, so a T0 cap of 7 is about 5-7 things to remember: the
lower end of what the owner quoted is reached in most early lessons (T0 mean 6.4).

**Why these numbers.**

* **Cognitive load and working memory** (Sweller; Cowan's ~4 chunks): a new phrase is held in working memory while
  it is decoded; 3 units in T0 and 4 in T1 stay inside that limit, while 5-6 new-word sentences in lesson 5 do not.
* **Comprehension first and i+1** (Krashen; VanPatten's input processing): each phrase should add about one new
  element to known material. The known-only exemption encodes exactly that.
* **Lexical coverage** (Laufer; Hu and Nation: ~95-98% known words for comfortable comprehension): later phrases
  should be mostly recycled words; the per-lesson load cap keeps the unknown share low.
* **Formulaic sequences before grammar** (Wray; Pawley and Syder; Myles, Hooper and Mitchell on classroom French
  learners): *s'il vous plaît*, *je ne sais pas*, *puis-je*, *qu'est-ce que* are learned whole and analysed later,
  so they count as one unit and may appear before their grammar is "taught".
* **Developmental order** (Pienemann's processability: words and formulas → canonical word order → questions and
  negation → subordinate clauses): structures are gated by tier in that order; *depuis*, the passé composé outside
  formulas, the future and *si* clauses wait for T3-T4.
* **Spaced introduction and interleaving** (Pimsleur's graduated recall; Cepeda et al.; Rohrer and Taylor): a long
  sentence returns in a "part 2" unit 20-30 lessons after its short form, practical and faith units keep alternating,
  and FSRS review keeps mixing old phrases into new lessons.
* **Transfer-appropriate processing**: on the street the team needs short, sayable lines; the shortest safe forms of
  the faith phrases come first (*Dieu vous aime*, *Puis-je prier pour vous ?*, *Vous êtes invité*).

### 2.1 Structures: first lesson, now → planned

| Structure | Now | Planned |
|---|---|---|
| être (*Vous êtes d'ici ?*) | 5 | 6 |
| je + present verb | 4 (*Je viens des États-Unis*) | 8 (*Je comprends*) |
| *ne … pas* beyond the chunk *Je ne sais pas* | 8 (*Je n'y avais pas pensé*, pluperfect) | 8 (*Je ne comprends pas*) |
| modal + infinitive | 7 | 8 |
| *qu'est-ce que* (chunk) | 7 | 9 (*Qu'est-ce que ça veut dire ?*) |
| *depuis* | **5** | 34 (u19-l1) |
| imperative | **6** (*Prenez soin de vous*) | 22 (*Tournez à droite*) |
| imperfect | **6** (*C'était un plaisir*) | 27 (*C'était très bon, merci*, as a chunk) |
| *aller* + infinitive | 24 | 40 (*Je vais prier pour vous*) |
| passé composé | 34 (verse) | 39 (*Jésus a changé ma vie*, chunk; verse lessons from 41) |
| subjunctive formula | 31 | 38 |
| future | 52 | 63 |

### 2.2 Evangelism-critical phrases: lesson number, now → planned

| Phrase | Now | Planned |
|---|---|---|
| *Dieu*, *Jésus-Christ*, *La Bible* | 16 | **10** (u13 moves before u12 and u5) |
| *La prière*, *Prier* | 17 | **11** |
| *Vous êtes invité* | 58 | **12** (u13-l3) |
| *Je crois en Dieu*, *Nous sommes chrétiens* | 9 | 13 (after the words they use) |
| *Dieu vous aime* | 31 | **13** (u12-l1) |
| *Puis-je prier pour vous ?*, *Vous pouvez dire non* | 31, 10 | **14** (u12-l2) |
| *Que Dieu vous bénisse*, *Venez à notre église dimanche* | 31 | 38 |
| *Jésus a changé ma vie* (testimony) | 41 | **39** (u4-l3) |
| *Je peux vous parler de ma foi ?* (7 words) | 10 | 39 (open question 2) |
| *Je vais prier pour vous* | 33 | 40 |
| Gospel in short sentences (u15-l3), *Car Dieu a tant aimé le monde* | 42, 34 | 49, 41 |

By lesson 14 of 71 (20%) a learner can greet, thank, apologise, ask for slower speech, name God, Jesus, the Bible and
prayer, say who the team is, say *Dieu vous aime*, offer prayer, invite, and accept a no. Today that set is complete
only at lesson 58.

## 3. Restructure

**Rules.** (a) Never edit an existing `fr` (or `en`): the phrase key is `normalize(fr).slice(0,120)`, saved in
`vocab_cards.key`. A "shortened" phrase is therefore a **new** phrase with its own unique gloss, and the long original
moves later with its key. (b) Never rename or delete a lesson id; new lessons get new ids at the end of an existing
unit (`u0-l3`, `u13-l3`, `u5-l6`, `u9-l5`) or in new units `u19`, `u20`. (c) Unit order in the array changes: **u13
moves before u12**; u19 goes after u9; u20 after u15. (d) Verse pieces never change.

New units: **u19 "Bavarder"** (blurb: "Longer small talk, built from what you know"; T3) and **u20 "En ville, la
suite"** (blurb: "Longer sentences for trams, time and food"; T4). New lesson titles are in the table; changed
titles: u1-l4 "Goodbyes", u3-l2 "At the table".

### 3.1 New order (71 lessons)

Legend: plain = stays; `⟵u3-l2` = moved in from that old lesson (key unchanged); **bold +** = new phrase (gloss in
brackets). Every moved phrase appears once, at its destination. Lessons 1-33 list every phrase; later rows list
changes only. Load and words avg/max are measured on this exact layout.

| # | Lesson | Tier | Phr | Load | Words avg/max | Phrases |
|---|---|---|---|---|---|---|
| 1 | u0-l1 Survival words | T0 | 7 | 7 | 1.9/4 | Oui · Non · S'il vous plaît · D'accord · Bien sûr · Voilà · Je ne sais pas |
| 2 | u0-l2 Sounds and accents | T0 | 7 | 6 | 1.6/3 | Très · Un peu · Moi · Tu · Vous · Vous avez · Il y a |
| 3 | u0-l3 Thank you, sorry | T0 | 7 | 7 | 1.7/4 | Merci ⟵u3-l2 · Merci beaucoup ⟵u2-l2 · De rien ⟵u3-l2 · Je vous en prie ⟵u3-l2 · Excusez-moi ⟵u3-l2 · Pardon ⟵u3-l2 · **+Monsieur** (Sir) |
| 4 | u1-l1 Hello and goodbye | T0 | 6 | 6 | 1.5/2 | Bonjour · Bonsoir · Salut · Au revoir · À bientôt · Bonjour, madame |
| 5 | u1-l2 Meeting someone | T0 | 6 | 7 | 2.3/3 | Comment allez-vous ? · Très bien, merci · **+Et vous ?** (And you?) · Comment vous appelez-vous ? · Je m'appelle Marie · Enchanté |
| 6 | u1-l3 Small talk | T0 | 5 | 5 | 2.8/5 | Ça va ? · Ça va bien, et vous ? · Pas mal · Moi aussi ! ⟵u9-l3 · Vous êtes d'ici ? |
| 7 | u1-l4 Goodbyes | T0 | 5 | 7 | 2.2/3 | Bonne journée ⟵u1-l1 · Bonne soirée · Bonne nuit ⟵u1-l1 · Bon week-end ! · À plus tard |
| 8 | u11-l1 Slower, please | T1 | 6 | 8 | 3.7/5 | Je comprends · Vous comprenez ? · Je ne comprends pas ⟵u3-l2 · Je parle un peu français · Pouvez-vous parler plus lentement ? · Pouvez-vous répéter, s'il vous plaît ? |
| 9 | u11-l2 Listening well | T1 | 5 | 9 | 2.8/5 | Ah bon ? · C'est vrai · Je vois · Je suis d'accord · Qu'est-ce que ça veut dire ? ⟵u11-l1 |
| 10 | u13-l1 God, Jesus and the Bible | T1 | 5 | 8 | 1.4/2 | Dieu · Jésus-Christ · La Bible · L'Évangile · Le Seigneur |
| 11 | u13-l2 Church life | T1 | 6 | 8 | 2.0/3 | Une église protestante · Le culte · La messe · Le pasteur · La prière · Prier |
| 12 | u13-l3 More faith words | T1 | 6 | 7 | 2.5/4 | Le Saint-Esprit ⟵u13-l1 · Le Fils de Dieu ⟵u13-l1 · La croix ⟵u13-l1 · Une étude biblique ⟵u13-l2 · Vous êtes invité ⟵u18-l1 · **+Bienvenue !** (Welcome!) |
| 13 | u12-l1 Who we are | T1 | 6 | 8 | 3.3/4 | Nous sommes chrétiens · **+Nous sommes étudiants** (We are students) · Nous sommes protestants · Je crois en Dieu · Dieu vous aime ⟵u4-l2 · Nous ne vendons rien |
| 14 | u12-l2 Asking first | T1 | 5 | 8 | 3.6/4 | Vous êtes pressé ? · Seulement si vous voulez · Vous pouvez dire non · Merci, c'est gentil · Puis-je prier pour vous ? ⟵u4-l2 |
| 15 | u5-l1 One to eight | T1 | 8 | 7 | 1.0/1 | Un · Deux · Trois · Quatre · Cinq · Six · Sept · Huit |
| 16 | u5-l2 Bigger numbers | T1 | 8 | 8 | 1.0/1 | Neuf · Dix · Douze · Quinze · Vingt · Cinquante · Soixante-dix · Cent |
| 17 | u5-l3 Telling time | T1 | 5 | 8 | 3.6/4 | Quelle heure est-il ? · Il est midi · **+Il est deux heures** (It's two o'clock) · Rendez-vous à dix-huit heures · Je suis en retard |
| 18 | u5-l4 Days of the week | T1 | 5 | 7 | 2.0/4 | On est quel jour ? · On est jeudi · **+Lundi** (Monday) · **+Samedi** (Saturday) · **+Dimanche** (Sunday) |
| 19 | u5-l5 Numbers in real life | T1 | 7 | 8 | 1.4/4 | Onze · Seize · Trente · Quarante · Soixante · Quatre-vingts · Ça fait vingt euros |
| 20 | u5-l6 Today and tomorrow | T1 | 6 | 6 | 2.0/3 | **+Aujourd'hui** (Today) · À demain ⟵u1-l4 · Demain matin ⟵u5-l4 · Hier soir ⟵u5-l4 · Ce week-end ⟵u5-l4 · Le dimanche matin ⟵u13-l2 |
| 21 | u2-l1 Getting around | T2 | 7 | 9 | 3.9/7 | Où est la gare ? · Où est l'arrêt de tram ? · Où est la cathédrale ? ⟵u10-l1 · C'est loin ? · C'est près d'ici ⟵u2-l2 · Pouvez-vous m'aider ? · Un ticket de tram, s'il vous plaît |
| 22 | u2-l2 Directions | T2 | 6 | 8 | 3.2/6 | Tout droit · À gauche · À droite · **+Tournez à droite** (Turn right) · C'est à droite ou à gauche ? · Où sont les toilettes ? |
| 23 | u2-l3 Tickets and trains | T2 | 5 | 8 | 4.6/6 | **+Un aller simple, s'il vous plaît** (A one-way ticket, please) · **+Un aller-retour, s'il vous plaît** (A round-trip ticket, please) · Faut-il valider le ticket ? ⟵u2-l1 · Le train a du retard · Où faut-il descendre ? |
| 24 | u2-l4 Finding your way | T2 | 7 | 9 | 4.3/7 | Je ne sais pas où je suis · **+Où est la place Kléber ?** (Where is Place Kléber?) · Tournez à gauche au feu · Traversez le pont · **+C'est à cinq minutes** (It's five minutes away) · Je cherche mon groupe ⟵u2-l2 · La rue ⟵u0-l2 |
| 25 | u3-l1 Ordering | T2 | 8 | 9 | 4.1/6 | Un café, s'il vous plaît · Deux cafés, s'il vous plaît · Je voudrais un croissant · De l'eau, s'il vous plaît · Une carafe d'eau, s'il vous plaît · L'addition, s'il vous plaît · C'est délicieux ! · C'est combien ? |
| 26 | u3-l2 At the table | T2 | 5 | 7 | 4.2/7 | Parlez-vous anglais ? · Une table pour quatre, s'il vous plaît ⟵u3-l3 · La carte, s'il vous plaît ⟵u3-l3 · Qu'est-ce que vous recommandez ? ⟵u3-l3 · On peut commander ? ⟵u3-l3 |
| 27 | u3-l3 A full meal | T2 | 5 | 8 | 4.4/5 | **+Le plat du jour** (The dish of the day) · **+Une tarte aux pommes** (An apple tart) · **+Un dessert, s'il vous plaît** (A dessert, please) · Est-ce qu'on peut payer séparément ? · C'était très bon, merci |
| 28 | u3-l4 Dietary needs | T2 | 7 | 10 | 4.7/6 | **+Pas de viande, s'il vous plaît** (No meat, please) · Est-ce qu'il y a du porc ? · Est-ce que c'est sans gluten ? · Quels sont les ingrédients ? · Sans oignons, s'il vous plaît · Je suis allergique aux cacahuètes · C'est épicé ? |
| 29 | u9-l1 About me | T2 | 6 | 11 | 3.0/4 | D'où venez-vous ? · Je viens des États-Unis ⟵u1-l2 · J'habite au Texas · J'ai vingt ans · J'ai dix-neuf ans ⟵u5-l5 · Quel âge avez-vous ? |
| 30 | u9-l2 Family | T2 | 6 | 9 | 3.3/5 | Voici ma famille · Merci pour tout ⟵u1-l4 · J'ai deux frères · Mes parents habitent en Californie · Avez-vous des enfants ? · J'ai un chien |
| 31 | u9-l3 Hobbies | T2 | 5 | 9 | 3.8/5 | Qu'est-ce que vous aimez faire ? · J'aime jouer au foot · Je joue de la guitare · J'adore la musique · J'aime lire |
| 32 | u9-l4 The weather | T2 | 8 | 10 | 3.0/5 | Quel temps fait-il ? · Il fait beau · Il fait froid · Il fait chaud · Il pleut · Il y a du vent · Il neige ! · Prenez un parapluie |
| 33 | u9-l5 Studies and work | T2 | 6 | 10 | 4.2/5 | Je suis à l'université ⟵u9-l1 · J'étudie la psychologie ⟵u9-l1 · Je travaille dans un café ⟵u9-l1 · Que faites-vous dans la vie ? ⟵u9-l1 · Mon père est pasteur ⟵u9-l2 · Ma mère est infirmière ⟵u9-l2 |
| 34 | u19-l1 More small talk | T3 | 6 | 13 | 4.3/6 | in: C'est ma première fois en France ⟵u1-l3 · Vous habitez ici depuis longtemps ? ⟵u1-l3 · On se tutoie ? ⟵u1-l3 · Vous faites du sport ? ⟵u9-l3 · Je chante dans une chorale ⟵u9-l3 · Nous chantons ensemble ⟵u13-l2; rest unchanged |
| 35 | u19-l2 Our group | T3 | 6 | 6 | 4.3/6 | in: Nous sommes un groupe d'étudiants ⟵u12-l1 · Nous sommes ici avec notre église ⟵u12-l1 · Nous visitons Strasbourg avec notre groupe ⟵u4-l1 · C'était un plaisir ⟵u1-l4 · Prenez soin de vous ⟵u1-l4 · Bonne continuation ⟵u1-l4; rest unchanged |
| 36 | u19-l3 Opinions | T3 | 7 | 10 | 4.4/6 | in: C'est intéressant ⟵u11-l2 · Vous pouvez l'écrire ? ⟵u11-l1 · Comment dit-on ça en français ? ⟵u11-l1 · Je ne sais pas trop ⟵u11-l2 · Je n'y avais pas pensé ⟵u11-l2 · Qu'est-ce que vous en pensez ? ⟵u11-l2 · Je ne veux pas vous déranger ⟵u12-l2; rest unchanged |
| 37 | u4-l1 Starting a conversation | T3 | 8 | 9 | 4.5/6 | in: Juste deux minutes ⟵u12-l2 · Nous aidons une église de Strasbourg ⟵u12-l1; out: Nous visitons Strasbourg avec notre groupe ⟶u19-l2, Qu'est-ce que vous me conseillez de visiter ? ⟶u10-l1; rest unchanged |
| 38 | u4-l2 Offering kindness | T3 | 7 | 12 | 4.6/6 | in: Je respecte votre point de vue ⟵u4-l3 · Pas de problème, merci quand même ⟵u4-l3; out: Puis-je prier pour vous ? ⟶u12-l2, Dieu vous aime ⟶u12-l1; rest unchanged |
| 39 | u4-l3 Talking about faith | T3 | 6 | 11 | 6.2/7 | in: Jésus a changé ma vie ⟵u15-l2 · Je peux vous parler de ma foi ? ⟵u12-l2; out: Est-ce que je peux vous poser une question ? ⟶u15-l1, Je respecte votre point de vue ⟶u4-l2, Pas de problème, merci quand même ⟶u4-l2; rest unchanged |
| 40 | u4-l4 Prayer and encouragement | T3 | 8 | 8 | 4.1/6 | unchanged |
| 41 | u14-l1 Jean 3:16 | T3 | 7 | 15 | 4.3/7 | unchanged |
| 42 | u14-l2 Romains 3:23 | T3 | 6 | 10 | 4.2/6 | unchanged |
| 43 | u14-l3 Romains 6:23 | T3 | 8 | 5 | 4.8/7 | unchanged |
| 44 | u14-l4 Romains 5:8 | T3 | 6 | 9 | 4.5/6 | unchanged |
| 45 | u6-l1 Prices and paying | T3 | 8 | 8 | 4.1/5 | unchanged |
| 46 | u6-l2 Shopping | T3 | 7 | 7 | 4.0/5 | out: Où est la boulangerie la plus proche ? ⟶u20-l4; rest unchanged |
| 47 | u15-l1 What do you believe? | T4 | 9 | 11 | 5.6/8 | in: Est-ce que je peux vous poser une question ? ⟵u4-l3; rest unchanged |
| 48 | u15-l2 My story | T4 | 7 | 7 | 4.9/6 | out: Jésus a changé ma vie ⟶u4-l3; rest unchanged |
| 49 | u15-l3 The good news, simply | T4 | 9 | 10 | 5.1/8 | unchanged |
| 50 | u20-l1 Trams and trains, part 2 | T4 | 8 | 5 | 6.8/8 | in: Quel tram va à la cathédrale ? ⟵u2-l1 · Est-ce que cette place est libre ? ⟵u2-l3 · À quelle heure part le train ? ⟵u2-l1 · Où est-ce que je peux acheter un billet ? ⟵u2-l3 · Un aller simple pour Colmar, s'il vous plaît ⟵u2-l3 · Un aller-retour pour Paris, s'il vous plaît ⟵u2-l3 · De quel quai part le train ? ⟵u2-l3 · Est-ce que ce tram va à Kehl ? ⟵u2-l3; rest unchanged |
| 51 | u20-l2 Finding your way, part 2 | T4 | 5 | 5 | 6.0/6 | in: Comment aller à la place Kléber ? ⟵u2-l4 · C'est à cinq minutes à pied ⟵u2-l4 · Prenez la deuxième rue à droite ⟵u2-l4 · Pouvez-vous me montrer sur le plan ? ⟵u2-l4 · C'est en face de la cathédrale ⟵u2-l4; rest unchanged |
| 52 | u20-l3 Times and plans | T4 | 7 | 8 | 5.4/6 | in: Il est deux heures et demie ⟵u5-l3 · Il est huit heures du soir ⟵u5-l3 · À quelle heure on se retrouve ? ⟵u5-l3 · Dans un quart d'heure ⟵u5-l3 · Le musée est fermé le lundi ⟵u5-l4 · Les magasins ferment le dimanche ⟵u5-l4 · Je rentre aux États-Unis samedi ⟵u5-l4; rest unchanged |
| 53 | u20-l4 Food, part 2 | T4 | 6 | 9 | 6.3/7 | in: Je vais prendre le plat du jour ⟵u3-l3 · Comme dessert, une tarte aux pommes ⟵u3-l3 · Je ne mange pas de viande ⟵u3-l4 · Je ne bois pas d'alcool ⟵u3-l4 · Je suis allergique aux fruits à coque ⟵u3-l1 · Où est la boulangerie la plus proche ? ⟵u6-l2; rest unchanged |
| 54 | u8-l1 Asking for help | T4 | 8 | 11 | 3.9/6 | unchanged |
| 55 | u8-l2 Feeling unwell | T4 | 8 | 9 | 5.2/7 | unchanged |
| 56 | u8-l3 Emergencies | T4 | 9 | 9 | 3.7/6 | unchanged |
| 57 | u16-l1 When the answer is no | T4 | 8 | 8 | 4.6/6 | unchanged |
| 58 | u16-l2 Other beliefs | T4 | 9 | 5 | 4.1/6 | unchanged |
| 59 | u16-l3 When church has hurt | T4 | 8 | 11 | 4.8/6 | unchanged |
| 60 | u7-l1 Checking in | T4 | 8 | 12 | 6.6/8 | unchanged |
| 61 | u7-l2 Everyday needs | T4 | 7 | 9 | 5.6/8 | unchanged |
| 62 | u17-l1 Éphésiens 2:8-9 | T4 | 9 | 11 | 5.4/8 | unchanged |
| 63 | u17-l2 Romains 10:9 | T4 | 7 | 8 | 4.3/6 | unchanged |
| 64 | u17-l3 Jean 14:6 | T4 | 7 | 4 | 4.4/9 | unchanged |
| 65 | u17-l4 Apocalypse 3:20 | T4 | 8 | 11 | 5.1/9 | unchanged |
| 66 | u10-l1 Sightseeing | T4 | 8 | 14 | 5.5/8 | in: Qu'est-ce que vous me conseillez de visiter ? ⟵u4-l1; out: Où est la cathédrale ? ⟶u2-l1; rest unchanged |
| 67 | u10-l2 Alsatian food and the Christmas market | T4 | 8 | 15 | 5.9/8 | unchanged |
| 68 | u10-l3 Alsace and its people | T4 | 7 | 8 | 5.3/9 | unchanged |
| 69 | u18-l1 Invitations | T4 | 8 | 5 | 5.6/8 | out: Vous êtes invité ⟶u13-l3; rest unchanged |
| 70 | u18-l2 Praying together | T4 | 8 | 8 | 4.4/6 | unchanged |
| 71 | u18-l3 Prayer requests | T4 | 8 | 8 | 4.6/7 | unchanged |

Totals: 21 units, 71 lessons, 486 phrases (468 kept, 18 new). Per tier on this layout:

| Tier (lessons) | Load mean / max (was) | Words per phrase mean / max (was) |
|---|---|---|
| T0 (1-7) | **6.4 / 7** (10.5 / 16) | **2.0 / 5** (2.4 / 6) |
| T1 (8-20) | **7.7 / 9** (11.6 / 18) | **2.3 / 5** (2.9 / 7) |
| T2 (21-33) | **9.0 / 11** (10.9 / 15) | **3.9 / 7** (4.1 / 8) |
| T3 (34-46) | 9.5 / 13 (9.5 / 15) | 4.5 / 7 (4.6 / 8) |
| T4 (47-71) | 8.8 / 15 (9.1 / 15) | 5.2 / 9 (4.9 / 9) |

The 5- and 6-word phrases left in T0-T2 are known-only recombinations (*Ça va bien, et vous ?*, *Je ne sais pas
où je suis*, *C'est à droite ou à gauche ?*) or chunk-heavy (*Une table pour quatre, s'il vous plaît*).

**Safety kept early:** *Je suis allergique aux cacahuètes* stays in u3-l4 (lesson 28) and *Où sont les toilettes ?*,
*Pouvez-vous m'aider ?* stay in u2. Emergencies (u8) are unchanged.

**New phrases: notes for the builder** (all vous-register; `tu` only where valid for the check): *Monsieur* (note:
"muh-syuh"; the r is silent), *Et vous ?* (`tu`: *Et toi ?*), *Bienvenue !*, *Nous sommes étudiants* (note:
*étudiantes* for an all-women group), *Il est deux heures*, *Lundi*, *Samedi*, *Dimanche* (note: no capital letter
mid-sentence), *Aujourd'hui*, *Tournez à droite*, *Un aller simple / Un aller-retour, s'il vous plaît*, *Où est la
place Kléber ?*, *C'est à cinq minutes*, *Le plat du jour*, *Une tarte aux pommes*, *Un dessert, s'il vous plaît*,
*Pas de viande, s'il vous plaît*. Moved phrases keep their notes; two notes that point backwards must be reworded:
*Merci*'s note (fine), *Merci beaucoup* (now taught with *Merci*; fine), and any note in u19/u20 that says "as in
lesson X".

## 4. Compatibility with existing progress

**Lesson ids.** All 60 ids stay, with the same unit prefix; the 11 new ids (`u0-l3`, `u13-l3`, `u5-l6`, `u9-l5`,
`u19-l1..3`, `u20-l1..4`) match `^u([0-9]|[12][0-9]|30)-l([0-9]|1[0-9]|20)$` (migration 0010) and the check's
"l1, l2... no gaps" rule. **No migration.** Ten unit ids (u21-u30) remain for later growth.

**Unlocking** (`app/(app)/french/page.tsx`): open up to one past the furthest finished lesson in course order.
Inserted lessons before a learner's frontier show as open and unfinished, never locked, never required.

**Worked case: someone who finished u0-l1, u0-l2, u1-l1, u1-l2 and u1-l3 under the old layout.**

* `lesson_progress` keeps the 5 rows; they show as done. Frontier = u1-l3 (now #6) so u1-l4 (#7) opens next, and the
  new u0-l3 (#3) is open but not done (worth doing: it has *Merci*). XP: new lessons pay once as usual.
* Their cards: every key still exists, so nothing is orphaned. Cards for phrases that moved (*Vous habitez ici depuis
  longtemps ?*, *C'est ma première fois en France*, *On se tutoie ?* ⟶ u19-l1; *Je viens des États-Unis* ⟶ u9-l1;
  *C'était un plaisir*, *Prenez soin de vous*, *Bonne continuation* ⟶ u19-l2) keep their FSRS state and due dates and
  still come up in Practice.
* **Bug to fix first (task B3):** `frontierFromCards` takes the furthest *home lesson of any card*. After the move,
  that card for *Vous habitez ici…* has its home at #34 (T3), so Practice would jump to tier 3 for a lesson-5
  learner, the very problem the owner raised. Fix: the practice page also reads `lesson_progress` and passes
  `frontier` = index of the furthest finished lesson; `frontierFromCards` stays as a fallback only and ignores cards
  whose home lesson is beyond `furthest finished + 1`.
* **Review tails** (`pickReviewPhrases`) draw from finished lesson ids, so this learner could get *Moi aussi !* (now in
  their finished u1-l3) without having met it. Fix: when `cards` is not null, the pool keeps only phrases that have a
  card (cards are saved for every phrase of a finished lesson, so a new learner sees no difference).
* Lessons whose content changed under an old checkmark (u1-l2 to u1-l4, u11, u12, u13, u5-l3/l4, u2, u3, u9, u4) are
  not reset: the learner met a superset of the hard material, and the new short phrases are reachable through the
  open-but-unfinished new lessons and review. No "redo" prompt (open question 5).

**SRS keys.** Unchanged by construction. A check (section 6) freezes the 468 shipped keys and 60 shipped ids in
`content/french/shipped.json`, written once from today's file **before** any content edit; later edits may add but
never drop. Recordings (`public/reference/<voice>/<stem>`) are keyed by phrase key too, so they follow moved phrases.

**Verse links.** The 8 verse lessons (u14-l1..4, u17-l1..4) keep ids, `verse` fields and phrases; they move from #34-37
to #41-44 and from #51-54 to #62-65. `MeetPhrases` finds the verse from the phrases and Scripture progress is keyed by
verse, so nothing else changes. Verse lessons get the cap exemption in section 2.

**Tiers.** Add `u19: 3, u20: 4` to `UNIT_TIER`. Tier blocks become T0 1-7, T1 8-20, T2 21-33, T3 34-46, T4 47-71
(u15-l1 is index 46). The check's hard-coded `first4 !== 39` becomes "first tier-4 lesson is u15-l1" by id.

## 5. Lexicon, distractors, audio, culture cards

* **`SAME_MEANING` additions** (pairs a learner could defend): *Où est la place Kléber ?* / *Comment aller à la place
  Kléber ?*; *C'est à cinq minutes* / *C'est à cinq minutes à pied*; *Pas de viande, s'il vous plaît* / *Je ne mange
  pas de viande*; *Monsieur* / *Bonjour, madame* is not needed. Gloss-subset pairs are already blocked by
  `blocked()` (*And you?* in *I'm doing well, and you?*; *We are students*; *A one-way ticket, please*; *Sunday*).
* **`NEAR_MISS` additions** (good contrasts, with reason): *Il est deux heures* / *Il est deux heures et demie*;
  *Tournez à droite* / *Tournez à gauche au feu*; *Un aller simple, s'il vous plaît* / *Un aller-retour, s'il vous
  plaît*; *Lundi* / *Samedi*; *Dieu vous aime* / *Vous êtes invité* is not a pair.
* **`GLOSS`** (`lib/french/lexicon.ts`): add *monsieur* "sir", *bienvenue* "welcome", *étudiants* "students",
  *aujourd* is not a word after `normalize`, so gloss *aujourd'hui* through a note instead. Families need nothing.
* **Decoys in T0-T1** must be already taught (`decoysTaught`). Smaller early vocabularies mean fewer family decoys;
  the engine already falls back to recently met phrases. The existing ramp checks cover it; watch the printed
  "wrong options from units not met" rate (should stay ≤ 1%).
* **Say-it selection** (`lib/speech/select.ts`): `u0-` lessons get 3 sound-coverage picks, so u0-l3 gets 3
  (likely *Merci*, *Pardon*, *Monsieur*). The rule `li >= 2 && (li - 2) % 3 === 2` assumes two u0 lessons; change it
  to `k = li - U0_COUNT; k >= 0 && k % 3 === 2` with `U0_COUNT` computed from `ALL_LESSONS`, then regenerate the
  `SAY_IT` table in `lib/speech/phase1.test.mjs` (every id after u0 shifts). Shorter phrases make more lessons
  eligible for `speakable(fr, 5, 8)`, which is welcome.
* **Recordings**: `public/reference/f1` and `m1` are empty today, so nothing is re-recorded. Regenerate the volunteer
  list (`node scripts/make-reference-list.mjs`) after the restructure so the 18 new phrases are on it.
* **Culture cards** (`content/french/culture.json`; one card per lesson, the card's lesson must be in its unit):

| Card | Now | Re-point to | Why |
|---|---|---|---|
| `tu-switch` | u1 / u1-l3 | u19 / u19-l1 | *On se tutoie ?* moves there |
| `debate` | u11 / u11-l2 | u19 / u19-l3 | *Qu'est-ce que vous en pensez ?* moves there |
| `sunday-closing` | u5 / u5-l4 | u20 / u20-l3 | *Les magasins ferment le dimanche* moves there |
| `kehl-id` | u2 (no lesson) | u20 | *Est-ce que ce tram va à Kehl ?* moves there |

  All other cards keep working (their quoted phrase still exists); `secte` (u4-l1), `tram-validate` (u2-l3) and
  `invited-home` (u9-l2) now sit in the lesson that teaches their phrase. Add an advisory line to the check that lists
  cards quoting a phrase taught *after* the card's lesson (today: `start-in-french`, `cathedral`, `alsatian-greetings`).
* **Unit art**: u19 and u20 fall back to the default cathedral in `components/art/LandmarkArt.tsx`; new art optional.

## 6. New checks in `scripts/check-curriculum.mjs` (new section "Language load")

Tokens come from `E.normalize` (so they match the engine's `taughtThrough`), with the chunk list of section 1 and a
`NAMES` list written in normalized form. Tier comes from `E.tierOf(i)`, so the caps follow the difficulty-plan tiers.

1. **Shipped ids and keys never disappear**: every id and key in `content/french/shipped.json` still exists.
2. **Load cap** per lesson: `load ≤ LOAD_CAP[tier] (+4 if verse)`, `LOAD_CAP = [7, 9, 11, 13, 15]`.
3. **Phrase length**: `units ≤ UNITS_CAP[tier] (+1 if verse)`, `UNITS_CAP = [3, 4, 5, 6, 8]`, or up to `+2` when the
   phrase has no new token.
4. **Mean words per phrase** per tier ≤ `[2.5, 3.0, 4.2, 5.0, 6.0]`; phrases per lesson 5-7 in T0, 5-8 in T1.
5. **Structure gates** (regex on `fr`, first tier allowed): imperative, *est-ce que* (not *qu'est-ce que*) ≥ T2;
   *depuis*, *aller* + infinitive, subjunctive formulas, passé composé ≥ T3 (verse lessons and an allow-list of chunks
   such as *C'était très bon, merci*, *Jésus a changé ma vie* exempt); future, imperfect outside the allow-list, *si*
   clauses other than *si vous voulez* ≥ T4. At most 1 newly introduced structure per lesson in T0-T1, 2 after.
6. **Evangelism milestones** (lesson number ≤): *Jésus-Christ*, *La Bible*, *La prière* 12; *Dieu vous aime*,
   *Puis-je prier pour vous ?*, *Vous êtes invité*, *Vous pouvez dire non* 15; *Jésus a changé ma vie* 40.
7. **Frontier regression**: cards for every phrase of lessons 1-5 plus the moved *Vous habitez ici depuis longtemps ?*,
   `lesson_progress` through u1-l3: practice tier is 0 and no item is typed.
8. **Review pool regression**: with cards, `pickReviewPhrases` never returns a phrase without a card.
9. Replace the hard-coded tier-4 index; print the load table (lesson, tier, load, avg/max words, new structures)
   like the ramp table, so drift stays visible. Advisory culture-card ordering (section 5).

Checks 2-5 start **report-only** (printed, not failing) during content batches 1-4 and are switched to failing in B9.

## 7. Build tasks (for a Sonnet builder, in order)

* **B0.** Wait until the difficulty-ramp work is merged and the check is green. Read AGENTS.md and the Next.js docs it
  points to before touching `app/`.
* **B1.** Write `content/french/shipped.json` (60 ids, 468 keys from today's file) and check 1. Commit alone.
* **B2.** Add the "Language load" section (checks 2-9, report-only) and the `CURRICULUM_WIP=1` switch: while set, a
  lesson with fewer than 5 phrases is a warning, and lesson generation skips it. Confirm the printed table matches
  section 1.1 within ±1 per lesson (tokenizer differences); if not, note the delta in this file.
* **B3.** Engine and app safety, before content moves: `UNIT_TIER` entries for u19/u20; practice frontier from
  `lesson_progress` (practice page + `LessonPlayer` practice mode + `buildPractice`); review-pool filter; Say-it offset
  in `select.ts`; checks 7 and 8 failing from now on.
* **B4. Content batch 1, units u0, u1, u11, u13** (moves *into* these units; source lessons may drop below 5 under
  `CURRICULUM_WIP`): new u0-l3 and u13-l3, move u13 before u12 in the array, the 3 new phrases, notes.
* **B5. Batch 2, units u12, u5, u2, u3**: new u5-l6, 11 new phrases, `SAME_MEANING`/`NEAR_MISS` pairs for them.
* **B6. Batch 3, units u9, u19, u4, u14**: new u9-l5 and unit u19 (inserted after u9), u4 changes; u14 untouched.
* **B7. Batch 4, units u6, u15, u20, u8**: new unit u20 inserted after u15; u15-l1/l2 changes.
* **B8. Batch 5, units u16, u7, u17, u10, u18**: u10-l1 and u18-l1 changes; then culture re-points (section 5),
  GLOSS additions, regenerated `SAY_IT` table, regenerated recording list.
* **B9.** Drop `CURRICULUM_WIP`, switch checks 2-5 to failing, fix any lesson over a cap by moving (never editing) a
  phrase, then run `node scripts/check-curriculum.mjs 80`, the speech tests, type check, lint and build.
* **B10.** Update `docs/curriculum.md` (section 8.3 order table, totals, moved-phrase list) and the tier table in
  `docs/difficulty-plan.md`; mark this plan "built".

Each batch is one commit whose diff is reviewable on its own: units.json changes only in that batch's units plus the
removals at the sources, and the check output (load table) pasted in the commit message.

## 8. Review before release

* **Native speaker** (30-45 min): the 18 new phrases and glosses (is *Monsieur* alone natural as "Sir"? *Pas de
  viande, s'il vous plaît* to a waiter? *C'est à cinq minutes*?), and whether the reordered early lessons read
  naturally as small dialogues (lessons 3-7, 12-14).
* **Pastor / mission leader**: faith words at lessons 10-12 before numbers; *Dieu vous aime* and *Puis-je prier
  pour vous ?* at 13-14, before learners can do much small talk (the notes already say "once there is some warmth";
  is that enough?); *Vous êtes invité* next to church words; testimony at 39; *Je peux vous parler de ma foi ?* moving
  from 10 to 39.
* **Three beginners on iPhones** (no French): lessons 1-14 over three days. Pass if each lesson takes ≤ 8 minutes, no
  lesson ends with more than 3 missed items, and on day 4 they can say *Bonjour*, *Merci*, *Je ne comprends pas*,
  *Dieu vous aime* and *Puis-je prier pour vous ?* from an English prompt.
* **Existing learners**: one account with old progress through u1-l3 and one through u4-l2: confirm nothing is
  locked, done marks stay, Practice is at the right tier, and no review item is a never-seen phrase.

## 9. Open questions

1. Is a T0 load of up to 7 (mean 6.4) acceptable, or should T0-T1 lessons be cut to 5 phrases (about +4 lessons, 75
   total)?
2. *Je peux vous parler de ma foi ?* (7 words) moves from lesson 10 to 39. Keep it early as a fixed formula instead,
   with an exemption?
3. `tu-switch` culture card: follow *On se tutoie ?* to lesson 34 (planned), or stay at lesson 6 as context only?
4. The Christmas-market lines in u10-l2 (lesson 67, load 15) are of little use in March: keep, or move to an
   optional end unit?
5. Should learners whose finished lessons changed see a small "new phrases in this lesson" badge? (Not planned: it
   needs a stored content version.)
6. Allergies: the team's real allergies may need personal phrases (*Je suis allergique à …*); in scope?
7. Faith words before numbers (u13 before u5): fine for the pastor, or keep numbers first and accept *Jésus* at 15?
