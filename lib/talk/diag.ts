/** Local-only diagnostics for Conversation mode: per-turn records kept in memory, exported by the tester. Pure store. */
import type { SttDiag } from "@/lib/talk/api";

export type DiagCorrection = { type: "edit" | "flip" | "relisten" | "delete" | "check" | "retry"; at: number };

export type DiagTurn = {
  id: number;
  at: string;
  side?: string;
  clip?: { durationMs: number; peak: number; bytes: number; mime: string; pcm: boolean; floor?: number; speechMs?: number; silenceMs?: number; endReason?: string; preRollMs?: number; sampleRate?: number; forcedLang?: string };
  stt?: {
    detectedLanguage?: string; textCheck?: string; textScore?: number; sideSource?: string; confidence?: number; lowConfidence?: boolean;
    retried?: boolean; forced?: boolean; dropped?: boolean; server?: SttDiag;
  };
  translation?: { engine?: string; cached?: boolean; phrasebook?: boolean; warnings?: string[]; chars?: number };
  /** Milliseconds: capture end to upload start, STT round trip, translation, and end of speech to translation shown. */
  ms?: { encode?: number; stt?: number; translate?: number; total?: number };
  corrections: DiagCorrection[];
};

export function createDiagStore() {
  const turns = new Map<number, DiagTurn>();
  const listeners = new Set<() => void>();
  let version = 0;
  const emit = () => { version++; listeners.forEach((l) => l()); };
  return {
    update(id: number, patch: Partial<Omit<DiagTurn, "id" | "corrections">>) {
      const t = turns.get(id) ?? { id, at: new Date().toISOString(), corrections: [] };
      turns.set(id, { ...t, ...patch, stt: { ...t.stt, ...patch.stt }, translation: { ...t.translation, ...patch.translation }, ms: { ...t.ms, ...patch.ms }, clip: patch.clip ?? t.clip });
      while (turns.size > 200) turns.delete(turns.keys().next().value as number);
      emit();
    },
    correct(id: number, type: DiagCorrection["type"]) {
      const t = turns.get(id) ?? { id, at: new Date().toISOString(), corrections: [] };
      turns.set(id, { ...t, corrections: [...t.corrections, { type, at: Date.now() }] });
      emit();
    },
    list: () => [...turns.values()],
    clear() { turns.clear(); emit(); },
    subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
    version: () => version,
  };
}
export type DiagStore = ReturnType<typeof createDiagStore>;
