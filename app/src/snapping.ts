export type Vec2 = [number, number];
export type Segment = [Vec2, Vec2];

export const GRID_STEPS = [0.1, 0.5, 1, 5] as const;
export const ANGLE_STEPS = [1, 5, 15, 45, 90] as const;

export interface SnapSettings {
  /** Grid size in meters, or null for no grid snapping. */
  grid: number | null;
  /** Snap to vertices, nodes, and origins. */
  vertex: boolean;
  /** Snap onto the nearest point of an edge. */
  edge: boolean;
  /** Angle step in degrees, or null for free rotation. */
  angle: number | null;
}

export type SnapKind = "vertex" | "edge" | "grid" | "none";

export interface SnapResult {
  /** Shift to add to every source point. */
  delta: Vec2;
  kind: SnapKind;
  /** The snapped-to point, for drawing a marker. */
  target?: Vec2;
}

export function defaultSnap(): SnapSettings {
  return { grid: 1, vertex: true, edge: true, angle: 15 };
}

export function snapToGrid(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** Snaps an angle in radians to the nearest multiple of `stepDeg` degrees. */
export function snapAngle(radians: number, stepDeg: number | null): number {
  if (stepDeg === null) return radians;
  const step = (stepDeg * Math.PI) / 180;
  return Math.round(radians / step) * step;
}

export function nearestOnSegment(p: Vec2, [a, b]: Segment): Vec2 {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return [a[0], a[1]];
  const t = Math.max(
    0,
    Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2),
  );
  return [a[0] + t * dx, a[1] + t * dy];
}

/**
 * Finds the shift that moves a group of source points onto a snap target.
 * Priority: vertex or node, then edge, then grid. Only the first source point
 * snaps to the grid, so the group keeps its shape.
 */
export function snapMove(
  sources: Vec2[],
  targets: Vec2[],
  segments: Segment[],
  settings: SnapSettings,
  threshold: number,
): SnapResult {
  if (settings.vertex) {
    let best: SnapResult | null = null;
    let bestDist = threshold;
    for (const s of sources) {
      for (const t of targets) {
        const d = Math.hypot(t[0] - s[0], t[1] - s[1]);
        if (d <= bestDist) {
          bestDist = d;
          best = {
            delta: [t[0] - s[0], t[1] - s[1]],
            kind: "vertex",
            target: t,
          };
        }
      }
    }
    if (best) return best;
  }
  if (settings.edge) {
    let best: SnapResult | null = null;
    let bestDist = threshold;
    for (const s of sources) {
      for (const seg of segments) {
        const n = nearestOnSegment(s, seg);
        const d = Math.hypot(n[0] - s[0], n[1] - s[1]);
        if (d <= bestDist) {
          bestDist = d;
          best = { delta: [n[0] - s[0], n[1] - s[1]], kind: "edge", target: n };
        }
      }
    }
    if (best) return best;
  }
  if (settings.grid !== null && sources.length > 0) {
    const [x, y] = sources[0];
    const gx = snapToGrid(x, settings.grid);
    const gy = snapToGrid(y, settings.grid);
    return { delta: [gx - x, gy - y], kind: "grid", target: [gx, gy] };
  }
  return { delta: [0, 0], kind: "none" };
}
