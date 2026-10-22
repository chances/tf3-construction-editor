import { assert, assertEquals } from "jsr:@std/assert@^1";
import {
  autoTexCoords,
  counterClockwise,
  edgeCrossesPolyline,
  isCounterClockwise,
  newGroundFace,
  rectanglePoints,
  resolvedTexCoords,
  selfIntersects,
  signedArea,
} from "./ground-face.ts";
import { lintGroundFace } from "./lint.ts";
import { parseConstruction } from "./parse.ts";
import { newConstruction } from "./defaults.ts";
import type { Vec2 } from "./types.ts";

const square: Vec2[] = [[0, 0], [4, 0], [4, 2], [0, 2]];

Deno.test("signed area is positive for counterclockwise points", () => {
  assertEquals(signedArea(square), 8);
  assert(isCounterClockwise(square));
  assertEquals(signedArea([...square].reverse()), -8);
});

Deno.test("a clockwise face is reversed and a counterclockwise one is kept", () => {
  const clockwise = [...square].reverse();
  const fixed = counterClockwise(clockwise);
  assert(fixed.reversed);
  assertEquals(fixed.points, square);
  const kept = counterClockwise(square);
  assertEquals(kept.reversed, false);
  assertEquals(kept.points, square);
});

Deno.test("texture coordinates normalize over the bounding box", () => {
  assertEquals(autoTexCoords(square), [[0, 0], [1, 0], [1, 1], [0, 1]]);
  assertEquals(autoTexCoords([[2, 2], [2, 2], [2, 2]]), [
    [0, 0],
    [0, 0],
    [0, 0],
  ]);
});

Deno.test("a mode's own coordinates win only when the count matches", () => {
  const face = { points: square };
  const own: [number, number][] = [[0, 0], [2, 0], [2, 2], [0, 2]];
  assertEquals(resolvedTexCoords(face, { texCoords: own }), own);
  assertEquals(
    resolvedTexCoords(face, { texCoords: [[0, 0]] }),
    autoTexCoords(square),
  );
  assertEquals(resolvedTexCoords(face, {}), autoTexCoords(square));
});

Deno.test("a bow-tie polygon self-intersects and a square does not", () => {
  assertEquals(selfIntersects(square), false);
  assert(selfIntersects([[0, 0], [2, 2], [2, 0], [0, 2]]));
  assertEquals(selfIntersects([[0, 0], [1, 0], [0, 1]]), false);
});

Deno.test("a new edge that crosses the open outline is detected", () => {
  const open: Vec2[] = [[0, 0], [4, 0], [4, 4]];
  assert(edgeCrossesPolyline(open, [4, 4], [2, -2]));
  assertEquals(edgeCrossesPolyline(open, [4, 4], [0, 4]), false);
});

Deno.test("rectangle points are counterclockwise in any drag direction", () => {
  const rect = rectanglePoints([4, 2], [0, 0]);
  assertEquals(rect, [[0, 0], [4, 0], [4, 2], [0, 2]]);
  assert(isCounterClockwise(rect));
});

Deno.test("a new face reverses clockwise points and starts with one FILL mode", () => {
  const face = newGroundFace([...square].reverse());
  assertEquals(face.points, square);
  assertEquals(face.modes, [{ type: "FILL", key: "" }]);
});

Deno.test("lint: an empty key is an error and a bow-tie is a warning", () => {
  // A symmetric bow-tie has zero area, so it is also not counterclockwise.
  const issues = lintGroundFace(
    newGroundFace([[0, 0], [2, 2], [2, 0], [0, 2]]),
    "f",
  );
  assertEquals(
    issues.map((i) => [i.rule, i.severity]).sort(),
    [
      ["ground-face-key", "error"],
      ["ground-face-self-intersects", "warning"],
      ["ground-face-winding", "error"],
    ],
  );
});

Deno.test("lint: too few points, clockwise winding, and bad coordinate counts", () => {
  const two = lintGroundFace(
    {
      points: [[0, 0], [1, 0]],
      modes: [{ type: "FILL", key: "a.gtex" }],
    },
    "f",
  );
  assertEquals(two.map((i) => i.rule), ["ground-face-points"]);
  const cw = lintGroundFace({
    points: [...square].reverse(),
    modes: [{ type: "FILL", key: "a.gtex", texCoords: [[0, 0]] }],
  }, "f");
  assertEquals(
    cw.map((i) => i.rule).sort(),
    ["ground-face-tex-coords", "ground-face-winding"],
  );
});

Deno.test("lint: alignment fields and loop are an unverified warning", () => {
  const issues = lintGroundFace({
    points: square,
    modes: [{ type: "FILL", key: "a.gtex" }],
    loop: false,
  }, "f");
  assertEquals(issues.map((i) => i.rule), ["unverified-field"]);
});

Deno.test("a stored face round trips through the parser", () => {
  const doc = newConstruction("a");
  doc.subconstructions[0].groundFaces = [{
    label: "Apron",
    points: square,
    modes: [
      { type: "FILL", key: "/a/b.gtex" },
      {
        type: "STROKE_OUTER",
        key: "/a/c.gtex",
        texCoords: autoTexCoords(square),
      },
    ],
    loop: false,
    alignmentOffsetMode: "WORLD",
    alignmentOffset: [1, 2],
    alignmentDirMode: "OBJECT",
    alignmentDir: [0, 1],
  }];
  assertEquals(parseConstruction(JSON.parse(JSON.stringify(doc))), doc);
});
