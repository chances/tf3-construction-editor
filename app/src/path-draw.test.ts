import { assertEquals } from "jsr:@std/assert@^1";
import { newEdgeList, newLaneList } from "@cedit/schema";
import {
  arrowPoints,
  edgeTangentDir,
  laneTangentDir,
  leftNormal,
  modeGroup,
} from "./path-draw.ts";

Deno.test("a lane takes the color family of its first transport mode", () => {
  assertEquals(modeGroup(["PERSON"]), "person");
  assertEquals(modeGroup(["TRAIN", "ELECTRIC_TRAIN"]), "rail");
  assertEquals(modeGroup(["SMALL_AIRCRAFT"]), "air");
  assertEquals(modeGroup(["SHIP"]), "water");
  assertEquals(modeGroup(["BUS"]), "road");
  assertEquals(modeGroup([]), "person");
});

Deno.test("a lane node shows its own tangent, else the next edge direction", () => {
  const lane = newLaneList([[0, 0, 0], [0, 5, 0], [5, 5, 0]]);
  assertEquals(laneTangentDir(lane, 0), [0, 1]);
  assertEquals(laneTangentDir(lane, 2), [1, 0]);
  lane.nodes[0].tangent = [3, 0, 0];
  assertEquals(laneTangentDir(lane, 0), [1, 0]);
});

Deno.test("an edge node shows the travel direction of its first edge", () => {
  const list = newEdgeList("e", "STREET", "");
  list.nodes = [{ pos: [0, 0, 0] }, { pos: [4, 0, 0] }];
  list.edges = [[0, 1]];
  assertEquals(edgeTangentDir(list, 0), [1, 0]);
  assertEquals(edgeTangentDir(list, 1), [1, 0]);
  list.nodes.push({ pos: [9, 9, 0] });
  assertEquals(edgeTangentDir(list, 2), null);
});

Deno.test("an arrow sits at the middle of the edge and points along it", () => {
  const points = arrowPoints([0, 0], [10, 0], 1)!.split(" ");
  assertEquals(points[0], "6,0");
  assertEquals(arrowPoints([2, 2], [2, 2], 1), null);
});

Deno.test("the left side is counterclockwise of the travel direction", () => {
  assertEquals(leftNormal([0, 0], [5, 0]), [-0, 1]);
});
