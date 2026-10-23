import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@^1";
import {
  newConstruction,
  newEdgeList,
  newLaneList,
  newRunway,
} from "@cedit/schema";
import { buildResult, buildScriptTl } from "./construction.ts";

function docWithPaths() {
  const doc = newConstruction("strip");
  const a = newEdgeList("edges-1", "STREET", "/street/a.street_template");
  a.nodes = [{ pos: [0, 0, 0], snap: true }, { pos: [10, 0, 0] }, {
    pos: [10, 10, 0],
    free: true,
    trafficLight: "YES",
  }];
  a.edges = [[0, 1], [1, 2]];
  a.tag2nodes = { exit: [2] };
  const b = newEdgeList("edges-2", "TRACK", "/track/b.track");
  b.nodes = [{ pos: [0, 5, 0] }, { pos: [0, 15, 0], tangent: [0, 50, 0] }];
  b.edges = [[0, 1]];
  doc.edgeLists = [a, b];
  const runway = newRunway("LANDING", "edges-2");
  runway.node = 1;
  runway.edges = [0];
  doc.subconstructions[0].runways = [runway];
  doc.subconstructions[0].laneLists = [newLaneList([[0, 0, 0], [4, 0, 0]])];
  doc.edgeObjects = [{
    model: "/assets/stations/air/signs/sign_a.con",
    edgeList: "edges-2",
    edge: 0,
    param: 2.5,
    left: true,
  }];
  return doc;
}

Deno.test("export: edge lists write two entries per edge and entry indices", () => {
  const lists = buildResult(docWithPaths()).edgeLists as Record<
    string,
    unknown
  >[];
  assertEquals(lists[0], {
    type: "STREET",
    params: { type: "/street/a.street_template" },
    edges: [
      [[0, 0, 0], [10, 0, 0]],
      [[10, 0, 0], [10, 0, 0]],
      [[10, 0, 0], [0, 10, 0]],
      [[10, 10, 0], [0, 10, 0]],
    ],
    snapNodes: [0],
    freeNodes: [3],
    trafficLightNodePreference: [[3, "YES"]],
    tag2nodes: { exit: [3] },
    alignTerrain: false,
  });
  assertEquals((lists[1].edges as number[][][])[1], [[0, 15, 0], [0, 10, 0]]);
});

Deno.test("export: a runway and an edge object use construction-wide numbers", () => {
  const result = buildResult(docWithPaths());
  const sub = (result.subconstructions as Record<string, unknown>[])[0];
  assertEquals(sub.runways, [{
    type: "LANDING",
    node: [-1, 5],
    edges: [[-1, 2]],
  }]);
  assertEquals(result.edgeObjects, [{
    edge: 2,
    param: 2.5,
    left: true,
    model: "/assets/stations/air/signs/sign_a.con",
  }]);
});

Deno.test("export: a lane list writes position, tangent, and width", () => {
  const sub = (buildResult(docWithPaths()).subconstructions as Record<
    string,
    unknown
  >[])[0];
  const lane = (sub.laneLists as Record<string, unknown>[])[0];
  assertEquals(lane.nodes, [
    [[0, 0, 0], [4, 0, 0], 3],
    [[4, 0, 0], [4, 0, 0], 3],
  ]);
  assertEquals(lane.transportModes, ["PERSON"]);
  assertEquals(lane.speedLimit, 3);
  assertEquals(lane.linkable, true);
});

Deno.test("export: a construction without paths writes none of the keys", () => {
  const text = buildScriptTl(newConstruction("a"));
  for (const key of ["edgeLists", "edgeObjects", "laneLists", "runways"]) {
    assert(!text.includes(key), key);
  }
});

Deno.test("export: the Teal script holds the path tables", () => {
  const text = buildScriptTl(docWithPaths());
  for (const key of ["edgeLists", "edgeObjects", "laneLists", "runways"]) {
    assertStringIncludes(text, key);
  }
});
