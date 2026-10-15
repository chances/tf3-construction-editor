import { assert, assertEquals } from "jsr:@std/assert@^1";
import { parseMdl } from "./mdl.ts";
import { fixtureText } from "./testing.ts";

Deno.test("mdl: reads the unit cube", () => {
  const mdl = parseMdl(fixtureText("unit_cube.mdl"));
  assertEquals(mdl.bbMin, [-1.5, -1.5, -1.5]);
  assertEquals(mdl.bbMax, [1.5, 1.5, 1.5]);
  assertEquals(mdl.lodCount, 1);
  assertEquals(mdl.collider, { type: "BOX", halfExtents: [1.5, 1.5, 1.5] });
  assertEquals(mdl.lod0Meshes, ["msh/cube_1x1_lod0.msh"]);
});

Deno.test("mdl: reads three more shipped placeholder models", () => {
  for (
    const name of [
      "missing_generic.mdl",
      "missing_signal.mdl",
      "missing_car.mdl",
    ]
  ) {
    const mdl = parseMdl(fixtureText(name));
    assert(mdl.lodCount >= 1, `${name} has a LOD`);
    assert(
      mdl.bbMax.every((n, i) => n >= mdl.bbMin[i]),
      `${name} bounds are ordered`,
    );
  }
});
