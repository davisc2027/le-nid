// Shared, non-client data for the group-goal cathedral (safe to import from Server Components).
export const SPIRE_M = 142;

export const MILESTONES = [
  { at: 0.25, label: "Great portals open", short: "Portals" },
  { at: 0.5, label: "Rose window glows", short: "Rose window" },
  { at: 0.75, label: "Bells ring", short: "Bells" },
  { at: 1, label: "Cross + Odile on top", short: "Cross" },
] as const;

export const toRatio = (xp: number, target: number) =>
  target > 0 && Number.isFinite(xp) ? Math.max(0, Math.min(1, xp / target)) : 0;

// Build height (SVG y in the 240x400 cathedral drawing) for a progress ratio.
// 0-25% foundation + portals, 25-50% facade + rose, 50-75% belfry + north octagon, 75-100% openwork spire.
const STOPS: [number, number][] = [[0, 384], [0.25, 296], [0.5, 224], [0.75, 128], [1, 38]];
export function yAt(r: number) {
  const v = Math.max(0, Math.min(1, r));
  for (let i = 1; i < STOPS.length; i++) {
    const [r0, y0] = STOPS[i - 1], [r1, y1] = STOPS[i];
    if (v <= r1) return y0 + ((v - r0) / (r1 - r0)) * (y1 - y0);
  }
  return STOPS[STOPS.length - 1][1];
}
