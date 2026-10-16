import { assert, assertEquals } from "jsr:@std/assert@^1";
import { join } from "jsr:@std/path@^1";
import { AssetIndex, indexBaseGame, indexModContent } from "./assets.ts";
import {
  fixtures,
  fixtureText,
  installPresent,
  installRoot,
  withTempDir,
  writeZip,
} from "./testing.ts";

Deno.test("assets: ids follow the zip folder plus entry name", async () => {
  await withTempDir(async (dir) => {
    const content = join(dir, "base", "content");
    await writeZip(join(content, "stations", "air.zip"), {
      "air/airfield/apron.mdl": fixtureText("unit_cube.mdl"),
      "air/readme.txt": "n/a",
    }, 6);
    await writeZip(join(content, "placeholders.zip"), {
      "placeholders/unit_cube.mdl": fixtureText("unit_cube.mdl"),
    }, 0);
    const index = new AssetIndex(await indexBaseGame(dir));
    assert(index.has("/stations/air/airfield/apron.mdl"));
    assert(index.has("/placeholders/unit_cube.mdl"));
    assertEquals(index.size, 2);
    assertEquals(
      (await index.readModel("/placeholders/unit_cube.mdl")).lodCount,
      1,
    );
  });
});

Deno.test("assets: search matches the text of a chip, ignoring case", () => {
  const entry = (id: string) => ({ id, source: "base" as const, entry: id });
  const index = new AssetIndex([
    entry("/animal/cr_fish/cr_fish_01.mdl"),
    entry("/vehicle/train_low_idle.mdl"),
    entry("/building/com/awnings/b_awin_l_04.mdl"),
  ]);
  const ids = (q: string) => index.search(q).map((e) => e.id);
  assertEquals(ids("CRITTER"), ["/animal/cr_fish/cr_fish_01.mdl"]);
  assertEquals(ids("low-poly"), ["/vehicle/train_low_idle.mdl"]);
  assertEquals(ids("state: idle"), ["/vehicle/train_low_idle.mdl"]);
  assertEquals(ids("commercial"), ["/building/com/awnings/b_awin_l_04.mdl"]);
  assertEquals(ids("built-in").length, 3);
  assertEquals(ids("train"), ["/vehicle/train_low_idle.mdl"]);
});

Deno.test("assets: variant files are one result that places the high poly", () => {
  const entry = (id: string) => ({ id, source: "base" as const, entry: id });
  const index = new AssetIndex([
    entry("/animal/cow/cow_2.mdl"),
    entry("/animal/cow/cow_2_prod_low.mdl"),
    entry("/animal/cow/cow_2_prod_high.mdl"),
    entry("/animal/cow/cow_2_idle.mdl"),
  ]);
  const groups = index.searchGroups("cow");
  assertEquals(groups.length, 1);
  assertEquals(groups[0].entry.id, "/animal/cow/cow_2_prod_high.mdl");
  assertEquals(groups[0].variants.length, 4);
  assertEquals(index.searchGroups("low-poly idle").length, 1);
  assertEquals(index.searchGroups("zzz"), []);
});

Deno.test("assets: search splits keywords and matches I/O aliases", () => {
  const entry = (id: string) => ({ id, source: "base" as const, entry: id });
  const index = new AssetIndex([
    entry("/industries/fishing/terminal_input.mdl"),
    entry("/industries/fishing/terminal_output.mdl"),
    entry("/industries/fishing/floating_raft.mdl"),
  ]);
  const ids = (q: string) => index.search(q).map((e) => e.id);
  assertEquals(ids("i/o"), [
    "/industries/fishing/terminal_input.mdl",
    "/industries/fishing/terminal_output.mdl",
  ]);
  assertEquals(ids("INPUT").length, 2);
  assertEquals(ids("output").length, 2);
  assertEquals(ids("terminal  i/o").length, 2);
  assertEquals(ids("fishing raft"), ["/industries/fishing/floating_raft.mdl"]);
  assertEquals(ids("fishing zzz"), []);
  assertEquals(ids("  ").length, 3);
});

Deno.test("assets: mod ids are absolute and dependency ids carry the prefix", async () => {
  await withTempDir(async (dir) => {
    await Deno.mkdir(join(dir, "content", "assets"), { recursive: true });
    await Deno.writeTextFile(
      join(dir, "content", "assets", "a.mdl"),
      fixtureText("unit_cube.mdl"),
    );
    const own = await indexModContent(dir, "mod");
    const dep = await indexModContent(dir, "dependency", "other_mod");
    assertEquals(own.map((e) => e.id), ["/assets/a.mdl"]);
    assertEquals(dep.map((e) => e.id), ["other_mod::/assets/a.mdl"]);
  });
});

Deno.test("assets: the cube outline is its 1 m square", async () => {
  await withTempDir(async (dir) => {
    const content = join(dir, "content", "placeholders");
    await Deno.mkdir(join(content, "msh"), { recursive: true });
    await Deno.writeTextFile(
      join(content, "unit_cube.mdl"),
      fixtureText("unit_cube.mdl"),
    );
    for (const name of ["cube_1x1_lod0.msh", "cube_1x1_lod0.msh.blob"]) {
      await Deno.copyFile(
        new URL(`msh/${name}`, fixtures),
        join(content, "msh", name),
      );
    }
    const index = new AssetIndex(await indexModContent(dir, "mod"));
    const [loop] = await index.readOutline("/placeholders/unit_cube.mdl");
    assertEquals(loop.length, 4);
    const xs = loop.map((p) => p[0]);
    assertEquals(
      [Math.min(...xs), Math.max(...xs)].map((n) => Math.round(n * 10) / 10),
      [-0.5, 0.5],
    );
  });
});

Deno.test({
  name: "install: the real base game index resolves the unit cube",
  ignore: !installPresent,
  fn: async () => {
    const index = new AssetIndex(await indexBaseGame(installRoot!));
    assert(index.has("/placeholders/unit_cube.mdl"));
    assert(index.size > 100);
    const mdl = await index.readModel("/placeholders/unit_cube.mdl");
    assertEquals(mdl.bbMax, [1.5, 1.5, 1.5]);
  },
});

Deno.test({
  name:
    "install: a real multi-submesh model yields an outline inside its bounds",
  ignore: !installPresent,
  fn: async () => {
    const index = new AssetIndex(await indexBaseGame(installRoot!));
    const [entry] = index.search("/stations/air/heliport/heliport.mdl", 1);
    assert(entry, "heliport.mdl is in the index");
    const summary = await index.readModel(entry.id);
    const outline = await index.readOutline(entry.id);
    assert(outline.length >= 1);
    const slack = 0.5;
    for (const [x, y] of outline.flat()) {
      assert(x >= summary.bbMin[0] - slack && x <= summary.bbMax[0] + slack);
      assert(y >= summary.bbMin[1] - slack && y <= summary.bbMax[1] + slack);
    }
  },
});
