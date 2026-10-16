export interface YearRange {
  /** `openStart` (`0` for years) means there is no start bound. */
  from: number | undefined;
  /** `undefined` means available forever. */
  to: number | undefined;
}

export interface YearBounds {
  /** Earliest year a box accepts. */
  min: number;
  /** Latest year a box accepts. */
  max: number;
  /** Size of one stop. Typed values round to it. Defaults to `1`. */
  step?: number;
  /** The `from` value that means no start bound. Defaults to `0`. */
  openStart?: number | undefined;
}

/**
 * Applies text typed into the start or end box. The open start value
 * (`bounds.openStart`, `0` for years) or an empty or unreadable start means no
 * start bound. An empty or unreadable end means no end bound. Any other value
 * is rounded to `bounds.step` and held inside `bounds`. The other end is pulled
 * along so the range never inverts.
 */
export function applyTypedYear(
  range: YearRange,
  side: "from" | "to",
  raw: string,
  bounds: YearBounds,
): YearRange {
  const step = bounds.step ?? 1;
  const openStart = "openStart" in bounds ? bounds.openStart : 0;
  const trimmed = raw.trim();
  const typed = Number(trimmed);
  const readable = trimmed !== "" && Number.isFinite(typed);
  const rounded = Number((Math.round(typed / step) * step).toFixed(6));
  const year = readable
    ? Math.min(Math.max(rounded, bounds.min), bounds.max)
    : undefined;
  let { from, to } = range;
  if (side === "from") {
    from = readable && rounded !== openStart ? year! : openStart;
    if (to !== undefined && from !== undefined && from > to) to = from;
  } else if (year === undefined) {
    to = undefined;
  } else {
    to = year;
    if (from !== openStart && from !== undefined && to < from) from = to;
  }
  return { from, to };
}
