// USFM code | French name | English name. Used to parse references like "Jean 3:16" or "John 3:16".
const TABLE = `GEN|Genèse|Genesis
EXO|Exode|Exodus
LEV|Lévitique|Leviticus
NUM|Nombres|Numbers
DEU|Deutéronome|Deuteronomy
JOS|Josué|Joshua
JDG|Juges|Judges
RUT|Ruth|Ruth
1SA|1 Samuel|1 Samuel
2SA|2 Samuel|2 Samuel
1KI|1 Rois|1 Kings
2KI|2 Rois|2 Kings
1CH|1 Chroniques|1 Chronicles
2CH|2 Chroniques|2 Chronicles
EZR|Esdras|Ezra
NEH|Néhémie|Nehemiah
EST|Esther|Esther
JOB|Job|Job
PSA|Psaumes|Psalms
PRO|Proverbes|Proverbs
ECC|Ecclésiaste|Ecclesiastes
SNG|Cantique des cantiques|Song of Solomon
ISA|Ésaïe|Isaiah
JER|Jérémie|Jeremiah
LAM|Lamentations|Lamentations
EZK|Ézéchiel|Ezekiel
DAN|Daniel|Daniel
HOS|Osée|Hosea
JOL|Joël|Joel
AMO|Amos|Amos
OBA|Abdias|Obadiah
JON|Jonas|Jonah
MIC|Michée|Micah
NAM|Nahum|Nahum
HAB|Habakuk|Habakkuk
ZEP|Sophonie|Zephaniah
HAG|Aggée|Haggai
ZEC|Zacharie|Zechariah
MAL|Malachie|Malachi
MAT|Matthieu|Matthew
MRK|Marc|Mark
LUK|Luc|Luke
JHN|Jean|John
ACT|Actes|Acts
ROM|Romains|Romans
1CO|1 Corinthiens|1 Corinthians
2CO|2 Corinthiens|2 Corinthians
GAL|Galates|Galatians
EPH|Éphésiens|Ephesians
PHP|Philippiens|Philippians
COL|Colossiens|Colossians
1TH|1 Thessaloniciens|1 Thessalonians
2TH|2 Thessaloniciens|2 Thessalonians
1TI|1 Timothée|1 Timothy
2TI|2 Timothée|2 Timothy
TIT|Tite|Titus
PHM|Philémon|Philemon
HEB|Hébreux|Hebrews
JAS|Jacques|James
1PE|1 Pierre|1 Peter
2PE|2 Pierre|2 Peter
1JN|1 Jean|1 John
2JN|2 Jean|2 John
3JN|3 Jean|3 John
JUD|Jude|Jude
REV|Apocalypse|Revelation`;

export type Book = { code: string; fr: string; en: string };
export const BOOKS: Book[] = TABLE.split("\n").map((l) => {
  const [code, fr, en] = l.split("|");
  return { code, fr, en };
});

const fold = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[.\s]/g, "");

const BY_NAME = new Map<string, Book>();
for (const b of BOOKS) {
  BY_NAME.set(fold(b.fr), b);
  BY_NAME.set(fold(b.en), b);
  BY_NAME.set(b.code.toLowerCase(), b);
}
BY_NAME.set("apoc", BY_NAME.get("apocalypse")!);
BY_NAME.set("ps", BY_NAME.get("psaumes")!);
BY_NAME.set("psaume", BY_NAME.get("psaumes")!);
BY_NAME.set("psalm", BY_NAME.get("psalms")!);
BY_NAME.set("cantique", BY_NAME.get("cantiquedescantiques")!);

export const findBook = (name: string) => BY_NAME.get(fold(name));
export const bookByCode = (code: string) => BOOKS.find((b) => b.code === code);
