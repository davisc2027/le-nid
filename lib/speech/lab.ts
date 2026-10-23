/** Speak lab calibration rows: the CSV columns (docs/speaking-build-spec.md section 10) and RFC 4180 export. Pure. */
export const LAB_COLUMNS = [
  "timestamp", "tester", "voiceGroup", "room", "attemptType", "key", "fr", "syllables", "minSec", "maxSec", "capSec", "sampleRate",
  "echoCancellation", "noiseSuppression", "autoGainControl", "clipSec", "stoppedBy", "speechSec", "peakDb", "noiseDb", "snrDb", "state",
  "riseApplicable", "riseSt", "nucleiAttempt", "refVoice", "refSec", "nucleiRef", "distance", "warp", "durationRatio", "words",
  "maxRelative", "weakestWord", "analysisMs", "userAgent", "raterLabel",
] as const;

export type LabRow = Record<(typeof LAB_COLUMNS)[number], string | number | boolean | null>;
export const MAX_LAB_ROWS = 500;

const cell = (v: string | number | boolean | null | undefined) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(rows: Partial<LabRow>[]): string {
  const lines = [LAB_COLUMNS.join(","), ...rows.map((r) => LAB_COLUMNS.map((c) => cell(r[c])).join(","))];
  return lines.join("\r\n") + "\r\n";
}

/** Appends a row, dropping the oldest beyond the cap. */
export const addRow = (rows: LabRow[], row: LabRow): LabRow[] => [...rows, row].slice(-MAX_LAB_ROWS);

export const csvName = (d = new Date()) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `speak-lab-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.csv`;
};
