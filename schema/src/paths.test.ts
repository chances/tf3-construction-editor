import { assert, assertEquals } from "jsr:@std/assert@^1";
import { newConstruction } from "./defaults.ts";
import { lintConstruction } from "./lint.ts";
import { parseConstruction } from "./parse.ts";
import {
  edgeEntries,
  edgeListBases,
  entryIndexOfNode,
  entryTangent,
  globalEdgeIndex,
  globalNodeIndex,
  laneEntries,
  newEdgeList,
  newEdgeListId,
  newLaneList,
  newRunway,
  pointOnEdge,
} from "./paths.ts";
import type { ConstructionDoc, EdgeListDoc } from "./types.ts";

const ctx = { resolveModel: () => true };

/** Two lists: a chain of 3 nodes and a single edge. */
function twoLists(): EdgeListDoc[] {
  const a = newEdgeList("edges-1", "STREET", "/street/a.street_template");
  a.nodes = [{ pos: [0, 0, 0] }, { pos: [10, 0, 0] }, { pos: [10, 10, 0] }];
  a.edges = [[0, 1], [1, 2]];
  const b = newEdgeList("edges-2", "TRACK", "/track/b.track");
  b.nodes = [{ pos: [0, 5, 0] }, { pos: [0, 15, 0] }];
  b.edges = [[0, 1]];
  return [a, b];
}

function docWith(lists: EdgeListDoc[]): ConstructionDoc {
  const doc = newConstruction("c");
  doc.edgeLists = lists;
  return doc;
}

Deno.test("paths: an unset tangent is the straight edge vector", () => {
  assertEquals(
    entryTangent({ pos: [0, 0, 0] }, { pos: [3, 4, 0] }, undefined),
    [
      3,
      4,
      0,
    ],
  );
});

Deno.test("paths: an own tangent keeps its direction and takes the edge length", () => {
  assertEquals(
    entryTangent({ pos: [0, 0, 0] }, { pos: [10, 0, 0] }, [0, 100, 0]),
    [0, 10, 0],
  );
  assertEquals(
    entryTangent({ pos: [0, 0, 0] }, { pos: [10, 0, 0] }, [0, 0, 0]),
    [10, 0, 0],
  );
});

Deno.test("paths: a lane chain of n nodes has two entries per edge", () => {
  const lane = newLaneList([[0, 0, 0], [4, 0, 0], [4, 3, 0]]);
  const entries = laneEntries(lane);
  assertEquals(entries.length, 4);
  assertEquals(entries.map((e) => e.pos), [
    [0, 0, 0],
    [4, 0, 0],
    [4, 0, 0],
    [4, 3, 0],
  ]);
  assertEquals(entries.map((e) => e.width), [3, 3, 3, 3]);
});

Deno.test("paths: a node maps to the first entry that holds it", () => {
  const [a] = twoLists();
  assertEquals(entryIndexOfNode(a, 0), 0);
  assertEquals(entryIndexOfNode(a, 1), 1);
  assertEquals(entryIndexOfNode(a, 2), 3);
  assertEquals(edgeEntries(a).length, 4);
  a.nodes.push({ pos: [50, 50, 0] });
  assertEquals(entryIndexOfNode(a, 3), -1);
});

Deno.test("paths: edge and node numbers count across all edge lists", () => {
  const doc = docWith(twoLists());
  assertEquals([...edgeListBases(doc)], [
    ["edges-1", { edge: 0, entry: 0 }],
    ["edges-2", { edge: 2, entry: 4 }],
  ]);
  assertEquals(globalEdgeIndex(doc, "edges-2", 0), 2);
  assertEquals(globalNodeIndex(doc, "edges-2", 1), 5);
  assertEquals(globalEdgeIndex(doc, "missing", 0), null);
});

Deno.test("paths: pointOnEdge clamps to the edge", () => {
  const a = { pos: [0, 0, 0] as [number, number, number] };
  const b = { pos: [10, 0, 0] as [number, number, number] };
  assertEquals(pointOnEdge(a, b, 5), [5, 0, 0]);
  assertEquals(pointOnEdge(a, b, 99), [10, 0, 0]);
});

Deno.test("paths: a new edge list id skips ids in use", () => {
  assertEquals(newEdgeListId([]), "edges-1");
  assertEquals(newEdgeListId(twoLists()), "edges-3");
});

