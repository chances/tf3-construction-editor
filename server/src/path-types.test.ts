import { assert, assertEquals } from "jsr:@std/assert@^1";
import {
  indexBasePathTypes,
  isEdgeObjectCon,
  PathTypeIndex,
  pathTypeName,
} from "./path-types.ts";
import type { PathTypeEntry } from "./path-types.ts";
import { installPresent, installRoot } from "./testing.ts";

const entry = (id: string, kind: PathTypeEntry["kind"]): PathTypeEntry => ({
  id,
  kind,
  source: "base",
  entry: id,
});

function index() {
  return new PathTypeIndex([
    entry(
      "/infrastructure/street/airport/airport_runway_small.street_template",
      "street",
    ),
    entry("/infrastructure/street/tram/tram_new.street_template", "street"),
    entry("/infrastructure/track/standard.track", "track"),
    entry("/assets/stations/air/signs/sign_a.con", "edgeObject"),
  ]);
}

Deno.test("pathTypeName drops the folder and every extension", () => {
  assertEquals(
    pathTypeName("/a/b/tram_new.street_template"),
    "tram_new",
  );
});

Deno.test("an edge object con declares an edgeObject table", () => {
  assert(isEdgeObjectCon("return { edgeObject = {}, params = {} }"));
  assert(!isEdgeObjectCon("return { description = { name = 'x' } }"));
  assert(!isEdgeObjectCon("return { notAnEdgeObject = 1 }"));
});

Deno.test("search stays inside one kind and needs every keyword", () => {
  const found = index().search("street", "AIRPORT small");
  assertEquals(found.map((e) => e.id), [
    "/infrastructure/street/airport/airport_runway_small.street_template",
  ]);
  assertEquals(index().search("track", "street"), []);
  assertEquals(index().search("edgeObject", "sign").length, 1);
});

Deno.test("has and count look at one kind, ignoring case", () => {
  assert(
    index().has(
      "street",
      "/INFRASTRUCTURE/street/tram/tram_new.street_template",
    ),
  );
  assert(
    !index().has(
      "track",
      "/infrastructure/street/tram/tram_new.street_template",
    ),
  );
  assertEquals(index().count("street"), 2);
  assertEquals(index().count("track"), 1);
});

Deno.test({
  name: "the base game index finds street templates and edge objects",
  ignore: !installPresent,
  fn: async () => {
    const entries = await indexBasePathTypes(installRoot!);
    const ids = new Set(entries.map((e) => e.id));
    assert(
      ids.has(
        "/infrastructure/street/airport/airport_runway_small.street_template",
      ),
    );
    assert(ids.has("/assets/stations/air/signs/signal_runway_old.con"));
    assert(!ids.has("/assets/stations/air/misc/airport.con"));
  },
});
