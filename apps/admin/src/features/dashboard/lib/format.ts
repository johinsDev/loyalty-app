/**
 * Pure formatters shared by the dashboard widgets — `Intl`-based, so they run in
 * server components (and the client) without a locale hook. COP is pinned (the
 * pilot tenant); revalue via the org currency later if needed.
 */
const COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});
const NUM = new Intl.NumberFormat("es-CO");
/** Compact form for tight spots — a full COP amount overflows a donut's hole. */
const COP_COMPACT = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  notation: "compact",
  maximumFractionDigits: 1,
});

export const fmtCop = (cents: number): string => COP.format(Math.round(cents) / 100);
export const fmtCopCompact = (cents: number): string =>
  COP_COMPACT.format(Math.round(cents) / 100);
export const fmtNum = (n: number): string => NUM.format(n);

export const initialsOf = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "·";

export const agoOf = (d: Date, now: number): string => {
  const min = Math.max(0, Math.round((now - new Date(d).getTime()) / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  return `${Math.round(h / 24)} d`;
};

export const deltaStr = (pct: number | null): { delta: string; trend: "up" | "down" } =>
  pct == null
    ? { delta: "—", trend: "up" }
    : { delta: `${pct >= 0 ? "+" : ""}${pct}%`, trend: pct >= 0 ? "up" : "down" };
