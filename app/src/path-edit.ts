import {
  type ConstructionDoc,
  type EdgeListDoc,
  findEdgeList,
  type LaneListDoc,
  MIN_LANE_NODES,
  type RunwayDoc,
  type Vec3,
} from "@cedit/schema";

/** A clicked point of a path being drawn. `join` names an existing node to reuse. */
export interface DraftPoint {
  pos: Vec3;
  join: number | null;
}

function hasEdge(list: EdgeListDoc, a: number, b: number): boolean {
  return list.edges.some(([x, y]) =>
    (x === a && y === b) || (x === b && y === a)
  );
}

/**
 * Adds a drawn chain to an edge list. A point with a `join` reuses that node,
 * any other point adds a node. Consecutive points become edges, and an edge
 * that already exists is not added twice. Returns the index of the last node.
 */
export function addEdgeChain(
  list: EdgeListDoc,
  points: readonly DraftPoint[],
): number | null {
  let prev: number | null = null;
  for (const point of points) {
    let index = point.join !== null && list.nodes[point.join] ? point.join : -1;
    if (index < 0) {
      list.nodes.push({ pos: [...point.pos] });
      index = list.nodes.length - 1;
    }
    if (prev !== null && prev !== index && !hasEdge(list, prev, index)) {
      list.edges.push([prev, index]);
    }
    prev = index;
  }
  return prev;
}

/** Every runway of every layer, with its place. */
export function allRunways(
  doc: ConstructionDoc,
): { sub: number; index: number; runway: RunwayDoc }[] {
  return doc.subconstructions.flatMap((layer, sub) =>
    (layer.runways ?? []).map((runway, index) => ({ sub, index, runway }))
  );
}

function dropEmptyRunways(doc: ConstructionDoc) {
  for (const layer of doc.subconstructions) {
    if (layer.runways?.length === 0) delete layer.runways;
  }
}

/** Indices of the edges that end at `node`. */
export function incidentEdges(list: EdgeListDoc, node: number): number[] {
  return list.edges.flatMap(([a, b], i) => a === node || b === node ? [i] : []);
}

/** What a removal takes with it, for the confirmation dialog. */
export interface Impact {
  runways: number;
  edgeObjects: number;
}

export const noImpact = (impact: Impact) =>
  impact.runways === 0 && impact.edgeObjects === 0;

/** Runways and edge objects that use any of the given edges or nodes. */
export function pathImpact(
  doc: ConstructionDoc,
  listId: string,
  edges: readonly number[],
  nodes: readonly number[] = [],
): Impact {
  return {
    runways:
      allRunways(doc).filter(({ runway }) =>
        runway.edgeList === listId &&
        ((runway.node !== undefined && nodes.includes(runway.node)) ||
          runway.edges.some((e) => edges.includes(e)))
      ).length,
    edgeObjects:
      (doc.edgeObjects ?? []).filter((o) =>
        o.edgeList === listId && edges.includes(o.edge)
      ).length,
  };
}

export function edgeImpact(
  doc: ConstructionDoc,
  listId: string,
  edge: number,
): Impact {
  return pathImpact(doc, listId, [edge]);
}

export function nodeImpact(
  doc: ConstructionDoc,
  listId: string,
  node: number,
): Impact {
  const list = findEdgeList(doc, listId);
  return pathImpact(
    doc,
    listId,
    list ? incidentEdges(list, node) : [],
    [node],
  );
}

export function listImpact(doc: ConstructionDoc, listId: string): Impact {
  return {
    runways: allRunways(doc).filter(({ runway }) => runway.edgeList === listId)
      .length,
    edgeObjects: (doc.edgeObjects ?? []).filter((o) => o.edgeList === listId)
      .length,
  };
}

/**
 * Removes one edge and what uses it: edge objects on it, and its place in a
 * runway (a runway left with no edge goes too). Later edge numbers shift down.
 */
