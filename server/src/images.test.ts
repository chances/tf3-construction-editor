import { assertEquals } from "jsr:@std/assert@^1";
import { join } from "jsr:@std/path@^1";
import {
  type ImageEntry,
  ImageIndex,
  imageMatchScore,
  indexModImages,
} from "./images.ts";
import { withTempDir } from "./testing.ts";

const entry = (id: string): ImageEntry => ({
  id,
  source: "base",
  entry: id,
  format: "png",
});

Deno.test("images: a file name that starts with the query ranks first", () => {
  const index = new ImageIndex([
    entry("/gui/arrow_icons/zzz.png"),
    entry("/gui/big_arrow.png"),
    entry("/gui/arrow.png"),
  ]);
  assertEquals(
    index.search("arrow").map((e) => e.id),
    ["/gui/arrow.png", "/gui/big_arrow.png", "/gui/arrow_icons/zzz.png"],
  );
});

Deno.test("images: ids under /gui come before everything else", () => {
  const index = new ImageIndex([
    entry("/animal/arrow.dds"),
    entry("/gui/deep/menu/arrow_up.tga"),
    entry("/placeholders/arrow.tga"),
    entry("/gui/arrow.tga"),
  ]);
  assertEquals(
    index.search("arrow").map((e) => e.id),
    [
      "/gui/arrow.tga",
      "/gui/deep/menu/arrow_up.tga",
      "/animal/arrow.dds",
      "/placeholders/arrow.tga",
    ],
  );
});

Deno.test("images: a path-only match under /gui still beats a name match elsewhere", () => {
  const index = new ImageIndex([
    entry("/animal/icons.dds"),
    entry("/gui/icons/home.tga"),
  ]);
  assertEquals(
    index.search("icons").map((e) => e.id),
    ["/gui/icons/home.tga", "/animal/icons.dds"],
  );
});

Deno.test("images: an empty query lists /gui first, alphabetically", () => {
  const index = new ImageIndex([
    entry("/zeta/z.png"),
    entry("/gui/b.png"),
    entry("/alpha/a.png"),
    entry("/gui/a.png"),
  ]);
  assertEquals(
    index.search("").map((e) => e.id),
    ["/gui/a.png", "/gui/b.png", "/alpha/a.png", "/zeta/z.png"],
  );
});

Deno.test("images: no folders are offered until the text holds a slash", () => {
  const index = new ImageIndex([entry("/gui/builtin/a.png")]);
  assertEquals(index.folders(""), []);
  assertEquals(index.folders("gui"), []);
});

Deno.test("images: a typed slash completes the folders under it", () => {
  const index = new ImageIndex([
    entry("/gui/builtin/combobox/a.png"),
    entry("/gui/builtin/scrollview/b.png"),
    entry("/gui/menu/c.png"),
    entry("/animal/d.png"),
  ]);
  assertEquals(index.folders("/"), ["/gui/", "/animal/"]);
  assertEquals(index.folders("/gui/"), ["/gui/builtin/", "/gui/menu/"]);
  assertEquals(index.folders("/gui/b"), ["/gui/builtin/"]);
  assertEquals(
    index.folders("/gui/builtin/"),
    ["/gui/builtin/combobox/", "/gui/builtin/scrollview/"],
  );
  assertEquals(index.folders("/GUI/M"), ["/gui/menu/"]);
});

Deno.test("images: only direct child folders are offered, and a leaf offers none", () => {
  const index = new ImageIndex([entry("/gui/a/b/c/x.png")]);
  assertEquals(index.folders("/gui/"), ["/gui/a/"]);
  assertEquals(index.folders("/gui/a/b/c/"), []);
});

Deno.test("images: a path without a leading slash completes from the root", () => {
  const index = new ImageIndex([entry("/gui/menu/c.png")]);
  assertEquals(index.folders("gui/"), ["/gui/menu/"]);
});

