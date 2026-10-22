import type { GroundFaceDoc, GroundFaceMode, Vec2 } from "./types.ts";

export const MIN_FACE_POINTS = 3;

/** Shoelace area of the polygon in x and y. Positive means counterclockwise. */
export function signedArea(points: readonly Vec2[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

export function isCounterClockwise(points: readonly Vec2[]): boolean {
  return signedArea(points) > 0;
}

/**
 * Returns a copy of the points counterclockwise. A clockwise polygon is
 * reversed, and `reversed` says so.
 */
export function counterClockwise(
  points: readonly Vec2[],
): { points: Vec2[]; reversed: boolean } {
  if (points.length < MIN_FACE_POINTS || signedArea(points) >= 0) {
    return { points: points.map((p): Vec2 => [p[0], p[1]]), reversed: false };
  }
  return {
    points: points.map((p): Vec2 => [p[0], p[1]]).reverse(),
    reversed: true,
  };
}

/** Normalized 0..1 coordinates over the axis-aligned bounding box in x and y. */
export function autoTexCoords(
  points: readonly Vec2[],
): [number, number][] {
  if (points.length === 0) return [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const w = maxX - minX;
  const h = maxY - minY;
  return points.map(([x, y]) => [
    w === 0 ? 0 : (x - minX) / w,
    h === 0 ? 0 : (y - minY) / h,
  ]);
}

/** The coordinates a mode exports: its own when set and matching, else automatic. */
export function resolvedTexCoords(
  face: Pick<GroundFaceDoc, "points">,
  mode: Pick<GroundFaceMode, "texCoords">,
): [number, number][] {
  return mode.texCoords && mode.texCoords.length === face.points.length
    ? mode.texCoords
    : autoTexCoords(face.points);
}

function cross(o: Vec2, a: Vec2, b: Vec2): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

function segmentsCross(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/** True when two edges that do not share a point cross each other. */
export function selfIntersects(points: readonly Vec2[]): boolean {
  const n = points.length;
  if (n < 4) return false;
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      if (segmentsCross(a, b, points[j], points[(j + 1) % n])) return true;
    }
  }
  return false;
}

/**
 * True when a new edge from `from` to `to` would cross an existing edge of an
 * open polyline, ignoring the edge that ends at `from`.
 */
export function edgeCrossesPolyline(
  polyline: readonly Vec2[],
  from: Vec2,
  to: Vec2,
): boolean {
  for (let i = 0; i + 1 < polyline.length - 1; i++) {
    if (segmentsCross(from, to, polyline[i], polyline[i + 1])) return true;
  }
  return false;
}

/** A new face with one FILL mode. The points are made counterclockwise. */
export function newGroundFace(
  points: readonly Vec2[],
  key = "",
): GroundFaceDoc {
  return {
    points: counterClockwise(points).points,
    modes: [{ type: "FILL", key }],
  };
}

/** Axis-aligned rectangle corners, counterclockwise. */
export function rectanglePoints(a: Vec2, b: Vec2): Vec2[] {
  const x1 = Math.min(a[0], b[0]);
  const x2 = Math.max(a[0], b[0]);
  const y1 = Math.min(a[1], b[1]);
  const y2 = Math.max(a[1], b[1]);
  return [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];
}
