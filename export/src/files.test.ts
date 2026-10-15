import { assertEquals } from "jsr:@std/assert@^1";
import { parseConstruction } from "@cedit/schema";
import {
  emptyManifest,
  mergeJson,
  planExport,
  resolveOwnership,
} from "./files.ts";

const sample = new URL(
  "../testdata/sample_hall.construction.json",
  import.meta.url,
);

function loadSample() {
  return parseConstruction(JSON.parse(Deno.readTextFileSync(sample)));
}

const modInfo = {
  name: "M",
  summary: "",
  description: "",
  authors: [],
  tags: [],
};

function plan() {
  return planExport({
    mod: { modId: "m", revision: 1 },
    modInfo,
    construction: loadSample(),
  });
}

Deno.test("mergeJson keeps unknown keys and removes undefined ones", () => {
  const merged = mergeJson(
    { modId: "a", custom: { keep: true }, gone: 1 },
    { modId: "a", revision: 2, gone: undefined },
  );
  assertEquals(merged, { modId: "a", custom: { keep: true }, revision: 2 });
});

Deno.test("ownership: a new file is written and then owned", () => {
  const result = resolveOwnership(plan(), emptyManifest(), () => false);
  assertEquals(result.refused, []);
  assertEquals(result.manifest.owned, [
    "content/stations/custom/sample_hall.con.lua",
    "content/stations/custom/sample_hall.script.tl",
  ]);
});

Deno.test("ownership: an existing unowned file is refused", () => {
  const files = plan();
  const existing = "content/stations/custom/sample_hall.script.tl";
  const result = resolveOwnership(
    files,
    emptyManifest(),
    (path) => path === existing,
  );
  assertEquals(result.refused.map((r) => r.path), [existing]);
  assertEquals(result.writes.map((w) => w.path).includes(existing), false);
  const owned = resolveOwnership(
    files,
    { version: 1, owned: [existing] },
    (path) => path === existing,
  );
  assertEquals(owned.refused, []);
});
