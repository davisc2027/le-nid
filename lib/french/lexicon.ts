// Small French lexicon for the exercise engine.
// FAMILIES drive gap-fill options and word-bank decoy tiles: a wrong option comes from the same family as the
// missing word (another article, another form of the same verb, another weekday), so it looks plausible and the
// learner has to think about meaning or grammar instead of eliminating a random word.
// GLOSS gives short meanings for warm-up hints and for "why" feedback after a gap-fill miss.

type Family = { name: keyof typeof FAMILY_NOTE; verb?: boolean; groups: string[][] };

/** One line of feedback per family, shown when no gloss explains the miss. */
export const FAMILY_NOTE = {
  article: "Articles agree with the noun: le, un for masculine, la, une for feminine, les, des for plural.",
  possessive: "Possessives agree with the noun that follows: mon frère, ma mère, mes parents.",
  demonstrative: "Ce, cet, cette and ces agree with the noun: ce bâtiment, cette ville.",
  preposition: "Little linking words rarely translate one to one, so learn them inside the phrase.",
  subject: "The subject has to fit the verb ending.",
  question: "Quel and quelle agree with the noun; où is where, comment is how, combien is how much.",
  number: "Check the number against the English.",
  day: "Check the day against the English.",
  time: "Check the time word against the English.",
  direction: "Gauche is left, droite is right.",
  weather: "Beau is nice, chaud is hot, froid is cold.",
  family: "Check who the sentence is about.",
  body: "Check the body part against the English.",
  verb: "The verb ending has to match its subject: je parle, vous parlez, nous parlons.",
} as const;

