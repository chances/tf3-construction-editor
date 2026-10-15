import { assert, assertEquals, assertRejects } from "jsr:@std/assert@^1";
import { join } from "jsr:@std/path@^1";
import { identityMat4 } from "@cedit/schema";
import { AssetIndex } from "./assets.ts";
import {
  createConstruction,
  createMod,
  deleteConstruction,
  exportConstruction,
  loadMod,
  readConstruction,
  writeConstruction,
} from "./mods.ts";
import { withTempDir } from "./testing.ts";

Deno.test("mods: create, edit, and export a construction", async () => {
  await withTempDir(async (modsRoot) => {
    const cube = "/placeholders/unit_cube.mdl";
    const index = new AssetIndex([
      { id: cube, source: "base", entry: "unit_cube.mdl" },
    ]);
    const listing = await createMod(modsRoot, "demo_mod", "Demo");
    assertEquals(listing.dirName, "demo_mod");
    await createConstruction(modsRoot, "demo_mod", "hall");
    const doc = await readConstruction(modsRoot, "demo_mod", "hall");
    doc.subconstructions[0].models.push({ id: cube, transf: identityMat4() });
    await writeConstruction(modsRoot, "demo_mod", doc);

    const first = await exportConstruction(modsRoot, "demo_mod", "hall", index);
    assert(first.ok, JSON.stringify(first));
    assertEquals(first.written.sort(), [
      "_metadata/modinfo.json",
      "content/constructions/hall.con.lua",
      "content/constructions/hall.script.tl",
      "mod.json",
    ]);
    const script = await Deno.readTextFile(
      join(modsRoot, "demo_mod", "content", "constructions", "hall.script.tl"),
    );
    assert(script.includes(`id = "${cube}"`));
    const manifest = JSON.parse(
      await Deno.readTextFile(
        join(modsRoot, "demo_mod", "_metadata", "export-manifest.json"),
      ),
    );
    assertEquals(manifest.owned.length, 2);

    const again = await exportConstruction(modsRoot, "demo_mod", "hall", index);
    assert(again.ok, "owned files may be rewritten");
    assertEquals((await loadMod(modsRoot, "demo_mod")).constructions.length, 1);
  });
});

Deno.test("mods: a new construction takes the given display name", async () => {
  await withTempDir(async (modsRoot) => {
    await createMod(modsRoot, "demo_mod", "Demo");
    const doc = await createConstruction(
      modsRoot,
      "demo_mod",
      "grand_hall",
      "  Grand Hall ",
    );
    assertEquals(doc.id, "grand_hall");
    assertEquals(doc.description.name, "Grand Hall");
  });
});

Deno.test("mods: delete removes the document and the exported files it owns", async () => {
  await withTempDir(async (modsRoot) => {
    const index = new AssetIndex();
    await createMod(modsRoot, "demo_mod", "Demo");
    await createConstruction(modsRoot, "demo_mod", "hall");
    await createConstruction(modsRoot, "demo_mod", "annex");
    const exported = await exportConstruction(
      modsRoot,
      "demo_mod",
      "hall",
      index,
    );
    assert(exported.ok, JSON.stringify(exported));
    const content = join(modsRoot, "demo_mod", "content", "constructions");
    const meta = join(modsRoot, "demo_mod", "_metadata");

    const result = await deleteConstruction(modsRoot, "demo_mod", "hall");
    assertEquals(result.removed.sort(), [
      "_metadata/constructions/hall.json",
      "content/constructions/hall.con.lua",
      "content/constructions/hall.script.tl",
    ]);
    for (
      const gone of [
        join(content, "hall.con.lua"),
        join(content, "hall.script.tl"),
        join(meta, "constructions", "hall.json"),
      ]
    ) {
      await assertRejects(() => Deno.stat(gone), Deno.errors.NotFound);
    }
    const manifest = JSON.parse(
      await Deno.readTextFile(join(meta, "export-manifest.json")),
    );
    assertEquals(manifest.owned, []);
    const left = (await loadMod(modsRoot, "demo_mod")).constructions;
    assertEquals(left.map((c) => c.id), ["annex"]);
  });
});

Deno.test("mods: delete keeps exported files the manifest does not own", async () => {
  await withTempDir(async (modsRoot) => {
    await createMod(modsRoot, "demo_mod", "Demo");
    await createConstruction(modsRoot, "demo_mod", "hall");
    const handWritten = join(
      modsRoot,
      "demo_mod",
      "content",
      "constructions",
      "hall.script.tl",
    );
    await Deno.mkdir(join(handWritten, ".."), { recursive: true });
    await Deno.writeTextFile(handWritten, "-- hand written\n");
    const result = await deleteConstruction(modsRoot, "demo_mod", "hall");
    assertEquals(result.removed, ["_metadata/constructions/hall.json"]);
    assertEquals(await Deno.readTextFile(handWritten), "-- hand written\n");
  });
});

Deno.test("mods: deleting a missing construction is a not-found error", async () => {
  await withTempDir(async (modsRoot) => {
    await createMod(modsRoot, "demo_mod", "Demo");
    await assertRejects(
      () => deleteConstruction(modsRoot, "demo_mod", "nope"),
      Deno.errors.NotFound,
    );
  });
});

Deno.test("mods: export blocks on a lint error and on an unowned file", async () => {
  await withTempDir(async (modsRoot) => {
    const index = new AssetIndex();
    await createMod(modsRoot, "demo_mod", "Demo");
    await createConstruction(modsRoot, "demo_mod", "hall");
    const doc = await readConstruction(modsRoot, "demo_mod", "hall");
    doc.subconstructions[0].models.push({
      id: "/missing.mdl",
      transf: identityMat4(),
    });
    await writeConstruction(modsRoot, "demo_mod", doc);
    const blocked = await exportConstruction(
      modsRoot,
      "demo_mod",
      "hall",
      index,
    );
    assertEquals(blocked.ok, false);
    assertEquals(blocked.issues[0].rule, "model-resolves");

    doc.subconstructions[0].models = [];
    await writeConstruction(modsRoot, "demo_mod", doc);
    const handWritten = join(
      modsRoot,
      "demo_mod",
      "content",
      "constructions",
      "hall.script.tl",
    );
    await Deno.mkdir(join(handWritten, ".."), { recursive: true });
    await Deno.writeTextFile(handWritten, "-- hand written\n");
    const refused = await exportConstruction(
      modsRoot,
      "demo_mod",
      "hall",
      index,
    );
    assertEquals(refused.ok, false);
    assertEquals(refused.refused.map((r) => r.path), [
      "content/constructions/hall.script.tl",
    ]);
    assertEquals(await Deno.readTextFile(handWritten), "-- hand written\n");
  });
});
