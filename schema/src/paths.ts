import type {
  ConstructionDoc,
  EdgeListDoc,
  EdgeListType,
  EdgeNodeDoc,
  LaneListDoc,
  LaneNodeDoc,
  RunwayDoc,
  RunwayKind,
  Vec3,
} from "./types.ts";

export const DEFAULT_LANE_WIDTH = 3;

/** Wiki defaults for a new lane list. */
export const LANE_DEFAULTS = {
  transportModes: ["PERSON"] as LaneListDoc["transportModes"],
  speedLimit: 3,
  linkable: true,
  forwardOnly: false,
  needsReservation: false,
  pedestrianWalkPenalty: 1,
};

export const MIN_LANE_NODES = 2;

/** A new lane list over `points`. */
export function newLaneList(points: readonly Vec3[]): LaneListDoc {
  return {
    ...LANE_DEFAULTS,
    transportModes: [...LANE_DEFAULTS.transportModes],
    nodes: points.map((pos): LaneNodeDoc => ({
      pos: [...pos],
      width: DEFAULT_LANE_WIDTH,
    })),
  };
}

/** An id like `edges-2` that no list in `lists` has. */
export function newEdgeListId(lists: readonly EdgeListDoc[] = []): string {
  const taken = new Set(lists.map((l) => l.id));
  for (let n = lists.length + 1;; n++) {
    if (!taken.has(`edges-${n}`)) return `edges-${n}`;
  }
}

export function newEdgeList(
  id: string,
  type: EdgeListType,
  typeName = "",
): EdgeListDoc {
  return { id, type, typeName, alignTerrain: false, nodes: [], edges: [] };
}

export function newRunway(kind: RunwayKind, edgeList: string): RunwayDoc {
  return { kind, edgeList, edges: [] };
}

export function findEdgeList(
  doc: Pick<ConstructionDoc, "edgeLists">,
  id: string,
): EdgeListDoc | undefined {
  return doc.edgeLists?.find((l) => l.id === id);
}

export function vecSub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function vecLength(v: Vec3): number {
  return Math.hypot(v[0], v[1], v[2]);
}

/** Straight-line length of the edge between two nodes. */
export function edgeLength(a: { pos: Vec3 }, b: { pos: Vec3 }): number {
  return vecLength(vecSub(b.pos, a.pos));
}

/** A point `param` meters from `a` toward `b`, clamped to the edge. */
export function pointOnEdge(
  a: { pos: Vec3 },
  b: { pos: Vec3 },
  param: number,
): Vec3 {
  const length = edgeLength(a, b);
  const t = length === 0 ? 0 : Math.min(Math.max(param / length, 0), 1);
  return [
    a.pos[0] + (b.pos[0] - a.pos[0]) * t,
    a.pos[1] + (b.pos[1] - a.pos[1]) * t,
    a.pos[2] + (b.pos[2] - a.pos[2]) * t,
  ];
}

/**
 * The tangent that export writes at one end of an edge: the straight edge
 * vector, or the node's own tangent direction scaled to the edge length. The
 * wiki says a tangent's length must equal the edge length.
 */
export function entryTangent(
  a: { pos: Vec3 },
  b: { pos: Vec3 },
  own: Vec3 | undefined,
): Vec3 {
  const straight = vecSub(b.pos, a.pos);
  if (!own) return straight;
  const ownLength = vecLength(own);
  if (ownLength === 0) return straight;
  const length = vecLength(straight);
  return own.map((c) => (c / ownLength) * length) as Vec3;
}

/** One exported entry: position, tangent, and for lanes the width. */
export interface PathEntry {
  pos: Vec3;
  tangent: Vec3;
  width?: number;
}

/** Two entries per edge of a lane chain. */
export function laneEntries(lane: LaneListDoc): PathEntry[] {
  const out: PathEntry[] = [];
  for (let i = 0; i + 1 < lane.nodes.length; i++) {
    const a = lane.nodes[i];
    const b = lane.nodes[i + 1];
    out.push(
      { pos: a.pos, tangent: entryTangent(a, b, a.tangent), width: a.width },
      { pos: b.pos, tangent: entryTangent(a, b, b.tangent), width: b.width },
    );
  }
  return out;
}

/** Two entries per edge of an edge list. */
export function edgeEntries(list: EdgeListDoc): PathEntry[] {
  const out: PathEntry[] = [];
  for (const [ia, ib] of list.edges) {
    const a: EdgeNodeDoc | undefined = list.nodes[ia];
    const b: EdgeNodeDoc | undefined = list.nodes[ib];
    if (!a || !b) continue;
    out.push(
      { pos: a.pos, tangent: entryTangent(a, b, a.tangent) },
      { pos: b.pos, tangent: entryTangent(a, b, b.tangent) },
    );
  }
  return out;
}

/** Index of the first entry that holds `node`, or -1 when no edge uses it. */
export function entryIndexOfNode(list: EdgeListDoc, node: number): number {
  for (let k = 0; k < list.edges.length; k++) {
    if (list.edges[k][0] === node) return k * 2;
    if (list.edges[k][1] === node) return k * 2 + 1;
  }
  return -1;
}

/** Where each edge list starts in the construction-wide edge and entry counts. */
export function edgeListBases(
  doc: Pick<ConstructionDoc, "edgeLists">,
): Map<string, { edge: number; entry: number }> {
  const bases = new Map<string, { edge: number; entry: number }>();
  let edge = 0;
  for (const list of doc.edgeLists ?? []) {
    bases.set(list.id, { edge, entry: edge * 2 });
    edge += list.edges.length;
  }
  return bases;
}

/** The construction-wide edge number of an edge, or null when the list is unknown. */
export function globalEdgeIndex(
  doc: Pick<ConstructionDoc, "edgeLists">,
  listId: string,
  edge: number,
): number | null {
  const base = edgeListBases(doc).get(listId);
  return base ? base.edge + edge : null;
}

/** The construction-wide node (entry) number, or null when it cannot be found. */
export function globalNodeIndex(
  doc: Pick<ConstructionDoc, "edgeLists">,
  listId: string,
  node: number,
): number | null {
  const base = edgeListBases(doc).get(listId);
  const list = findEdgeList(doc, listId);
  if (!base || !list) return null;
  const entry = entryIndexOfNode(list, node);
  return entry < 0 ? null : base.entry + entry;
}
