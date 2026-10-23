/** Step state machine for a Say-it step (docs/speaking-build-spec.md 6.4). Pure. */
import type { AttemptResult } from "./checks";

export type BlockedWhy = "denied" | "unsupported" | "error";
export type StepState =
  | { tag: "ready"; attempts: number }
  | { tag: "recording"; attempts: number }
  | { tag: "processing"; attempts: number }
  | { tag: "result"; attempts: number; result: AttemptResult }
  | { tag: "blocked"; attempts: number; why: BlockedWhy };

export type StepEvent =
  | { type: "start" }
  | { type: "recorded" }
  | { type: "cancel" }
  | { type: "analyzed"; result: AttemptResult }
  | { type: "retry" }
  | { type: "blocked"; why: BlockedWhy };

export const INITIAL_STEP: StepState = { tag: "ready", attempts: 0 };

export function stepReducer(s: StepState, e: StepEvent): StepState {
  if (e.type === "blocked") return { tag: "blocked", attempts: s.attempts, why: e.why };
  switch (s.tag) {
    case "ready": return e.type === "start" ? { tag: "recording", attempts: s.attempts } : s;
    case "recording":
      if (e.type === "recorded") return { tag: "processing", attempts: s.attempts };
      if (e.type === "cancel") return { tag: "ready", attempts: s.attempts };
      return s;
    case "processing": return e.type === "analyzed" ? { tag: "result", attempts: s.attempts + 1, result: e.result } : s;
    case "result": return e.type === "retry" ? { tag: "ready", attempts: s.attempts } : s;
    case "blocked": return e.type === "retry" ? { tag: "ready", attempts: s.attempts } : s;
  }
}

export const canContinue = (s: StepState): boolean => s.attempts >= 1 || s.tag === "blocked";
