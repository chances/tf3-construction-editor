import {
  type ConstructionDoc,
  edgeEntries,
  type EdgeListDoc,
  entryIndexOfNode,
  globalEdgeIndex,
  globalNodeIndex,
  laneEntries,
  type LaneListDoc,
  resolvedTexCoords,
  type RunwayDoc,
} from "@cedit/schema";
import { toLua } from "./lua.ts";

const vec = (v: readonly number[]) => [v[0], v[1], v[2]];

function laneListTable(lane: LaneListDoc) {
  return {
    transf: lane.transf,
    transportModes: lane.transportModes,
    speedLimit: lane.speedLimit,
    nodes: laneEntries(lane).map((e) => [vec(e.pos), vec(e.tangent), e.width]),
    linkable: lane.linkable,
    pedestrianWalkPenalty: lane.pedestrianWalkPenalty,
    forwardOnly: lane.forwardOnly,
    needsReservation: lane.needsReservation,
  };
}

/**
 * One edge list. A node index becomes the index of the first entry that holds
 * the node, and a node that no edge uses has no entry and is left out.
 */
function edgeListTable(list: EdgeListDoc) {
  const entryOf = (node: number) => entryIndexOfNode(list, node);
  const nodesWhere = (keep: (n: EdgeListDoc["nodes"][number]) => boolean) =>
    list.nodes.flatMap((n, i) =>
      keep(n) && entryOf(i) >= 0 ? [entryOf(i)] : []
    );
  const lights = list.nodes.flatMap((n, i) =>
    n.trafficLight && entryOf(i) >= 0 ? [[entryOf(i), n.trafficLight]] : []
  );
  const tags = Object.entries(list.tag2nodes ?? {}).filter(([, nodes]) =>
    nodes.length > 0
  );
  const free = nodesWhere((n) => n.free === true);
  return {
    type: list.type,
    params: { type: list.typeName },
    edges: edgeEntries(list).map((e) => [vec(e.pos), vec(e.tangent)]),
    snapNodes: nodesWhere((n) => n.snap === true),
    freeNodes: free.length > 0 ? free : undefined,
    trafficLightNodePreference: lights.length > 0 ? lights : undefined,
    tag2nodes: tags.length > 0
      ? Object.fromEntries(tags.map(([tag, nodes]) => [
        tag,
        nodes.map(entryOf).filter((e) => e >= 0),
      ]))
      : undefined,
    alignTerrain: list.alignTerrain,
  };
}

function runwayTable(doc: ConstructionDoc, runway: RunwayDoc) {
  const node = runway.node === undefined
    ? null
    : globalNodeIndex(doc, runway.edgeList, runway.node);
  const edges = runway.edges.map((e) =>
    globalEdgeIndex(doc, runway.edgeList, e)
  );
  if (node === null || edges.includes(null)) return undefined;
  // The first value -1 means the n-th node or edge of the edge lists.
  return {
    type: runway.kind,
    node: [-1, node],
    edges: edges.map((e) => [-1, e]),
  };
}

/** The table returned by `updateFn`. */
export function buildResult(doc: ConstructionDoc): Record<string, unknown> {
  const edgeObjects = (doc.edgeObjects ?? []).flatMap((o) => {
    const edge = globalEdgeIndex(doc, o.edgeList, o.edge);
    return edge === null
      ? []
      : [{ edge, param: o.param, left: o.left, model: o.model }];
  });
  return {
    edgeLists: doc.edgeLists?.length
      ? doc.edgeLists.map(edgeListTable)
      : undefined,
    edgeObjects: edgeObjects.length > 0 ? edgeObjects : undefined,
    subconstructions: doc.subconstructions.map((sub) => ({
      laneLists: sub.laneLists?.length
        ? sub.laneLists.map(laneListTable)
        : undefined,
      runways: sub.runways?.length
        ? sub.runways.map((r) => runwayTable(doc, r)).filter((r) =>
          r !== undefined
        )
        : undefined,
      models: sub.models.map((m) => ({
        id: m.id,
        transf: m.transf,
        tag: m.tag,
      })),
      groundFaces: sub.groundFaces?.length
        ? sub.groundFaces.map((face) => ({
          // The game ignores a face's Z, so every point is written at 0.
          face: face.points.map(([x, y]) => [x, y, 0]),
          modes: face.modes.map((mode) => ({
            type: mode.type,
            key: mode.key,
            texCoords: resolvedTexCoords(face, mode),
          })),
          loop: face.loop,
          alignmentOffsetMode: face.alignmentOffsetMode,
          alignmentOffset: face.alignmentOffset,
          alignmentDirMode: face.alignmentDirMode,
          alignmentDir: face.alignmentDir,
        }))
        : undefined,
      tag: sub.tag,
    })),
    cost: doc.costs.cost,
    maintenanceCost: doc.costs.maintenanceCost,
    bulldozeCost: doc.costs.bulldozeCost,
    noCostAtAll: doc.costs.noCostAtAll,
    snapPoint: doc.snapPoint,
    metadata: Object.keys(doc.metadata).length > 0 ? doc.metadata : undefined,
  };
}

/** `<id>.con.lua`: the data-only construction entry file. */
export function buildConLua(doc: ConstructionDoc): string {
  const table = {
    description: {
      name: doc.description.name,
      description: doc.description.description,
      icon: doc.description.icon,
      previewIcon: doc.description.previewIcon,
    },
    availability: {
      yearFrom: doc.availability.yearFrom,
      yearTo: doc.availability.yearTo,
    },
    menuCategory: {
      categories: [{
        category: doc.menuCategory.category,
        order: doc.menuCategory.order,
      }],
    },
    order: doc.menuCategory.order,
    params: [],
    updateScript: {
      fileName: `${doc.id}.script@updateFn`,
      params: {},
    },
  };
  return `function data()\n\nreturn ${toLua(table)}\n\nend\n`;
}

/** `<id>.script.tl`: the update script whose `updateFn` returns the data. */
export function buildScriptTl(doc: ConstructionDoc): string {
  const body = toLua(buildResult(doc), 1);
  return [
    "local data = {}",
    "",
    "function data.updateFn(_captureParams : table, _params : table) : ConstructionUtilSerialized.ConstructionResult",
    `\treturn ${body}`,
    "end",
    "",
    "return data",
    "",
  ].join("\n");
}
