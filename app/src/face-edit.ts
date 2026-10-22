import {
  autoTexCoords,
  counterClockwise,
  type GroundFaceDoc,
  MIN_FACE_POINTS,
  signedArea,
  type Vec2,
} from "@cedit/schema";

/**
 * Makes the face counterclockwise in place. A reversed face also reverses each
 * mode's own texture coordinates. Returns the new index of the point that was
 * at `index`, so a vertex drag keeps hold of the same point.
 */
export function normalizeWinding(face: GroundFaceDoc, index = 0): number {
  if (face.points.length < MIN_FACE_POINTS || signedArea(face.points) >= 0) {
    return index;
  }
  face.points = counterClockwise(face.points).points;
  for (const mode of face.modes) mode.texCoords?.reverse();
  return face.points.length - 1 - index;
}

/** Moves one vertex in x and y. Returns the vertex index after winding. */
export function moveVertex(
  face: GroundFaceDoc,
  index: number,
  x: number,
  y: number,
): number {
  face.points[index] = [x, y];
  return normalizeWinding(face, index);
}

/** Moves every vertex by the same shift in x and y. */
export function translateFace(face: GroundFaceDoc, dx: number, dy: number) {
  face.points = face.points.map((p): Vec2 => [p[0] + dx, p[1] + dy]);
}

/**
 * Inserts a vertex halfway along the edge that starts at `index`. Each mode's
 * own texture coordinates get the matching midpoint. Returns the new index.
 */
export function insertVertex(face: GroundFaceDoc, index: number): number {
  const a = face.points[index];
  // The edge after the last point runs back to the first, so `at` is read
  // before the splice shifts the points.
  const at = (index + 1) % face.points.length;
  const b = face.points[at];
  const mid: Vec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const insertAt = index + 1;
  face.points.splice(insertAt, 0, mid);
  for (const mode of face.modes) {
    if (!mode.texCoords) continue;
    const ua = mode.texCoords[index];
    const ub = mode.texCoords[at];
    mode.texCoords.splice(insertAt, 0, [
      (ua[0] + ub[0]) / 2,
      (ua[1] + ub[1]) / 2,
    ]);
  }
  return insertAt;
}

/** True when a vertex can go without dropping below the minimum. */
export function canRemoveVertex(face: GroundFaceDoc): boolean {
  return face.points.length > MIN_FACE_POINTS;
}

/** Removes one vertex and its texture coordinate entries. */
export function removeVertex(face: GroundFaceDoc, index: number) {
  if (!canRemoveVertex(face)) return;
  face.points.splice(index, 1);
  for (const mode of face.modes) mode.texCoords?.splice(index, 1);
  normalizeWinding(face);
}

/** Turns a mode's own texture coordinates on (a copy of the automatic ones) or off. */
export function setOwnTexCoords(
  face: GroundFaceDoc,
  modeIndex: number,
  own: boolean,
) {
  const mode = face.modes[modeIndex];
  if (own) mode.texCoords = autoTexCoords(face.points);
  else delete mode.texCoords;
}
