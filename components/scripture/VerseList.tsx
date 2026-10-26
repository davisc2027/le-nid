"use client";

// The scripture home's live parts: the Rosace (with the petal of the verse in progress growing) and the verse list
// with each verse's place on the mastery path. Progress comes from the database when migration 0011 is in,
// and from this device either way, so both read it after mount.
import { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { refLabel } from "@/lib/bible/reference";
import { inEnglishNow, parseProgress, PHASES, roughFraction, statusOf, type Progress } from "@/lib/scripture/mastery";
import { mergeSaved } from "@/lib/scripture/store";
import Rosace, { PetalMeter } from "@/components/art/Rosace";

export type Row = { ref: string; learned_at: string | null; due: string | null; progress?: unknown };

const noop = () => () => {};
/** False during server render and hydration, true after: device storage and the clock are read only then. */
const useMounted = () => useSyncExternalStore(noop, () => true, () => false);

function useMerged(rows: Row[]) {
  const mounted = useMounted();
  return useMemo<Record<string, Progress | null>>(
    () => Object.fromEntries(rows.map((r) => [r.ref, mounted ? mergeSaved(r.ref, r.progress) : parseProgress(r.progress)])),
    [rows, mounted]);
}

function tag(r: Row, p: Progress | null, now: Date) {
  const due = !!r.learned_at && !!r.due && new Date(r.due) <= now;
  const s = statusOf(p, r.learned_at, now);
  if (s.kind === "new") return inEnglishNow(p) ? "English" : "Learn";
  if (s.kind === "learning") return `Phase ${s.phase + 1} of ${PHASES.length}`;
  if (s.kind === "retest") return "Retest";
  if (s.kind === "wait") return due ? "Due" : "Retest soon";
  return due ? "Due" : "Mastered";
}

/** The Rosace: one petal per learned verse; the next petal grows as the furthest verse in progress moves along. */
export function RosaceLive({ rows }: { rows: Row[] }) {
  const merged = useMerged(rows);
  const learned = rows.filter((r) => r.learned_at).length;
  const growing = Math.max(0, ...rows.filter((r) => !r.learned_at).map((r) => roughFraction(merged[r.ref])));
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <h1 className="text-2xl font-extrabold">La Rosace</h1>
      <Rosace filled={learned} total={rows.length || 6} size={210} growing={growing} />
      <p className="verse-text">{learned} of {rows.length} verses learned</p>
    </div>
  );
}

/** "My verses": each verse with its petal and where it is on the path (Learn, Phase 3 of 6, Retest, Mastered, Due). */
export default function VerseList({ rows }: { rows: Row[] }) {
  const merged = useMerged(rows);
  const mounted = useMounted();
  const now = mounted ? new Date() : null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="label">My verses</h2>
      {rows.length === 0 && <p className="text-sm text-muted">Add a verse below, or take a set from the leaders.</p>}
      {rows.map((r, i) => {
        const p = merged[r.ref];
        const t = now ? tag(r, p, now) : r.learned_at ? "Learned" : "Learn";
        return (
          <Link key={r.ref} href={`/scripture/learn?ref=${encodeURIComponent(r.ref)}`} className="card flex flex-row items-center gap-3">
            <PetalMeter value={r.learned_at && !p ? 5 / 6 : roughFraction(p)} mastered={!!p?.masteredAt} size={28} color={i} />
            <span className="verse-text flex-1">{refLabel(r.ref)}</span>
            <span className="tag shrink-0">{t}</span>
          </Link>
        );
      })}
    </section>
  );
}
