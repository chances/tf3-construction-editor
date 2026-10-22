import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@^1";
import { newConstruction } from "@cedit/schema";
import { buildResult, buildScriptTl } from "./construction.ts";

function docWithFace() {
  const doc = newConstruction("pad");
  doc.subconstructions[0].groundFaces = [{
    points: [[0, 0], [4, 0], [4, 2], [0, 2]],
    modes: [{
      type: "FILL",
      key: "/terrain/materials/asphalt_02/asphalt_02.gtex",
    }],
    loop: false,
  }];
  return doc;
}

Deno.test("export: a face gets its points, mode, and automatic coordinates", () => {
  const sub = buildResult(docWithFace()).subconstructions as Record<
    string,
    unknown
  >[];
  assertEquals(sub[0].groundFaces, [{
    face: [[0, 0, 0], [4, 0, 0], [4, 2, 0], [0, 2, 0]],
    modes: [{
      type: "FILL",
      key: "/terrain/materials/asphalt_02/asphalt_02.gtex",
      texCoords: [[0, 0], [1, 0], [1, 1], [0, 1]],
    }],
    loop: false,
    alignmentOffsetMode: undefined,
    alignmentOffset: undefined,
    alignmentDirMode: undefined,
    alignmentDir: undefined,
  }]);
});

Deno.test("export: the Teal script writes groundFaces and omits unset fields", () => {
  const text = buildScriptTl(docWithFace());
  assertStringIncludes(text, "groundFaces");
  assertStringIncludes(
    text,
    'key = "/terrain/materials/asphalt_02/asphalt_02.gtex"',
  );
  assertStringIncludes(text, "loop = false");
  assert(!text.includes("alignmentOffsetMode"));
});

Deno.test("export: a layer without faces has no groundFaces key", () => {
  assert(!buildScriptTl(newConstruction("a")).includes("groundFaces"));
});
