export interface YearRange {
  /** `0` means available since the game began. */
  from: number;
  /** `undefined` means available forever. */
  to: number | undefined;
}

export interface YearBounds {
  /** Earliest year a box accepts. */
  min: number;
  /** Latest year a box accepts. */
  max: number;
}

/**
 * Applies text typed into the start or end year box. A start of 0 or an empty
 * or unreadable start means always. An empty or unreadable end means forever.
 * Any other year is rounded and held inside `bounds`. The other end is pulled
 * along so the range never inverts.
 */
export function applyTypedYear(
  range: YearRange,
  side: "from" | "to",
  raw: string,
  bounds: YearBounds,
): YearRange {
  const trimmed = raw.trim();
  const typed = Number(trimmed);
  const readable = trimmed !== "" && Number.isFinite(typed);
  const year = readable
    ? Math.min(Math.max(Math.round(typed), bounds.min), bounds.max)
    : undefined;
  let { from, to } = range;
  if (side === "from") {
    from = readable && Math.round(typed) !== 0 ? year! : 0;
    if (to !== undefined && from > to) to = from;
  } else if (year === undefined) {
    to = undefined;
  } else {
    to = year;
    if (from !== 0 && to < from) from = to;
  }
  return { from, to };
}