Deno.test("images: dependency ids complete under their prefix", () => {
  const index = new ImageIndex([entry("other_mod::/ui/icons/a.png")]);
  assertEquals(index.folders("other_mod::/ui/"), ["other_mod::/ui/icons/"]);
});

Deno.test("images: a @2x file is the same icon under its base id", () => {
  const index = new ImageIndex([entry("/gui/icons/arrow@2x.tga")]);
  assertEquals(index.size, 1);
  assertEquals(index.search("arrow").map((e) => e.id), [
    "/gui/icons/arrow.tga",
  ]);
  // The entry still reads from the file that is on disk.
  assertEquals(
    index.get("/gui/icons/arrow.tga")?.entry,
    "/gui/icons/arrow@2x.tga",
  );
});

Deno.test("images: both forms of an id find the same entry", () => {
  const index = new ImageIndex([entry("/gui/a@2x.tga")]);
  assertEquals(index.get("/gui/a.tga")?.id, "/gui/a.tga");
  assertEquals(index.get("/gui/a@2x.tga")?.id, "/gui/a.tga");
  assertEquals(index.get("/gui/missing.tga"), undefined);
});

Deno.test("images: a base file and its @2x file are one entry that reads the smaller base file", () => {
  for (
    const order of [["/gui/a.tga", "/gui/a@2x.tga"], [
      "/gui/a@2x.tga",
      "/gui/a.tga",
    ]]
  ) {
    const index = new ImageIndex(order.map(entry));
    assertEquals(index.size, 1, order.join(", "));
    assertEquals(
      index.get("/gui/a.tga")?.entry,
      "/gui/a.tga",
      order.join(", "),
    );
    assertEquals(index.get("/gui/a.tga")?.hires, false, order.join(", "));
  }
});

Deno.test("images: a query that names @2x still matches", () => {
  const index = new ImageIndex([
    entry("/gui/arrow_down@2x.tga"),
    entry("/gui/other.tga"),
  ]);
  assertEquals(
    index.search("arrow_down@2x").map((e) => e.id),
    ["/gui/arrow_down.tga"],
  );
  assertEquals(
    index.search("arrow@2x").map((e) => e.id),
    ["/gui/arrow_down.tga"],
  );
});

Deno.test("images: a dependency @2x id consolidates under its prefix", () => {
  const index = new ImageIndex([entry("other_mod::/ui/a@2x.png")]);
  assertEquals(index.search("").map((e) => e.id), ["other_mod::/ui/a.png"]);
  assertEquals(index.folders("other_mod::/ui/"), []);
});

Deno.test("images: the limit and an empty query", () => {
  const index = new ImageIndex(
    ["a", "b", "c", "d"].map((n) => entry(`/x/${n}.png`)),
  );
  assertEquals(index.search("", 2).length, 2);
  assertEquals(index.search("nothing"), []);
  assertEquals(imageMatchScore("/X/Foo.PNG", "foo"), 0);
});

Deno.test("images: a mod indexes images under content with its prefix", async () => {
  await withTempDir(async (dir) => {
    await Deno.mkdir(join(dir, "content", "ui"), { recursive: true });
    await Deno.writeFile(
      join(dir, "content", "ui", "a.tga"),
      new Uint8Array(1),
    );
    await Deno.writeFile(
      join(dir, "content", "ui", "b.PNG"),
      new Uint8Array(1),
    );
    await Deno.writeFile(
      join(dir, "content", "ui", "m.mdl"),
      new Uint8Array(1),
    );

    const own = await indexModImages(dir, "mod");
    assertEquals(own.map((e) => e.id).sort(), ["/ui/a.tga", "/ui/b.PNG"]);

    const dep = await indexModImages(dir, "dependency", "other_mod");
    assertEquals(
      dep.map((e) => e.id).sort(),
      ["other_mod::/ui/a.tga", "other_mod::/ui/b.PNG"],
    );
    assertEquals(dep[0].modId, "other_mod");
  });
});