export function removeEdge(doc: ConstructionDoc, listId: string, edge: number) {
  const list = findEdgeList(doc, listId);
  if (!list || !list.edges[edge]) return;
  list.edges.splice(edge, 1);
  for (const layer of doc.subconstructions) {
    layer.runways = layer.runways?.filter((runway) => {
      if (runway.edgeList !== listId) return true;
      runway.edges = runway.edges.filter((e) => e !== edge).map((e) =>
        e > edge ? e - 1 : e
      );
      return runway.edges.length > 0;
    });
  }
  dropEmptyRunways(doc);
  if (doc.edgeObjects) {
    doc.edgeObjects = doc.edgeObjects.filter((o) =>
      o.edgeList !== listId || o.edge !== edge
    ).map((o) =>
      o.edgeList === listId && o.edge > edge ? { ...o, edge: o.edge - 1 } : o
    );
    if (doc.edgeObjects.length === 0) delete doc.edgeObjects;
  }
}

/**
 * Removes one node with its edges and everything that uses them. A runway on
 * the node goes. Later node numbers shift down in edges, tags, and runways.
 */
export function removeEdgeNode(
  doc: ConstructionDoc,
  listId: string,
  node: number,
) {
  const list = findEdgeList(doc, listId);
  if (!list || !list.nodes[node]) return;
  for (const edge of incidentEdges(list, node).reverse()) {
    removeEdge(doc, listId, edge);
  }
  for (const layer of doc.subconstructions) {
    layer.runways = layer.runways?.filter((r) =>
      r.edgeList !== listId || r.node !== node
    );
    for (const runway of layer.runways ?? []) {
      if (
        runway.edgeList === listId && runway.node !== undefined &&
        runway.node > node
      ) {
        runway.node -= 1;
      }
    }
  }
  dropEmptyRunways(doc);
  list.nodes.splice(node, 1);
  list.edges = list.edges.map(([a, b]) => [
    a > node ? a - 1 : a,
    b > node ? b - 1 : b,
  ]);
  if (list.tag2nodes) {
    for (const [tag, nodes] of Object.entries(list.tag2nodes)) {
      const kept = nodes.filter((n) => n !== node).map((n) =>
        n > node ? n - 1 : n
      );
      if (kept.length > 0) list.tag2nodes[tag] = kept;
      else delete list.tag2nodes[tag];
    }
    if (Object.keys(list.tag2nodes).length === 0) delete list.tag2nodes;
  }
}

/** Removes an edge list, the runways on it, and the edge objects on it. */
export function removeEdgeList(doc: ConstructionDoc, listId: string) {
  doc.edgeLists = doc.edgeLists?.filter((l) => l.id !== listId);
  if (doc.edgeLists?.length === 0) delete doc.edgeLists;
  for (const layer of doc.subconstructions) {
    layer.runways = layer.runways?.filter((r) => r.edgeList !== listId);
  }
  dropEmptyRunways(doc);
  if (doc.edgeObjects) {
    doc.edgeObjects = doc.edgeObjects.filter((o) => o.edgeList !== listId);
    if (doc.edgeObjects.length === 0) delete doc.edgeObjects;
  }
}

/** Moves a node, keeping its z. */
export function moveEdgeNode(
  list: EdgeListDoc,
  node: number,
  x: number,
  y: number,
) {
  const target = list.nodes[node];
  if (target) target.pos = [x, y, target.pos[2]];
}

export function canRemoveLaneNode(lane: LaneListDoc): boolean {
  return lane.nodes.length > MIN_LANE_NODES;
}

/** Inserts a node halfway along the edge that starts at `index`. */
export function insertLaneNode(lane: LaneListDoc, index: number): number {
  const a = lane.nodes[index];
  const b = lane.nodes[index + 1] ?? a;
  lane.nodes.splice(index + 1, 0, {
    pos: [
      (a.pos[0] + b.pos[0]) / 2,
      (a.pos[1] + b.pos[1]) / 2,
      (a.pos[2] + b.pos[2]) / 2,
    ],
    width: (a.width + b.width) / 2,
  });
  return index + 1;
}

export function removeLaneNode(lane: LaneListDoc, index: number) {
  if (canRemoveLaneNode(lane)) lane.nodes.splice(index, 1);
}
