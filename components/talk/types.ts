import type { Side } from "@/lib/talk/lang";

export type TurnStatus = "transcribing" | "translating" | "done" | "failed";

/** One sentence in the conversation. Lives only in memory: nothing is saved to the database. */
export type Turn = {
  id: number;
  /** Who spoke; null until the speech service has said which language it heard. */
  side: Side | null;
  original: string;
  translation: string;
  status: TurnStatus;
  /** Safari backup: words still coming in. */
  interim?: boolean;
  note?: string;
};

export type Layout = "chat" | "side";

/** Main text sizes in px; the original line is about 70% of it. */
export const TEXT_SIZES = [15, 17, 20, 24, 28] as const;
export const DEFAULT_SIZE = 1;
