# Joshua Project for the culture cards: research and proposal

Status: research only, nothing built, no app code changed. Written 2026-10-26.

## 0. How reliable is this research

* The sandbox proxy blocks joshuaproject.net and api.joshuaproject.net (HTTP 403 on connect, DNS failure from the
  fetch tool). **I could not open a single Joshua Project (JP) page.** Everything below comes from web-search result
  summaries of JP pages, plus one third-party GitHub README that I did fetch. Treat every JP number as "seen in a
  search excerpt", not "verified live". Snapshots also disagree with each other (noted per figure).
* Before any text from section 2 ships, someone with open internet must load the cited JP URLs and confirm each figure
  and its date. That step is item 1 of the build plan.
* JP publishes data per **country**, not per city. I found nothing for Strasbourg or Alsace as a place. Anything
  "in Strasbourg" is an inference from national figures plus general knowledge, and the cards say so.

## 1. What is available, and on what terms

### Data (what JP tracks)

Per people group (an ethnolinguistic group in one country, e.g. "Alsatian in France", ID 19632): population,
primary religion, Christian adherent % (range), evangelical % (range), Progress Scale (1 to 5 gospel access),
"unreached"/"frontier" flags, primary language, Bible status (portions, New Testament, complete Bible, audio),
photo, profile text and prayer points. Per country: counts of groups and unreached groups, religion breakdown,
languages. Per language: Bible translation status and the groups that speak it. Also "prayer cards" and an
"Unreached of the Day" feed.

* Country page: https://joshuaproject.net/countries/FR
* French in France: https://joshuaproject.net/people_groups/11234/FR
* Alsatian in France: https://joshuaproject.net/people_groups/19632/FR
* Turk in France: https://www.joshuaproject.net/index.php/people_groups/18274/FR
* Prayer card format: https://joshuaproject.net/pray/cards/single/18274/FR
* Definitions: https://joshuaproject.net/data ("Understanding Our Data") and the Progress Scale at https://joshuaproject.net/global/progress
* Datasets and API hub: https://joshuaproject.net/resources/datasets

### API

* REST, JSON or XML. Docs: https://api.joshuaproject.net/getting_started , sample code at
  https://api.joshuaproject.net/v1/docs/sample_code .
* **Free API key**: request via a form, verify email, key is a 12-character string, you may hold several (per the
  getting-started page as summarised by search).
* v1 pattern: `/v1/<resource>.<json|xml>?api_key=KEY`. Documented example: `/v1/people_groups/daily_unreached.json`
  (accepts month/day; this is the "Unreached of the Day"). Other resources: people_groups, countries, languages.
  Search excerpts disagreed on paths and on v1 versus a v2 with bearer tokens, so check the live docs before coding.
