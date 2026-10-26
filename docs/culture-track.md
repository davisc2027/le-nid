# Culture track ("À savoir")

Scope: `content/french/culture.json` (the content), `components/culture/` (types, cards, library, quiz,
checklist), `app/(app)/culture/` (routes), and two small hooks into the lesson flow
(`components/french/MeetPhrases.tsx`, `components/french/LessonPlayer.tsx`). Checks: `node scripts/check-curriculum.mjs`.

## 1. Approach

The team is 35 Americans aged 18 to 22, mostly beginners, going to Strasbourg for faith conversations. The French course
(`docs/curriculum.md`) already has short culture notes on many phrases. This layer adds what those notes cannot hold:
the etiquette that makes the language land well, the faith context of a historically Catholic and Lutheran region that
is now largely secular, and enough Strasbourg and Alsace history to be a respectful guest.

Principles:

* **Short and plain.** Each card is 2 to 4 short sentences in plain English, with one French phrase that ties the point
  to language. Where possible the phrase is one the learner has just met in the course (quoted by its exact `fr`
  text, so the checker can prove it exists).
* **At the right moment, never in the way.** A lesson has at most one card. Faith-context and Reformation cards appear
  folded at the top of the lesson intro, *before* the faith lessons they frame (laïcité before *Who we are*, the
  *secte* card before *Starting a conversation*, church abuse before *When church has hurt*). Everyday cards appear on
  the completion screen, below *Continue*, so they never delay the next lesson. Nothing blocks, nothing is required.
* **Nuance over rules.** Practice varies by region, age and setting (la bise, tu, lateness for dinner); cards say
  so and tell the learner to follow the French person's lead.
* **No stereotypes, no pressure.** Cards describe what people commonly expect, not what "the French" are like. Faith
  cards are permission-first: ask, accept no warmly, listen more than you talk, never collect personal data.
* **Sources on every card**, and a `review` flag where a native speaker or a leader should confirm (section 4).
* **No XP.** The quiz awards nothing; `award_xp` only accepts `review` and `verse:` sources and culture is not
  practice of course phrases. Progress (cards read, questions answered right, checklist ticks) lives in localStorage
  on the device, wrapped in try/catch, and every screen works without it.

### What is in it

63 cards, 53 check questions, 22 checklist items (11 cards, 4 questions and 2 checklist items are the "Who lives here" set, section 7).

| Theme | Cards | Questions |
|---|---|---|
| Hello, vous and la bise (`politeness`) | 7 | 9 |
| Shops, cafés and meals (`out`) | 8 | 9 |
| Trams, safety and the street (`around`) | 6 | 6 |
| Homes and conversation (`homes`) | 4 | 5 |
| Faith conversations (`faith`) | 11 | 10 |
| Strasbourg's story (`history`) | 11 | 5 |
| Alsatian life (`alsace`) | 5 | 5 |
| Who lives here (`neighbours`) | 11 | 4 |

By type: etiquette 19, faith-context 10, history 9, fact 8, alsace 6. Inside each theme, cards are ordered by usefulness.

### Where cards appear in the course

