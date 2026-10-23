import type {
  EdgeListDoc,
  LaneListDoc,
  TransportMode,
  Vec2,
} from "@cedit/schema";

/** How the canvas colors a lane: by the family of its first transport mode. */
export type ModeGroup = "person" | "road" | "rail" | "air" | "water";

const GROUPS: Record<TransportMode, ModeGroup> = {
  PERSON: "person",
  CARGO: "person",
  CAR: "road",
  BUS: "road",
  TRUCK: "road",
  TRAM: "road",
  ELECTRIC_TRAM: "road",
  TRAM_TRACK: "road",
  ELECTRIC_TRAM_TRACK: "road",
  TRAIN: "rail",
  ELECTRIC_TRAIN: "rail",
  AIRCRAFT: "air",
  SMALL_AIRCRAFT: "air",
  HELICOPTER: "air",
  SHIP: "water",
  SMALL_SHIP: "water",
};

export function modeGroup(modes: readonly TransportMode[]): ModeGroup {
  return modes.length === 0 ? "person" : GROUPS[modes[0]];
}

function unit(x: number, y: number): Vec2 | null {
  const length = Math.hypot(x, y);
  return length < 1e-9 ? null : [x / length, y / length];
}

/**
 * The direction a lane node's tangent shows on the canvas: its own override,
 * else the direction toward the next node (toward the last for the last node).
 */
export function laneTangentDir(lane: LaneListDoc, node: number): Vec2 | null {
  const own = lane.nodes[node]?.tangent;
  if (own && unit(own[0], own[1])) return unit(own[0], own[1]);
  const here = lane.nodes[node];
  const next = lane.nodes[node + 1] ?? here;
  const prev = lane.nodes[node - 1] ?? here;
  const a = node + 1 < lane.nodes.length ? here : prev;
  const b = node + 1 < lane.nodes.length ? next : here;
  if (!a || !b) return null;
  return unit(b.pos[0] - a.pos[0], b.pos[1] - a.pos[1]);
}

/**
 * The direction an edge list node's tangent shows on the canvas: its own
 * override, else the travel direction of the first edge that holds it.
 */
export function edgeTangentDir(list: EdgeListDoc, node: number): Vec2 | null {
  const own = list.nodes[node]?.tangent;
  if (own && unit(own[0], own[1])) return unit(own[0], own[1]);
  const edge = list.edges.find(([a, b]) => a === node || b === node);
  if (!edge) return null;
  const a = list.nodes[edge[0]];
  const b = list.nodes[edge[1]];
  return a && b ? unit(b.pos[0] - a.pos[0], b.pos[1] - a.pos[1]) : null;
}

/**
 * SVG `points` of a small triangle at the middle of the edge from `a` to `b`,
 * pointing from `a` toward `b`. Canvas y runs down, so y is negated. Null for
 * an edge with no length.
 */
export function arrowPoints(a: Vec2, b: Vec2, size: number): string | null {
  const dir = unit(b[0] - a[0], b[1] - a[1]);
  if (!dir) return null;
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const tip: Vec2 = [mx + dir[0] * size, my + dir[1] * size];
  const left: Vec2 = [
    mx - dir[0] * size * 0.6 - dir[1] * size * 0.7,
    my - dir[1] * size * 0.6 + dir[0] * size * 0.7,
  ];
  const right: Vec2 = [
    mx - dir[0] * size * 0.6 + dir[1] * size * 0.7,
    my - dir[1] * size * 0.6 - dir[0] * size * 0.7,
  ];
  return [tip, left, right].map(([x, y]) => `${x},${-y}`).join(" ");
}

/** Left of the travel direction from `a` to `b` is the counterclockwise side. */
export function leftNormal(a: Vec2, b: Vec2): Vec2 {
  const dir = unit(b[0] - a[0], b[1] - a[1]);
  return dir ? [-dir[1], dir[0]] : [0, 0];
}