Deno.test("parse: lanes, edge lists, runways, and edge objects round trip", () => {
  const doc = docWith(twoLists());
  doc.edgeLists![0].nodes[1].tangent = [1, 0, 0];
  doc.edgeLists![0].nodes[1].snap = true;
  doc.edgeLists![0].nodes[2].trafficLight = "AUTO";
  doc.edgeLists![0].tag2nodes = { exit: [2] };
  doc.subconstructions[0].laneLists = [
    newLaneList([[0, 0, 0], [1, 0, 0]]),
  ];
  const runway = newRunway("LANDING", "edges-1");
  runway.node = 0;
  runway.edges = [0];
  doc.subconstructions[0].runways = [runway];
  doc.edgeObjects = [{
    model: "/assets/stations/air/signs/sign_a.con",
    edgeList: "edges-1",
    edge: 0,
    param: 5,
    left: true,
  }];
  assertEquals(parseConstruction(JSON.parse(JSON.stringify(doc))), doc);
});

Deno.test("lint: a healthy path set has no error", () => {
  const doc = docWith(twoLists());
  doc.subconstructions[0].laneLists = [newLaneList([[0, 0, 0], [1, 0, 0]])];
  const runway = newRunway("TAKEOFF", "edges-1");
  runway.node = 0;
  runway.edges = [0];
  doc.subconstructions[0].runways = [runway];
  doc.edgeObjects = [{
    model: "/x.con",
    edgeList: "edges-2",
    edge: 0,
    param: 1,
    left: false,
  }];
  const issues = lintConstruction(doc, {
    ...ctx,
    resolveEdgeObject: () => true,
  });
  assertEquals(issues.filter((i) => i.severity === "error"), []);
  assert(issues.some((i) => i.rule === "unverified-field"));
});

Deno.test("lint: a lane list with one node is an error", () => {
  const doc = newConstruction("c");
  doc.subconstructions[0].laneLists = [newLaneList([[0, 0, 0]])];
  assertEquals(
    lintConstruction(doc, ctx).filter((i) => i.severity === "error").map((i) =>
      i.rule
    ),
    ["lane-list-nodes"],
  );
});

Deno.test("lint: runway indexes out of range or on an unused node are errors", () => {
  const doc = docWith(twoLists());
  doc.edgeLists![0].nodes.push({ pos: [99, 99, 0] });
  const runway = newRunway("LANDING", "edges-1");
  runway.node = 3;
  runway.edges = [0, 7];
  doc.subconstructions[0].runways = [runway];
  const rules = lintConstruction(doc, ctx).filter((i) => i.severity === "error")
    .map((i) => i.rule);
  assertEquals(rules, ["runway-node", "runway-edges"]);
});

Deno.test("lint: a runway needs an existing edge list, and an empty edge list is an error", () => {
  const doc = docWith([newEdgeList("edges-1", "STREET", "")]);
  doc.subconstructions[0].runways = [newRunway("LANDING", "gone")];
  const rules = lintConstruction(doc, ctx).filter((i) => i.severity === "error")
    .map((i) => i.rule);
  assertEquals(rules.sort(), [
    "edge-list-edges",
    "edge-list-type",
    "runway-edge-list",
  ]);
});

Deno.test("lint: two edge objects on one edge warn, an unknown edge errors", () => {
  const doc = docWith(twoLists());
  const object = {
    model: "/x.con",
    edgeList: "edges-1",
    edge: 0,
    param: 1,
    left: false,
  };
  doc.edgeObjects = [object, { ...object, left: true }, { ...object, edge: 9 }];
  const issues = lintConstruction(doc, ctx);
  assertEquals(
    issues.filter((i) => i.rule === "edge-object-per-edge").length,
    1,
  );
  assertEquals(
    issues.filter((i) => i.rule === "edge-index-range").map((i) => i.path),
    ["edgeObjects.2.edge"],
  );
});

Deno.test("lint: an edge object model missing from the index is an error", () => {
  const doc = docWith(twoLists());
  doc.edgeObjects = [{
    model: "/gone.con",
    edgeList: "edges-1",
    edge: 0,
    param: 1,
    left: false,
  }];
  const issues = lintConstruction(doc, {
    ...ctx,
    resolveEdgeObject: () => false,
  });
  assertEquals(
    issues.filter((i) => i.rule === "edge-object-model").length,
    1,
  );
});
