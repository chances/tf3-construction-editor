import { assertEquals, assertThrows } from "jsr:@std/assert@^1";
import { newConstruction } from "./defaults.ts";
import { parseConstruction, SchemaError } from "./parse.ts";
import { composeTransf } from "./transform.ts";

Deno.test("construction survives a JSON round trip", () => {
  const doc = newConstruction("my_station");
  doc.subconstructions[0].models.push({
    id: "/placeholders/unit_cube.mdl",
    transf: composeTransf({ x: 4, y: -2, z: 1, yaw: 0.5 }),
  });
  doc.costs.cost = 100;
  doc.snapPoint = { placeAtTerrainHeight: true };
  const parsed = parseConstruction(JSON.parse(JSON.stringify(doc)));
  assertEquals(parsed, doc);
});

Deno.test("parseConstruction names the failing path", () => {
  const doc = newConstruction("a");
  const broken = JSON.parse(JSON.stringify(doc));
  broken.subconstructions[0].models.push({ id: "x", transf: [1, 2] });
  const error = assertThrows(() => parseConstruction(broken), SchemaError);
  assertEquals(error.path, "construction.subconstructions.0.models.0.transf");
});

Deno.test("hidden layers survive a round trip", () => {
  const doc = newConstruction("a");
  doc.subconstructions[0].hidden = true;
  assertEquals(
    parseConstruction(JSON.parse(JSON.stringify(doc))).subconstructions[0]
      .hidden,
    true,
  );
});
