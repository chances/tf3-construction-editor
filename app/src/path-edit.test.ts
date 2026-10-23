import { assertEquals } from "jsr:@std/assert@^1";
import {
  type ConstructionDoc,
  newConstruction,
  newEdgeList,
  newLaneList,
  newRunway,
} from "@cedit/schema";
import {
  addEdgeChain,
  canRemoveLaneNode,
  edgeImpact,
  insertLaneNode,
  listImpact,
  nodeImpact,
  removeEdge,
  removeEdgeList,
  removeEdgeNode,
  removeLaneNode,
} from "./path-edit.ts";

/** A 4-node chain 0-1-2-3 with a runway, an edge object, and a tag. */
function chainDoc(): ConstructionDoc {
  const doc = newConstruction("c");
  const list = newEdgeList("edges-1", "STREET", "/s.street_template");
  addEdgeChain(list, [
    { pos: [0, 0, 0], join: null },
    { pos: [10, 0, 0], join: null },
    { pos: [20, 0, 0], join: null },
    { pos: [30, 0, 0], join: null },
  ]);
  list.tag2nodes = { exit: [3, 1] };
  doc.edgeLists = [list];
  const runway = newRunway("LANDING", "edges-1");
  runway.node = 3;
  runway.edges = [1, 2];
  doc.subconstructions[0].runways = [runway];
  doc.edgeObjects = [
    { model: "/a.con", edgeList: "edges-1", edge: 0, param: 1, left: false },
    { model: "/b.con", edgeList: "edges-1", edge: 2, param: 1, left: true },
  ];
  return doc;
}

Deno.test("a drawn chain adds nodes and one edge per step", () => {
  const list = newEdgeList("e", "TRACK", "");
  addEdgeChain(list, [
    { pos: [0, 0, 0], join: null },
    { pos: [5, 0, 1], join: null },
    { pos: [5, 5, 2], join: null },
  ]);
  assertEquals(list.nodes.length, 3);
  assertEquals(list.edges, [[0, 1], [1, 2]]);
});

Deno.test("a point on an existing node joins it and skips a repeated edge", () => {
  const list = newEdgeList("e", "TRACK", "");
  addEdgeChain(list, [{ pos: [0, 0, 0], join: null }, {
    pos: [5, 0, 0],
    join: null,
  }]);
  const last = addEdgeChain(list, [
    { pos: [5, 0, 0], join: 1 },
    { pos: [0, 0, 0], join: 0 },
    { pos: [0, 9, 0], join: null },
  ]);
  assertEquals(list.nodes.length, 3);
  assertEquals(list.edges, [[0, 1], [0, 2]]);
  assertEquals(last, 2);
});

Deno.test("impact counts the runways and objects that use an edge or a node", () => {
  const doc = chainDoc();
  assertEquals(edgeImpact(doc, "edges-1", 0), { runways: 0, edgeObjects: 1 });
  assertEquals(edgeImpact(doc, "edges-1", 2), { runways: 1, edgeObjects: 1 });
  assertEquals(nodeImpact(doc, "edges-1", 3), { runways: 1, edgeObjects: 1 });
  assertEquals(nodeImpact(doc, "edges-1", 0), { runways: 0, edgeObjects: 1 });
  assertEquals(listImpact(doc, "edges-1"), { runways: 1, edgeObjects: 2 });
});

Deno.test("removing an edge drops its objects and shifts later numbers", () => {
  const doc = chainDoc();
  removeEdge(doc, "edges-1", 1);
  assertEquals(doc.edgeLists![0].edges, [[0, 1], [2, 3]]);
  assertEquals(doc.subconstructions[0].runways![0].edges, [1]);
  assertEquals(doc.edgeObjects!.map((o) => o.edge), [0, 1]);
});

Deno.test("a runway left with no edge goes with the last edge", () => {
  const doc = chainDoc();
  removeEdge(doc, "edges-1", 1);
  removeEdge(doc, "edges-1", 1);
  assertEquals(doc.subconstructions[0].runways, undefined);
});

Deno.test("removing a node removes its edges, its runway, and shifts the rest", () => {
  const doc = chainDoc();
  removeEdgeNode(doc, "edges-1", 3);
  const list = doc.edgeLists![0];
  assertEquals(list.nodes.length, 3);
  assertEquals(list.edges, [[0, 1], [1, 2]]);
  assertEquals(list.tag2nodes, { exit: [1] });
  assertEquals(doc.subconstructions[0].runways, undefined);
  assertEquals(doc.edgeObjects!.map((o) => o.edge), [0]);
});

Deno.test("removing a middle node renumbers edges, tags, and runway nodes", () => {
  const doc = chainDoc();
  doc.subconstructions[0].runways![0].node = 3;
  removeEdgeNode(doc, "edges-1", 0);
  const list = doc.edgeLists![0];
  assertEquals(list.edges, [[0, 1], [1, 2]]);
  assertEquals(list.tag2nodes, { exit: [2, 0] });
  assertEquals(doc.subconstructions[0].runways![0].node, 2);
});

Deno.test("removing an edge list removes its runways and objects", () => {
  const doc = chainDoc();
  removeEdgeList(doc, "edges-1");
  assertEquals(doc.edgeLists, undefined);
  assertEquals(doc.subconstructions[0].runways, undefined);
  assertEquals(doc.edgeObjects, undefined);
});

Deno.test("lane nodes: insert halfway, and keep two", () => {
  const lane = newLaneList([[0, 0, 0], [4, 0, 2]]);
  assertEquals(canRemoveLaneNode(lane), false);
  assertEquals(insertLaneNode(lane, 0), 1);
  assertEquals(lane.nodes[1].pos, [2, 0, 1]);
  assertEquals(canRemoveLaneNode(lane), true);
  removeLaneNode(lane, 1);
  removeLaneNode(lane, 0);
  assertEquals(lane.nodes.length, 2);
});