* Rate limits: none published that I could find (a third-party listing says the same). Assume low volume.
* No official bulk download page was found. A community mirror exists (https://raw.githubusercontent.com/data-poems/joshua-project-data/main/README.md,
  MIT for the packaging only; it says the underlying data is "provided for research purposes" and defers to JP's terms).
  Do not use the mirror as a licence shortcut.

### Terms and licence

Pages: https://joshuaproject.net/help/terms and https://api.joshuaproject.net/terms_of_use (near identical). As
summarised by search (not read in full):

* Free, non-exclusive, non-transferable, **revocable** licence, for **non-commercial missions research and
  educational use**. Selling data, commercial products or revenue-generating use are prohibited.
* **Attribution required**: the text "Data provided by Joshua Project" with a hyperlink, on any page showing JP content;
  JP may ask to change placement.
* No republishing in a way that replicates JP's services or presentation; public uses should add value.
* Data "as is", may contain inaccuracies, gaps or errors. JP may end API access at any time and change the terms, and
  **on termination you must delete downloaded or cached data**.
* No stated cache duration. No stated redistribution licence (no CC, no open licence found).

Fit for Le Nid: a free, non-profit ministry-prep PWA is plausibly within "non-commercial missions/educational use".
The cache-deletion and revocation clauses are the awkward part for static copies (section 3). Not verified:
whether a closed-audience church app needs written permission. Cheap fix: email JP, say what the app is, and keep
the reply in the repo.

## 2. What JP says about France (search excerpts, unverified live)

| Item | Figure seen | Caveat |
|---|---|---|
| France, groups and unreached | 114 groups, 37 unreached (32.5%); 4,302,000 people (6.5% of 66,435,000) in unreached groups | Western Europe regional page |
| France, Christian adherents / evangelical | ~62.4% / ~1.2% (regional page); a French-people profile shows Christianity at 67.0%, Islam 4% | Two snapshots differ. INSEE self-report (51% no religion, already on the `secular-majority` card) looks very different: JP counts heritage/adherents, not practice |
| French (the majority group) | Christianity primary, evangelical 0.1-2%, Bible complete | The 2% line is JP's own threshold |
| Alsatian in France (ID 19632) | ~1.66 million; Christian adherents 65.0%; evangelical 0.6%; "Superficially reached"; NT, no complete Bible reported | The Bible line may come from the Swiss German (gsw) language page, not Alsatian specifically. Not marked unreached |
| Kabyle in France | ~730,000 (710,000 on another page); Islam; evangelical 0.1-2%; Christian 2-5%; Progress Scale 1 | Largest Muslim group JP lists in France |
| Algerian, Arabic-speaking in France | ~488,000; Islam; evangelical 0-0.1%; Christian 0.1-2% | |
| Turk in France (ID 18274) | ~226,000; Islam; evangelical 0.00%, Christian 0.00%; "Frontier Unreached"; complete Bible in Turkish | Card source listed as "Anonymous"; 0.00% likely means "no data", not literally none |
| Muslim groups in France | 32 (older page) or 36 (newer) | Shows the data moves |
| Maninkakan (West African) in France | ~67,000; Islam; evangelical 0.1-2%; "3 Portions" | |
| Mandjak in France | ~26,000; ethnic religions; New Testament | |
| Sinte (Manouche) in France | ~32,000 (Romani language page) | Other estimates for Roma/Travellers in France run 500,000 to 1.2 million; definitions differ widely. No JP profile page confirmed |
| Jewish, French in France (ID 11764) | ~300,000; 0.00% evangelical | Deliberately **not** used in cards (see risks) |

Not found at all: Congolese, Cameroonian, Senegalese, Comorian or Moroccan groups in France as JP profiles (many
Central African migrants are Christian, so a "unreached" framing would be wrong for them); prayer-point text for any
France group; Strasbourg-level numbers; the date JP last updated each figure.

Definitions (secondary sources, to confirm at /data): unreached = under 2% evangelical and under 5% Christian
adherents; "formerly or falsely reached" = under 2% evangelical, 5-50% adherents. Critics note the 2% cut-off is a
convention, not an empirical finding.

## 3. Build static, or fetch live?

**Recommend: static, curated, hand-checked content in `culture.json`, with visible attribution and a dated
snapshot, not a runtime API call.**

Why static:
1. **The app has no server secret.** An API key in the PWA ships to every phone; a proxy route would add a server
   dependency and a key to rotate. The brief is "free tiers, no paid services".
2. **Live data is the wrong thing for these cards.** The value is a one-sentence, pastor-reviewed framing. Raw live
   numbers (changing between 32 and 36 groups, 62% vs 67%) would drift away from the cards' wording and the
   review sign-off.
3. **Offline.** The team will be on patchy roaming data; the culture section works offline today.
4. **Review and sensitivity.** Every card already carries `review`/`reviewNote`. Live feeds bypass review.
5. Only ~10 facts are used. Hand-copying them is small and auditable.

Licence tension, stated honestly: a static copy is a "cache", and the terms ask for deletion on termination. Mitigate
by (a) using few facts, rounded, each with the JP link and "Data provided by Joshua Project" attribution and a
"checked <date>" note, (b) emailing JP for written OK for a free church-trip app, (c) keeping the facts in one
`jp` snapshot block so they can be removed in one commit if asked.

Where live could help later (optional, not MVP): "Unreached of the Day" on a prayer screen. It is global, not about
France, and needs a key and caching, so use a build-time or server-side fetch with a 24-hour cache, key only on the
server, and degrade to nothing when offline. Keep it out unless the team asks.

## 4. Proposed cards

### Structure

* New theme (add to `themes`): `{ "id": "neighbours", "title": "Who lives here", "blurb": "The people of Strasbourg and how to pray for them." }`.
  Alternative with zero schema change: file them under `faith` and `alsace`.
* Types: reuse `fact`, `faith-context`, `alsace`. A new type `pray` would be nicer for a "Pray for" filter but needs
  the type list in `components/culture/data.ts` and `scripts/check-curriculum.mjs` updated (not inspected here).
* Constraints respected: title 48 chars or fewer, text 440 or fewer in 2 to 4 sentences, https sources, `review`
  with `reviewNote`, no sass on faith-context. No `phrase` (all would need `extra: true`). `unit` values (u10, u12,
  u16) are existing unit ids. Run the checker; I did not.
* Attribution: add one footer line on the Culture pages for these cards: "Some figures: Data provided by Joshua
  Project (joshuaproject.net)", as a link. Each card also lists the exact JP page in `source`.
* All numbers below must be re-verified live first (section 0).

### Draft JSON

```json
[
  {
    "id": "jp-who-lives", "type": "fact", "theme": "neighbours",
    "title": "Who lives around you in Strasbourg",
    "text": "Strasbourg is a student, European and immigrant city. Alongside families rooted in Alsace, you will meet people with North African, Turkish and sub-Saharan African roots, and many others. The research group Joshua Project counts 114 people groups in France, but its figures are national, so use them as background and never to guess who someone is.",
    "unit": "u10",
    "source": ["https://joshuaproject.net/countries/FR", "https://joshuaproject.net/data"],
    "review": "both", "reviewNote": "Re-check the 114 figure and date on the live France page. Is 'immigrant city' the right wording for a native reader?"
  },
  {
    "id": "jp-alsatian", "type": "alsace", "theme": "neighbours",
    "title": "Alsatians: Christian roots, few believers",
    "text": "Joshua Project lists about 1.6 million Alsatians in France, roughly 65% Christian by background but only about 0.6% evangelical. It calls the group superficially reached: church is part of the heritage, yet a personal faith is rare. Many locals will say Je suis catholique or protestant and mean family tradition, not belief.",
    "unit": "u16",
    "source": ["https://joshuaproject.net/people_groups/19632/FR", "https://www.insee.fr/fr/statistiques/6793308"],
    "review": "both", "reviewNote": "Verify 1.66 million, 65.0% and 0.6% live. Does an Alsatian pastor recognise this description, and is 'superficially reached' a phrase to quote at all?"
  },
  {
    "id": "jp-estimates", "type": "faith-context", "theme": "neighbours",
    "title": "Numbers are estimates, people are not",
    "text": "Figures from missions research are estimates, often built from old surveys, and they differ between pages and years. Joshua Project itself says its data may contain errors. A percentage describes a group, never the person you are talking to: ask about them and listen.",
    "unit": "u12",
    "source": ["https://joshuaproject.net/data", "https://api.joshuaproject.net/terms_of_use"],
    "review": "leader", "reviewNote": "Confirm the 'may contain errors' wording against the live terms page."
  },
  {
    "id": "jp-unreached-meaning", "type": "faith-context", "theme": "neighbours",
    "title": "What 'unreached' does and doesn't mean",
    "text": "Joshua Project calls a people group unreached when under 2% are evangelical and under 5% are Christian. It is a measure of how many churches and Bibles a group has nearby, not a judgment of its people. By that count, even the French majority is under 2% evangelical, which is why partner churches here matter so much.",
    "unit": "u12",
    "source": ["https://joshuaproject.net/data", "https://joshuaproject.net/global/progress"],
    "review": "both", "reviewNote": "Confirm the exact thresholds and the French-group figure live. Does the partner church welcome the 'unreached' vocabulary, or does it read as American mission-speak?"
  },
  {
    "id": "jp-north-africa", "type": "faith-context", "theme": "neighbours",
    "title": "Neighbours with North African roots",
    "text": "Joshua Project lists roughly 730,000 Kabyle (Berber) and 490,000 Arabic-speaking Algerians in France, almost all Muslim, with under 2% evangelical. Families often go back to Algeria, Morocco or Tunisia, and many were born in France. Start with food, family and hospitality, ask what they would like to share, and never assume belief or practice.",
    "unit": "u16",
    "source": ["https://joshuaproject.net/countries/FR", "https://joshuaproject.net/religions/6"],
    "review": "both", "reviewNote": "Verify counts live. Ask a native or a Muslim-background believer how to word this; check Ramadan dates in 2027 against the trip. No source yet confirms how large these communities are in Strasbourg."
  },
  {
    "id": "jp-turkish", "type": "faith-context", "theme": "neighbours",
    "title": "Turkish families in France",
    "text": "Joshua Project lists about 226,000 Turks in France, mostly Muslim, with almost no evangelical presence recorded, and a complete Turkish Bible exists. Many families have lived here for decades and take hospitality very seriously. Accept tea when it is offered, ask about their family and home town, and let them set the pace on faith.",
    "unit": "u16",
    "source": ["https://www.joshuaproject.net/index.php/people_groups/18274/FR", "https://joshuaproject.net/pray/cards/single/18274/FR"],
    "review": "both", "reviewNote": "0.00% on the JP card probably means no data. Confirm the tea and hospitality custom with a Turkish-background contact; confirm the Strasbourg presence from another source."
  },
  {
    "id": "jp-africa-diaspora", "type": "faith-context", "theme": "neighbours",
    "title": "Africa in Strasbourg: do not assume a faith",
    "text": "People with roots in West and Central Africa live across France. Joshua Project lists some groups as mostly Muslim, such as the Maninkakan (about 67,000), and others as mostly Christian or following traditional religions. Many African-led churches are lively partners, so ask where someone worships before you assume anything.",
    "unit": "u16",
    "source": ["https://joshuaproject.net/countries/FR", "https://joshuaproject.net/people_groups/13510"],
    "review": "both", "reviewNote": "Verify the Maninkakan figure and that ID 13510 is the right profile. No JP France profiles were confirmed for Congolese or Cameroonian groups, so this card makes no number claim for them."
  },
  {
    "id": "jp-engage-tips", "type": "etiquette", "theme": "neighbours",
    "title": "Respectful with every neighbour",
    "text": "Whoever you meet, greet with Bonjour, use vous, and ask before you talk about faith. Offer to listen to their story, accept hospitality gracefully, and be careful with food and drink, since some neighbours avoid pork or alcohol. Say who you are and which local church you are helping, and take no for an answer.",
    "unit": "u12",
    "source": ["https://joshuaproject.net/countries/FR", "https://www.savoie.gouv.fr/contenu/telechargement/45505/369317/file/Charte%20de%20la%20laicite.pdf"],
    "review": "both", "reviewNote": "Overlaps permission-first and secte; keep wording aligned with the partner church's outreach practice."
  },
  {
    "id": "jp-pray-strasbourg", "type": "faith-context", "theme": "neighbours",
    "title": "Pray for Strasbourg's neighbours",
    "text": "Pray for the partner church and its pastor, for the students you will meet, and for Alsatians who carry church as heritage but not faith. Pray for Muslim, Turkish and African families who are welcomed and respected, and for new friendships to outlast the trip. Joshua Project suggests praying for believers to love their Muslim Turkish neighbours.",
    "unit": "u18",
    "source": ["https://joshuaproject.net/pray/cards/single/18274/FR", "https://joshuaproject.net/people_groups/19632/FR"],
    "review": "leader", "reviewNote": "Prayer content is the leader's and the partner church's call. Check the JP prayer-point wording (paraphrased from a search excerpt). Is 'unit u18' right, or should this be a team-prayer page?"
  }
]
```

(Nine cards. Unit ids come from existing cards; I did not check each against `units.json`.)

### Other features

1. **Pray-for rotation**: a "Pray this week" strip on the Culture or Prayer page that cycles through the
   `jp-pray-*` cards, one a day. Static, offline, no key.
2. **"Who lives in Strasbourg" quiz questions**: 3-option scenarios in the existing format, e.g. "A new friend says
   she is Catholic. What does that tell you?" (answer: ask what it means to her).
3. **Checklist**: one do ("Ask before assuming someone's faith or background") linking to `jp-engage-tips`.
4. **Optional later**: a daily "Unreached of the Day" line, server-side cached (section 3). Skip for now.
5. **Roma/Manouche**: no card until a native or pastor advises. JP counts (~32,000 Sinte) and other estimates
   (500,000+) are too far apart, and the group is stigmatised; a thin card would harm more than it helps.

## 5. Risks

* **Stereotyping.** The biggest. "Muslim group, 0.1% evangelical" invites reading people as targets or categories.
  Mitigations: every card says "ask, don't assume"; no "unreached" label next to a named ethnic group on a headline;
  facts are about groups only; the Jewish community is excluded (JP lists it with a 0.00% figure, which in a French
  context risks echoing conversion pressure on a minority with a painful history; the existing `other-beliefs` card
  already handles it).
* **Accuracy.** Figures are estimates, snapshots conflict, and I could not open the source pages. The Alsatian Bible
  status may belong to Swiss German. 0.00% likely means "unknown". Present them rounded, with "about", a check date,
  and a source link.
* **National versus local.** No Strasbourg-level JP data. Do not imply that, say, 730,000 Kabyle live in Strasbourg.
* **Different measure from INSEE.** JP's 65-67% "Christian" is adherent/heritage, INSEE's 51% "no religion" is
  self-report. Both are on the site; the cards say why they differ so students are not confused.
* **Tone in a laïque, secte-sensitive country.** "Unreached", "target" and "mission field" can sound like colonial
  mission-speak to French readers (see `secte`, `proselytisme`). Keep vocabulary soft in anything a French person
  could see.
* **Licence.** Revocation and cache-deletion clauses; fix with attribution, permission email and one removable block.
* **Sensitive content on shared phones.** The cards are fine, but never add per-person notes (see `contact-data`).
* **Review.** All nine cards are flagged `both` or `leader`. The partner church's pastor should read all of them,
  and a native Strasbourg reader the Alsatian and North African wording. If possible, a believer with
  North African or Turkish background should read those two cards.

## 6. Build plan (in order)

1. From an open network, load each cited JP URL; record every figure, its date and the live wording of the
   terms (including cache and attribution). Fix section 2 and the cards. Save a short note of the check date.
2. Email Joshua Project describing the free church-trip PWA; keep their answer. Do not apply for an API key unless
   the live-feed option is chosen.
3. Show the nine drafts to the team leader and partner pastor; rewrite or drop cards as they advise (expect
   `jp-unreached-meaning` and `jp-pray-strasbourg` to change most).
4. Decide `neighbours` theme versus existing themes; add the theme (and optionally type `pray`) and update
   `scripts/check-curriculum.mjs` for the counts (it requires at least 40 cards and checks types and themes).
5. Add the cards to `content/french/culture.json`, a Culture footer attribution line ("Data provided by Joshua
   Project", linked), and 3-4 quiz questions plus one checklist item.
6. Run `node scripts/check-curriculum.mjs` and `npx tsc --noEmit`; check a card on a phone in light and dark.
7. Update `docs/culture-track.md` (counts, sources, uncertainties, review checklist) with these cards.
8. Optional, later: pray-for rotation; server-cached Unreached of the Day.

## Sources used for this research (all via search excerpts unless noted)

* https://api.joshuaproject.net/getting_started , https://api.joshuaproject.net/terms_of_use , https://joshuaproject.net/help/terms
* https://joshuaproject.net/countries/FR , https://joshuaproject.net/regions/10 , https://joshuaproject.net/people_groups/facts
* https://joshuaproject.net/people_groups/19632/FR , https://www.joshuaproject.net/index.php/people_groups/18274/FR , https://joshuaproject.net/people_groups/11764/FR
* https://www.joshuaproject.net/index.php/languages/gsw , https://www.joshuaproject.net/index.php/languages/rmo , https://joshuaproject.net/people_groups/13510
* https://joshuaproject.net/assets/media/handouts/status-of-world-evangelization.pdf
* https://raw.githubusercontent.com/data-poems/joshua-project-data/main/README.md (fetched directly)
* Third-party summaries (apispine.com, jentic.com, publicapis.io): used only for the "free key / non-commercial" cross-check.