41 of 60 lessons have a card. The other 11 cards (handshake, bise count, queueing, Kehl, dress, visiting the cathedral,
Katharina Zell, Saint-Thomas, Grande Île, European institutions, Alsace's two extra holidays) live only in the Culture
section, attached to a unit.

| # | Lesson | Shown | Card |
|---|---|---|---|
| 1 | u0-l1 Survival words | done | Why a stork? |
| 2 | u0-l2 Sounds and accents | done | When in doubt, vous |
| 3 | u1-l1 Hello and goodbye | done | Bonjour first, every time |
| 4 | u1-l2 Meeting someone | done | La bise: follow their lead |
| 5 | u1-l3 Small talk | done | Let them offer tu |
| 6 | u1-l4 Thanks and goodbyes | done | Salü! A little Alsatian |
| 7 | u11-l1 Slower, please | done | Start in French, then ask |
| 8 | u11-l2 Listening well | done | Debate is a compliment |
| 9 | u12-l1 Who we are | intro | Laïcité in plain words |
| 10 | u12-l2 Asking first | intro | Ask first, accept no |
| 13 | u5-l3 Telling time | done | Lunch at noon, dinner at eight |
| 14 | u5-l4 Days of the week | done | Quiet Sundays |
| 15 | u5-l5 Numbers in real life | done | Commas, dates and 18 h 30 |
| 16 | u13-l1 God, Jesus and the Bible | intro | Alsace's own church law |
| 17 | u13-l2 Church life | intro | Protestant, évangélique, catholique |
| 18 | u2-l1 Getting around | done | Soft voices on the tram |
| 20 | u2-l3 Tickets and trains | done | Validate every time |
| 21 | u2-l4 Finding your way | done | Petite France |
| 22 | u3-l1 Ordering | done | Counter, table or terrasse |
| 23 | u3-l2 Being polite | done | Hands on the table |
| 24 | u3-l3 A full meal | done | The bill comes when you ask |
| 25 | u3-l4 Dietary needs | done | Winstub classics |
| 26 | u9-l1 About me | done | Ask about life, not salary |
| 27 | u9-l2 Family | done | Invited to a home |
| 30 | u4-l1 Starting a conversation | intro | Why secte is a heavy word |
| 32 | u4-l3 Talking about faith | intro | Half say no religion |
| 34 | u14-l1 Jean 3:16 | intro | Gutenberg in Strasbourg |
| 35 | u14-l2 Romains 3:23 | intro | Calvin's Strasbourg years |
| 38 | u6-l1 Prices and paying | done | Service compris |
| 39 | u6-l2 Shopping | done | Let the vendor choose |
| 40 | u15-l1 What do you believe? | intro | Prosélytisme sounds like pressure |
| 43 | u8-l1 Asking for help | done | Crowds and pickpockets |
| 45 | u8-l3 Emergencies | done | 112 and friends |
| 47 | u16-l2 Other beliefs | intro | Many faiths, much in common |
| 48 | u16-l3 When church has hurt | intro | When church has hurt |
| 51 | u17-l1 Éphésiens 2:8-9 | intro | A Reformation city |
| 55 | u10-l1 Sightseeing | done | The cathedral |
| 56 | u10-l2 Alsatian food and the Christmas market | done | The Christkindelsmärik |
| 57 | u10-l3 Alsace and its people | done | French, German, French again |
| 59 | u18-l2 Praying together | intro | Praying with someone in public |
| 60 | u18-l3 Prayer requests | intro | First names only |

### Learner experience

* **In a lesson** (`CultureNote`): an "À savoir" card with the card type, title, text, the French phrase with a
  listen button, and, where the card has one, a line from Odile. Odile's sassy line replaces the gentle one unless
  gentle mode is on (the same `odile-gentle` setting as everywhere else); faith cards never have a sass line (the
  checker enforces this). In the intro it is folded and sits above the first phrase card; on the completion screen it
  is open, below *Continue*, with a *More in Culture* link. Opening a card marks it read. Practice and review sessions
  show nothing.
* **`/culture`**: cards grouped by theme, folded, with an unread dot and a read count per theme; opening a card shows
  its text, phrase, Odile, sources and where it sits in the course. `/culture#card-id` opens and scrolls to that card.
  Links from the Learn hub (a third card) and from the French page (one row under Odile). The *Learn* tab stays
  highlighted on `/culture`.
* **`/culture/quiz`**: 5 scenario questions with 3 options, shuffled each time; questions not yet answered right come
  first, so repeated rounds work through all 49. After *Check*, a wrong answer shows the best answer and why; a right
  answer shows the explanation and a fun fact. Each feedback links to its card. Odile reacts with the same right,
  wrong and finish moves and sounds as lessons (sound setting respected, reduced motion respected by the Odile CSS).
  No XP.
* **`/culture/checklist`**: "Before you go", 12 dos and 8 don'ts, each with a 44 px tick box and a *Why* link to its
  card.

## 2. Sources

Note on method: the sandbox proxy blocked direct page fetches (Wikipedia, service-public.fr, the city's Noël site and
most others answered 403), so facts were checked through web-search results and the excerpts they returned, across
several sources each. Every card lists its URLs in `source`; the main ones by subject:

**Official and primary**

* Laïcité: Charte de la laïcité dans les services publics, https://www.savoie.gouv.fr/contenu/telechargement/45505/369317/file/Charte%20de%20la%20laicite.pdf ;
  https://cdg14.fr/system/files/2024-08/laicite-et-service-public.pdf
* Religion statistics: INSEE, *La diversité religieuse en France* (TeO2, 2019-2020), https://www.insee.fr/fr/statistiques/6793308 ;
  https://www.insee.fr/en/statistiques/fichier/7342918/IMMFRA23-D2-en.pdf ; INED, https://www.ined.fr/fr/tout-savoir-population/focus-sur/religion-en-france
* Concordat and local law: Assemblée nationale written answers, https://questions.assemblee-nationale.fr/dyn/11/questions/QANR5L11QE31256.pdf
  (recognized cults), https://www.assemblee-nationale.fr/dyn/15/questions/QANR5L15QE4739.pdf (religion classes),
  https://questions.assemblee-nationale.fr/dyn/11/questions/QANR5L11QE67970.pdf (Good Friday, 26 December);
  Eurojuris on the 2013 Conseil constitutionnel decision, https://www.eurojuris.fr/articles/la-preservation-du-regime-concordataire-en-alsace-moselle-par-les-sages-de-la-rue-montpensier-1847.htm
* Sunday rest in Alsace-Moselle: DREETS Grand Est guide (Dec. 2022), https://grand-est.dreets.gouv.fr/sites/grand-est.dreets.gouv.fr/IMG/pdf/guide_droit_local_du_travail_dec_2022.pdf ;
  Sénat, https://www.senat.fr/leg/ppl10-093.html
* Trams: CTS, https://cts-strasbourg.eu/en/faq/travel-legally/ ; fines, https://www.cts-strasbourg.eu/en/faq/travel-legally/details/What-are-the-different-fixed-indemnity-amounts/ ;
  conduct, https://cts-strasbourg.eu/en/getting-around/bus-tram-rules-and-regulations
* Safety and emergency numbers: US State Department, https://travel.state.gov/en/international-travel/travel-advisories/france.html
* City and UNESCO: https://int.strasbourg.eu/european-institutions-and-international-organisations ;
  https://int.strasbourg.eu/unesco-world-heritage ; https://www.strasbourg.eu/fr/label-patrimoine-mondial-unesco ;
  https://whc.unesco.org/document/159766 ; Council of Europe seat (CVCE), https://www.cvce.eu/content/publication/2004/9/30/14542187-89fd-47b0-9ab0-7f92c4f4980e/publishable_en.pdf
* Christmas market: https://noel.strasbourg.eu/en/culture-et-traditions ; tourism office via Connexion,
  https://www.connexionfrance.com/article/Mag/French-Facts/Did-you-know-Strasbourg-was-France-s-first-Christmas-market
* Food: Visit Strasbourg, https://www.visitstrasbourg.fr/?p=75523 ; Michelin, https://guide.michelin.com/fr/fr/best-of/les-meilleures-winstubs-a-strasbourg-et-dans-les-environs
* Alsatian: OLCA 2012 survey, https://olcalsace.org/sites/default/files/documents/etude_linguistique_olca_edinstitut.pdf ;
  Ministère de l'Éducation, https://www.education.gouv.fr/bo/BoAnnexes/2003/hs2/alsace_mosellans1.pdf
* Cults: Gendarmerie (MIVILUDES campaign), https://www.gendarmerie.interieur.gouv.fr/gendinfo/actualites/2024/une-campagne-de-sensibilisation-et-de-prevention-contre-les-derives-sectaires
* Data protection: CNIL, https://www.cnil.fr/en/cnil-direct/question/1823 ; Conseil d'État 2 Feb. 2024, https://www.conseil-etat.fr/fr/arianeweb/CE/decision/2024-02-02/461093
* Church abuse: CIASE summary report (5 Oct. 2021), https://www.ciase.fr/medias/Ciase-Rapport-5-octobre-2021-Resume.pdf

**History and church history**

* Reformation: Musée protestant, https://museeprotestant.org/en/notice/the-reformation-in-alsace/ ; Capito chronology,
  https://capito.itergateway.org/page2.html ; Itinéraires protestants, https://itinerairesprotestants.fr/en/tours/strasbourg-1
* Saint-Thomas: https://museeprotestant.org/en/notice/saint-thomas ; https://itinerairesprotestants.fr/en/sit-to-visit/strasbourg-c
* Protestants in France: Fédération protestante (Musée protestant), https://museeprotestant.org/en/notice/la-federation-protestante-de-france/ ;
  RCF, https://www.rcf.fr/articles/actualite/pour-les-protestants-la-laicite-est-mal-comprise ; Slate, https://www.slate.fr/story/30535/evangeliques-fer-de-lance-du-protestantisme-en-france
* Calvin: Christian History Institute, https://christianhistoryinstitute.org/magazine/article/idelette-john-calvins-search-for-the-right-wife ;
  https://www.worldhistory.org/John_Calvin/.md ; Ligonier, https://learn.ligonier.org/articles/who-was-martin-bucer
* Bucer: https://tudorsociety.com/martin-bucer-a-reformer-who-wanted-peace/
* Katharina Zell: https://en.wikipedia.org/wiki/Katharina_Zell ; https://www.worldhistory.org/Katharina_Zell/
* Gutenberg: Gutenberg-Gesellschaft, https://www.gutenberg-gesellschaft.de/en/johannes-gutenberg/gutenberg-in-strasbourg/ ;
  City of Mainz, https://www.mainz.de/medien/internet/downloads/Gutenberg-Pfad-Mainz-englisch.pdf
* Cathedral: https://en.wikipedia.org/wiki/Strasbourg_Cathedral ; https://www.francethisway.com/places/strasbourg-cathedral.php
* Alsace 1871-1944: Musée protestant, https://museeprotestant.org/en/notice/alsace-from-1871-to-1918/ ;
  Store norske leksikon, https://snl.no/Alsace-Lorraine_-_historie
* Petite France: https://en.wikipedia.org/wiki/Petite_France,_Strasbourg
* Storks: National Geographic, https://www.nationalgeographic.com/adventure/article/150721-alsace-france-storks-conservation-birds

**Etiquette guides** (secondary; used only where several agree): Connexion France
(https://connexionfrance.com/magazine/connexion-tip-dont-forget-to-greet/509669,
https://www.connexionfrance.com/magazine/french-etiquette-guide-greetings-gifts-and-when-to-use-vous/606231),
The Local (tu and vous, money, dinner times), SBS Cultural Atlas (https://culturalatlas.sbs.com.au/french-culture/french-culture-greetings),
French Entrée, The Good Life France, Comme une Française, Talk in French, French Today, Rick Steves via Islands,
Lawless French, Snippets of Paris, Bonjour Paris, Trafalgar. The full list is in each card's `source`.

## 3. What is uncertain

* **Number of bises in Strasbourg.** Two is the national norm; no primary source for Alsace was reachable. The card
  avoids a number for Strasbourg and says to follow the other person.
* **Start of Protestant use of the cathedral**: sources give 1524 (first German mass), 1527 or 1529. The card says
  "after the Reformation" and only dates the return in 1681, which all sources agree on.
* **Abolition of the mass**: 1529 in most sources (20 February 1529), 1528 in one older one (Schaff).
* **Petite France's name**: the syphilis-hospital origin is the usual account, but its dates and history vary; the
  card says "probably".
* **Gutenberg**: his 1434-1444 stay is documented; whether he printed anything in Strasbourg is debated, and the card
  says so.
* **Tram fine**: 60 euros on the CTS list when checked; fines change.
* **Kehl border checks**: Germany ran checks in 2018 and stepped them up from 2025; their status at trip time is unknown.
* **Sunday opening**: local rules depend on prefectoral and municipal orders and change; the card describes the
  principle.
* **Alsatian figures**: 43% "speak it well" is the OLCA 2012 survey (adults in Alsace); newer figures may be lower.
* **Etiquette generalisations** (lateness for dinner, hands on the table, debate, speaking quietly, queueing) rest on
  travel and etiquette guides, not studies. They are worded as tendencies.
* **Évangélique as "a third of French Protestantism"** comes from an Ifop-based estimate reported in the press;
  estimates differ.
* **CIASE figure**: 216,000 is the commission's survey-based estimate; its method was contested by some. The card
  says "estimated".

## 4. Review checklist (before the trip)

Grouped by risk. Each item is also flagged in the data (`review` and `reviewNote`), so `grep -n reviewNote
content/french/culture.json` lists them.

**High risk: faith and ministry (leader, and a pastor from the partner church)**

* [ ] `secte`: how the team answers *Vous êtes une secte ?* in the partner church's own words.
* [ ] `words-protestant`: how the partner church describes itself (protestante, évangélique, libre, FPF member), and
  whether *Nous sommes protestants* is the right self-description.
* [ ] `proselytisme`: the connotation, and the suggested *partager* / *parler de ma foi* wording (native speaker too).
* [ ] `permission-first`, `laicite`: align with the team's outreach guidelines, and check any local rules on stands
  or leaflets.
* [ ] `church-hurt`: whether to cite the CIASE figure at all, and how leaders want disclosures of abuse handled.
* [ ] `prayer-public`: guidance on public prayer, touch and laying on of hands.
* [ ] `contact-data`: who keeps contacts after a conversation, and how (RGPD).
* [ ] `other-beliefs`: the team's stance on conversations with Catholics, Lutherans, Muslims and Jews.
* [ ] Quiz items on these cards (`q-secte`, `q-proselytisme`, `q-catholic`, `q-hurt`, `q-prayer-cafe`, `q-contact`,
  `q-two-minutes`, `q-not-religious`, `q-laicite`).

**Medium risk: history and tone (native Alsatian speaker and leader)**

* [ ] `alsace-history`: how to raise the malgré-nous, if at all; the "never joke that Alsatians are German" line.
* [ ] `concordat`, `cathedral`, `reformation`, `calvin`: dates and wording; how the partner church fits the concordat
  (free and evangelical churches are outside it).
* [ ] `petite-france`: the name-origin story.
* [ ] `debate`: whether "debate is a compliment" fits Alsatians, often described as more reserved.

**Medium risk: social customs (native speaker, ideally from Strasbourg and under 30)**

* [ ] `la-bise`, `bise-count`, `handshake`: what is usual at the partner church between young men, young women, and
  men and women; whether two bises is right in Strasbourg; greeting everyone one by one.
* [ ] `tu-switch`: how fast local students switch to tu with visiting Americans.
* [ ] `invited-home`: how late is normal for a home dinner in Alsace.
* [ ] `queue`: is *C'est à qui ?* the natural question (it is not in the course yet).
* [ ] `alsatian-greetings`: pronunciation and spelling of *Salü*, *Güete Morje*, *Merci vielmols* in Strasbourg, and
  the quiz distractors *Vielen Dank* and *Salü bisàmme*.

**Low risk: practical facts that change (leader, a few weeks before departure)**

* [ ] `tram-validate`: current fine and the team's ticket plan (group, day or multi-trip tickets).
* [ ] `kehl-id`: whether German border checks are in force.
* [ ] `sunday-closing`: what is actually open on Sunday near the lodging.
* [ ] `dress`, `cathedral-visit`: team dress code; the cathedral's current visiting rules and mass times.
* [ ] `emergency`: add the leader's number and the lodging address to the team sheet (the card tells learners to).

## 5. How to add or change a card

1. Add an object to `cards` in `content/french/culture.json`:
   * `id`: kebab-case, unique. `type`: `fact`, `etiquette`, `history`, `faith-context` or `alsace`. `theme`: one of
     the `themes` ids. Put it where it belongs in the theme's order (most useful first).
   * `title` (48 characters at most) and `text` (2 to 4 sentences, 440 characters at most, plain English).
   * `phrase` (optional): `{ "fr": ..., "gloss": ... }`. `fr` must be the exact text of a phrase in
     `content/french/units.json`; for a phrase the course does not teach, add `"extra": true` and flag it for review.
   * `unit`: the unit it goes with. To show it in a lesson, add `lesson` (a lesson of that unit, with no other card)
     and `moment`: `intro` (folded above the first phrase card; use it for faith context that frames the lesson) or
     `done` (open on the completion screen).
   * `odile` (optional, 140 characters, her voice: warm, a bit of French, a stork joke) and `odileSass` (optional, only
     with `odile`, never on faith-context cards).
   * `source`: at least one https URL; prefer official, city, tourism-office or academic sources, and check facts
     against two.
   * `review`: `native`, `leader` or `both`, with a `reviewNote` saying exactly what to confirm.
2. Add check questions to `questions`: `card` (the card id), `scenario` (a real situation, 160 characters), exactly 3
   `options` (90 characters each, all plausible, one clearly best), `answer` (0, 1 or 2), `explain` (one or two
   sentences, shown after answering) and an optional `fact` (shown after a right answer). Options are shuffled in the
   app; keep the right answer from being the longest option (the checker fails above 50%).
3. Optionally add a `checklist` item (`do` or `dont`, 110 characters, with its `card`).
4. Run `node scripts/check-curriculum.mjs` and `npx tsc --noEmit`.

The checker verifies: unique ids; valid types and themes; every unit, lesson and quoted phrase exists; a lesson's card
belongs to that lesson's unit and no lesson has two; a moment only with a lesson; text lengths and sentence counts; no
stray whitespace or emoji; https sources on every card; review values with notes; no sass on faith cards; 3 distinct
options and one valid answer per question; checklist references; at least 40 cards and 30 questions. It prints the
length tell of the quiz answers.

## 6. Not tested here

* The UI on a phone: folded and open cards in the lesson intro and on the completion screen, long card text on small
  screens, the quiz feedback card (sticky at the bottom), the checklist tick boxes, dark mode, VoiceOver and TalkBack
  reading of the cards and radio options, and the reduced-motion behaviour of Odile in the quiz.
* `npm run build` and the dev server (not run, by request).
* Speech of the card phrases (same device voice as the lessons).
* Size: `culture.json` (about 75 KB, roughly 20 KB gzipped) is bundled into the lesson player's client code, as `units.json` already is.
  If that matters, the cards could be passed in as props from the lesson page instead.

## 7. "Who lives here" cards (Joshua Project)

Source and reasoning: `docs/joshua-project-culture.md`. Theme `neighbours`, 11 cards: `jp-who-lives`, `jp-alsatian`,
`jp-estimates`, `jp-unreached-meaning`, `jp-north-africa`, `jp-turkish`, `jp-africa-diaspora`, `jp-engage-tips` and three
prayer cards (`jp-pray-strasbourg`, `jp-pray-heritage`, `jp-pray-welcome`); questions `q-jp-*`; checklist `do-ask-background`
and `dont-guess-faith`. Built static, no API key and no live calls.

**These cards need pastor and native review before the trip.** Every one has `review` and a `reviewNote` that starts with
"JP cards: pastor/native review", so `grep -n "JP cards" content/french/culture.json` finds them. Learners never see this.

* **No Joshua Project figure was verified live** (the sandbox could not reach joshuaproject.net). Figures came from
  search excerpts and are worded as "about", as estimates, from a "2026 snapshot". Before the trip someone with open
  internet must check: 114 groups in France; about 1.6 million Alsatians and 65% Christian by background; about 730,000
  Kabyle; about 230,000 Turkish background (JP's excerpt said 226,000); the "fewer than about 2% evangelical" definition;
  the "may contain errors" wording on the terms page. Fix the text and the year if they differ.
* **Credit.** Terms require "Data provided by Joshua Project" with a link on pages showing its content. Cards that use
  JP data carry `"credit": "joshua-project"` (shown as a link in the open card) and the theme carries it too (shown under
  the theme heading on `/culture`). The checker requires a joshuaproject.net source, a credit and "about"/"estimate"
  wording together. Terms also allow revocation and ask for cached data to be deleted: the facts are few and sit in these
  cards only, so they can be removed in one commit. Still to do: email JP about a free church-trip app and keep the reply.
* **National, not local.** JP has no Strasbourg figures; the cards say so and never guess who someone is.
* **Left out on purpose:** Roma, Manouche and Jewish cards (figures disagree widely or risk echoing pressure on a minority;
  `other-beliefs` covers the Jewish community). The African card makes no assumption of faith and gives no group figures.
* **Wording.** No "target" language; "unreached" appears only in the card that explains it, and tells learners to keep it
  out of conversation. Needs the partner church's view (it may read as mission-speak).
* **Prayer.** The three `jp-pray-*` cards rotate one a day in a "Pray today" strip on `/culture` (`PrayStrip`, offline, no
  key). They use the existing `faith-context` type; no new `pray` type. They hold no JP figures. Prayer wording is the
  leader's and the partner church's call.
* **Customs to confirm** with a Turkish-background and a Muslim-background contact: tea and hospitality, Ramadan dates
  against the trip, and the tone of the North African and African cards.
* Not built: the optional "Unreached of the Day" feed, and any lesson placement (no card has a `lesson`).
