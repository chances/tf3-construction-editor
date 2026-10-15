import { assertAlmostEquals, assertEquals } from "jsr:@std/assert@^1";
import {
  nearestOnSegment,
  snapAngle,
  snapMove,
  type SnapSettings,
  snapToGrid,
} from "./snapping.ts";

const all: SnapSettings = { grid: 1, vertex: true, edge: true, angle: 15 };

Deno.test("snap: grid rounds to the step", () => {
  assertEquals(snapToGrid(2.4, 1), 2);
  assertAlmostEquals(snapToGrid(0.26, 0.5), 0.5);
  assertAlmostEquals(snapToGrid(0.14, 0.1), 0.1);
});

Deno.test("snap: angle steps", () => {
  assertAlmostEquals(snapAngle((47 * Math.PI) / 180, 45), Math.PI / 4);
  assertEquals(snapAngle(1.234, null), 1.234);
});

Deno.test("snap: a vertex wins over an edge and the grid", () => {
  const result = snapMove(
    [[4.9, 0.2]],
    [[5, 0]],
    [[[0, 0], [10, 0]]],
    all,
    0.5,
  );
  assertEquals(result.kind, "vertex");
  assertAlmostEquals(result.delta[0], 0.1);
  assertAlmostEquals(result.delta[1], -0.2);
});

Deno.test("snap: an edge wins over the grid", () => {
  const result = snapMove([[3.3, 0.2]], [], [[[0, 0], [10, 0]]], all, 0.5);
  assertEquals(result.kind, "edge");
  assertAlmostEquals(result.delta[0], 0, 1e-9);
  assertAlmostEquals(result.delta[1], -0.2, 1e-9);
});

Deno.test("snap: the grid applies when nothing is in range", () => {
  const result = snapMove([[3.4, 7.6]], [[50, 50]], [], all, 0.5);
  assertEquals(result.kind, "grid");
  assertAlmostEquals(result.delta[0], -0.4);
  assertAlmostEquals(result.delta[1], 0.4);
});

Deno.test("snap: everything off leaves the move alone", () => {
  const off: SnapSettings = {
    grid: null,
    vertex: false,
    edge: false,
    angle: null,
  };
  assertEquals(snapMove([[1.23, 4.56]], [[1, 4]], [], off, 5).kind, "none");
});

Deno.test("snap: nearest point clamps to the segment", () => {
  assertEquals(nearestOnSegment([-3, 2], [[0, 0], [10, 0]]), [0, 0]);
  assertEquals(nearestOnSegment([4, 9], [[0, 0], [10, 0]]), [4, 0]);
});
