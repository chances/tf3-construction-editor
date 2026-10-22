import { assert, assertEquals } from "jsr:@std/assert@^1";
import {
  type GtexEntry,
  GtexIndex,
  gtexName,
  indexBaseGtex,
  resolveGtexRef,
} from "./gtex.ts";
import { installPresent, installRoot } from "./testing.ts";

function entry(id: string, kind: GtexEntry["kind"]): GtexEntry {
  return { id, source: "base", entry: id, kind };
}

const files: Record<string, string> = {
  "/terrain/materials/asphalt_01/asphalt_01.gtex":
    'return { priority = 14, texSize = { 1, 1 }, materialIndexMap = { "asphalt_01.tmat" } }',
  "/terrain/materials/asphalt_01/asphalt_01.tmat":
    'return { name = _("Asphalt"), icon = "x.tga", previewIcon = "asphalt_01_preview.tga", detailSize = 1 / 32, detailColorTexture = "tex/a.dds" }',
  "/air/airfield/airfield.gtex":
    'function data() return { texture = tu.makeMaterialIndexTexture("airfield.tga", "CLAMP_TO_EDGE", "CLAMP_TO_EDGE"), texSize = { 400, 110 } } end',
  "/odd/odd.gtex": 'return { materialIndexMap = { [95] = "::/odd/m.tmat" } }',
  "/odd/m.tmat": 'return { detailColorTexture = "tex/m.dds" }',
  "/bare/bare.gtex": "return { priority = 1 }",
};

function index() {
  return new GtexIndex(
    [
      entry("/terrain/materials/asphalt_01/asphalt_01.gtex", "gtex"),
      entry("/terrain/materials/asphalt_01/asphalt_01.tmat", "tmat"),
      entry("/air/airfield/airfield.gtex", "gtex"),
      entry("/odd/odd.gtex", "gtex"),
      entry("/odd/m.tmat", "tmat"),
      entry("/bare/bare.gtex", "gtex"),
    ],
    (e) => Promise.resolve(files[e.id]),
  );
}

Deno.test("gtexName drops the folder and the extension", () => {
  assertEquals(
    gtexName("/terrain/materials/asphalt_01/asphalt_01.gtex"),
    "asphalt_01",
  );
});

Deno.test("references resolve against the file, the content root, and a mod prefix", () => {
  assertEquals(resolveGtexRef("/a/b/c.gtex", "d.tmat"), "/a/b/d.tmat");
  assertEquals(resolveGtexRef("/a/b/c.gtex", "../d.tmat"), "/a/d.tmat");
  assertEquals(resolveGtexRef("/a/b/c.gtex", "::/x/y.tmat"), "/x/y.tmat");
  assertEquals(resolveGtexRef("/a/b/c.gtex", "/x/y.tmat"), "/x/y.tmat");
  assertEquals(resolveGtexRef("m::/a/b/c.gtex", "d.tga"), "m::/a/b/d.tga");
});

Deno.test("search needs every keyword, ignores case, and skips materials", () => {
  const found = index().search("ASPHALT 01");
  assertEquals(found.map((e) => e.id), [
    "/terrain/materials/asphalt_01/asphalt_01.gtex",
  ]);
  assertEquals(index().search("").length, 4);
  assertEquals(index().size, 4);
});

Deno.test("a single-material texture previews its material's icon", async () => {
  assertEquals(
    await index().previewImage("/terrain/materials/asphalt_01/asphalt_01.gtex"),
    "/terrain/materials/asphalt_01/asphalt_01_preview.tga",
  );
});

Deno.test("a mask texture previews the mask it names", async () => {
  assertEquals(
    await index().previewImage("/air/airfield/airfield.gtex"),
    "/air/airfield/airfield.tga",
  );
});

Deno.test("a base-rooted material reference falls back to the color texture", async () => {
  assertEquals(await index().previewImage("/odd/odd.gtex"), "/odd/tex/m.dds");
});

Deno.test("a texture with no preview, or an unknown key, gives null", async () => {
  assertEquals(await index().previewImage("/bare/bare.gtex"), null);
  assertEquals(await index().previewImage("/missing.gtex"), null);
});

Deno.test({
  name: "the base game indexes ground textures and previews one",
  ignore: !installPresent,
  async fn() {
    const entries = await indexBaseGtex(installRoot!);
    const index = new GtexIndex(entries);
    assert(index.size > 0);
    const asphalt = index.get("/terrain/materials/asphalt_01/asphalt_01.gtex");
    assert(asphalt, "asphalt_01.gtex is indexed");
    assertEquals(
      await index.previewImage(asphalt.id),
      "/terrain/materials/asphalt_01/asphalt_01_preview.tga",
    );
  },
});
