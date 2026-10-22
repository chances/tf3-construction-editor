import { assert, assertEquals } from "jsr:@std/assert@^1";
import { type GroundFaceDoc, isCounterClockwise } from "@cedit/schema";
import {
  canRemoveVertex,
  insertVertex,
  moveVertex,
  normalizeWinding,
  removeVertex,
  setOwnTexCoords,
  translateFace,
} from "./face-edit.ts";

function square(): GroundFaceDoc {
  return {
    points: [[0, 0], [4, 0], [4, 4], [0, 4]],
    modes: [{ type: "FILL", key: "a.gtex" }],
  };
}

Deno.test("moving a vertex sets its x and y", () => {
  const face = square();
  assertEquals(moveVertex(face, 1, 5, -1), 1);
  assertEquals(face.points[1], [5, -1]);
});

Deno.test("dragging a vertex across the polygon reverses it and follows the point", () => {
  const face = square();
  face.modes[0].texCoords = [[0, 0], [1, 0], [1, 1], [0, 1]];
  // Drag vertex 2 past vertex 0 so the loop turns clockwise.
  const index = moveVertex(face, 2, -4, -4);
  assert(isCounterClockwise(face.points));
  assertEquals(face.points[index], [-4, -4]);
  assertEquals(face.modes[0].texCoords, [[0, 1], [1, 1], [1, 0], [0, 0]]);
});

Deno.test("a counterclockwise face is left alone by normalizeWinding", () => {
  const face = square();
  assertEquals(normalizeWinding(face, 2), 2);
  assertEquals(face.points[0], [0, 0]);
});

Deno.test("translating a face shifts every vertex by the same x and y", () => {
  const face = square();
  translateFace(face, 2, -3);
  assertEquals(face.points[0], [2, -3]);
  assertEquals(face.points[3], [2, 1]);
});

Deno.test("inserting a vertex splits the edge and its texture coordinates", () => {
  const face = square();
  face.modes[0].texCoords = [[0, 0], [1, 0], [1, 1], [0, 1]];
  assertEquals(insertVertex(face, 0), 1);
  assertEquals(face.points[1], [2, 0]);
  assertEquals(face.points.length, 5);
  assertEquals(face.modes[0].texCoords![1], [0.5, 0]);
});

Deno.test("inserting after the last vertex splits the closing edge", () => {
  const face = square();
  face.modes[0].texCoords = [[0, 0], [1, 0], [1, 1], [0, 1]];
  assertEquals(insertVertex(face, 3), 4);
  assertEquals(face.points[4], [0, 2]);
  assertEquals(face.modes[0].texCoords![4], [0, 0.5]);
});

Deno.test("a vertex cannot be removed below three points", () => {
  const face = square();
  removeVertex(face, 0);
  assertEquals(face.points.length, 3);
  assertEquals(canRemoveVertex(face), false);
  removeVertex(face, 0);
  assertEquals(face.points.length, 3);
});

Deno.test("removing a vertex drops its texture coordinates", () => {
  const face = square();
  face.modes[0].texCoords = [[0, 0], [1, 0], [1, 1], [0, 1]];
  removeVertex(face, 1);
  assertEquals(face.modes[0].texCoords, [[0, 0], [1, 1], [0, 1]]);
});

Deno.test("own texture coordinates start as the automatic ones and can be dropped", () => {
  const face = square();
  setOwnTexCoords(face, 0, true);
  assertEquals(face.modes[0].texCoords, [[0, 0], [1, 0], [1, 1], [0, 1]]);
  setOwnTexCoords(face, 0, false);
  assertEquals(face.modes[0].texCoords, undefined);
  assert(!("texCoords" in face.modes[0]));
});