const FAMILIES: Family[] = [
  { name: "article", groups: [["le", "la", "les"], ["un", "une", "des"], ["du", "des", "de"]] },
  { name: "possessive", groups: [["mon", "ma", "mes"], ["votre", "vos", "notre", "nos"]] },
  { name: "demonstrative", groups: [["ce", "cette", "ces", "cet"]] },
  // pour and dans are left out on purpose: "travaille pour un café" is close enough to "dans un café" to be right.
  // en is left out too: "je crois à Dieu" or "croit à lui" for "croit en" is rare but not wrong.
  { name: "preposition", groups: [["à", "au", "aux"], ["avec", "sans"], ["de", "du", "des"]] },
  { name: "subject", groups: [["je", "nous", "il", "elle", "on", "vous", "ils"]] },
  { name: "question", groups: [["quel", "quelle", "quels", "quelles"], ["où", "comment", "combien", "quand", "pourquoi"]] },
  {
    name: "number",
    groups: [
      ["deux", "douze", "dix"], ["cinq", "cent", "sept", "seize", "six"], ["quatre", "quinze", "quarante", "trente", "quatorze"],
      ["trois", "huit", "neuf", "onze", "vingt", "soixante"],
    ],
  },
  { name: "day", groups: [["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]] },
  { name: "time", groups: [["matin", "soir", "midi"], ["demain", "hier"]] },
  { name: "direction", groups: [["gauche", "droite"]] },
  { name: "weather", groups: [["beau", "froid", "chaud"]] },
  { name: "family", groups: [["mère", "père", "sœur", "frère"], ["frères", "sœurs", "parents", "enfants"]] },
  { name: "body", groups: [["tête", "ventre", "dos", "gorge"]] },
  // verb forms: one family per verb, so a wrong option is a wrong ending, never a different verb
  ...[
    ["suis", "est", "sommes", "êtes", "sont"], ["ai", "a", "avons", "avez", "ont"], ["peux", "peut", "pouvez", "pouvons"],
    ["voudrais", "voudrait", "voudriez", "voudrions"], ["vais", "va", "allez", "vont"], ["fait", "fais", "faites", "font"],
    ["prends", "prend", "prenez", "prennent"], ["viens", "vient", "venez", "viennent"], ["sais", "sait", "savez", "savons"],
    ["comprends", "comprend", "comprenez", "comprennent"], ["bois", "boit", "buvez", "boivent"],
    ["parle", "parles", "parlez", "parlons"], ["cherche", "cherchez", "cherchons", "cherchent"],
    ["aime", "aimez", "aimons", "aiment"], ["habite", "habitez", "habitons", "habitent"],
    ["visitons", "visitez", "visite", "visitent"], ["pense", "pensez", "pensons", "pensent"],
    ["chante", "chantez", "chantons", "chantent"], ["joue", "jouez", "jouons", "jouent"],
    ["travaille", "travaillez", "travaillons", "travaillent"], ["mange", "mangez", "mangeons", "mangent"],
    ["étudie", "étudiez", "étudions", "étudient"], ["adore", "adorez", "adorons", "adorent"],
    ["respecte", "respectez", "respectons", "respectent"], ["regarde", "regardez", "regardons", "regardent"],
    ["rentre", "rentrez", "rentrons", "rentrent"], ["ferment", "ferme", "fermez", "fermons"],
    ["crois", "croit", "croyez", "croyons"], ["prie", "priez", "prions", "prient"],
  ].map((g): Family => ({ name: "verb", verb: true, groups: [g] })),
];

/**
 * Words that must never appear as a wrong option or decoy tile: tu forms can be a correct informal answer
 * (et toi for et vous), and register is taught by its own exercise.
 */
export const TU_WORDS = new Set(["tu", "te", "toi", "t'", "ton", "ta", "tes", "es", "as"]);

/** Subject pronouns: le, la or les right after one is an object pronoun (Je le prends), where la could also be right. */
export const SUBJECTS = new Set(["je", "j'", "tu", "il", "elle", "on", "nous", "vous", "ils", "elles"]);

const familyIndex = new Map<string, Family>();
for (const f of FAMILIES) for (const g of f.groups) for (const w of g) if (!familyIndex.has(w)) familyIndex.set(w, f);

export const familyOf = (word: string) => familyIndex.get(word.toLowerCase());

/** Same-family alternatives for a word, closest first (its own small group), each group in random order. */
export function siblings(word: string): string[] {
  const w = word.toLowerCase();
  const f = familyIndex.get(w);
  if (!f) return [];
  const mix = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);
  const own = f.groups.filter((g) => g.includes(w));
  const rest = f.groups.filter((g) => !g.includes(w));
  const out = [...own.flatMap(mix), ...mix(rest.flat())].filter((x) => x !== w && !TU_WORDS.has(x));
  return [...new Set(out)];
}

/** Short meanings, for warm-up hints and gap-fill feedback. Only words with one clear meaning in the course. */
export const GLOSS: Record<string, string> = {
  où: "where", comment: "how", combien: "how much", quand: "when", pourquoi: "why", quel: "which", quelle: "which",
  gare: "train station", tram: "tram", arrêt: "stop", billet: "ticket", quai: "platform", train: "train",
  loin: "far", près: "near", ici: "here", gauche: "left", droite: "right", devant: "in front", derrière: "behind",
  rue: "street", pont: "bridge", plan: "city map", toilettes: "restroom", groupe: "group", cherche: "am looking for",
  aider: "help", retard: "delay", libre: "free", descendre: "get off", tournez: "turn", traversez: "cross",
  café: "coffee", eau: "water", addition: "bill", délicieux: "delicious", table: "table", plat: "dish",
  viande: "meat", porc: "pork", sans: "without", avec: "with", pour: "for", oignons: "onions", épicé: "spicy",
  voudrais: "would like", mange: "eat", bois: "drink", payer: "pay", commander: "order", dessert: "dessert",
  pommes: "apples", merci: "thank you", beaucoup: "a lot", comprends: "understand", parle: "speak", parlez: "speak",
  anglais: "English", français: "French", lentement: "slowly", répéter: "repeat", peu: "a little", très: "very",
  belle: "beautiful", ville: "city", prier: "pray", dieu: "God", aime: "love(s)", besoin: "need", chance: "luck",
  temps: "time", église: "church", foi: "faith", espoir: "hope", histoire: "story", paix: "peace", fidèle: "faithful",
  question: "question", journée: "day", soirée: "evening", jour: "day", matin: "morning", soir: "evening",
  midi: "noon", demain: "tomorrow", hier: "yesterday", heure: "hour", heures: "o'clock", lundi: "Monday",
  mardi: "Tuesday", mercredi: "Wednesday", jeudi: "Thursday", vendredi: "Friday", samedi: "Saturday",
  dimanche: "Sunday", musée: "museum", fermé: "closed", magasins: "shops", euros: "euros", espèces: "cash",
  monnaie: "change (coins)", reçu: "receipt", cher: "expensive", sac: "bag", boulangerie: "bakery",
  réservation: "reservation", clé: "key", chambre: "room", chaude: "hot", chauffage: "heating",
  serviette: "towel", téléphone: "phone", robinet: "tap", ouvert: "open", laverie: "laundromat",
  perdu: "lost", passeport: "passport", urgent: "urgent", tête: "head", ventre: "stomach", fièvre: "fever",
  pharmacie: "pharmacy", médecin: "doctor", blessé: "hurt", famille: "family", frères: "brothers",
  sœurs: "sisters", parents: "parents", mère: "mom", père: "father", enfants: "children", chien: "dog",
  guitare: "guitar", musique: "music", chorale: "choir", lire: "read", aussi: "too", beau: "nice",
  froid: "cold", chaud: "hot", pleut: "is raining", vent: "wind", parapluie: "umbrella", cathédrale: "cathedral",
  tour: "tower", bâtiment: "building", bateau: "boat", marché: "market", tasse: "mug", gens: "people",
  langues: "languages", ans: "years", âge: "age", université: "university", deux: "two",
  trois: "three", quatre: "four", cinq: "five", six: "six", sept: "seven", huit: "eight", neuf: "nine",
  dix: "ten", onze: "eleven", douze: "twelve", quinze: "fifteen", seize: "sixteen", vingt: "twenty",
  trente: "thirty", quarante: "forty", soixante: "sixty", cent: "a hundred", oui: "yes", non: "no",
  moi: "me", nous: "we", notre: "our", votre: "your", mon: "my", ma: "my", mes: "my", bien: "well",
  minutes: "minutes", pied: "foot", deuxième: "second", rendez: "meet", moment: "moment", instant: "moment",
  quatorze: "fourteen", chapitre: "chapter", verset: "verse", versets: "verses",
  // faith words (salut is left out: it is both hi and salvation)
  bible: "Bible", seigneur: "Lord", croix: "cross", péché: "sin", grâce: "grace", pardon: "forgiveness",
  prière: "prayer", prie: "pray", crois: "believe", croit: "believes", croyez: "believe", sauvé: "saved",
  sauvés: "saved", monde: "world", vie: "life", amour: "love", espérance: "hope", gloire: "glory", don: "gift",
  gratuit: "free (no cost)", cadeau: "gift", cœur: "heart", bouche: "mouth", œuvres: "works", chemin: "way",
  vérité: "truth", porte: "door", voix: "voice", repas: "meal", culte: "worship service", pasteur: "pastor",
  chrétiens: "Christians", résurrection: "resurrection", repentance: "repentance", pécheurs: "sinners",
  invité: "invited", malade: "sick", travail: "job", prénom: "first name", ensemble: "together",
};
