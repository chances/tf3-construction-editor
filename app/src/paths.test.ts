import { assertEquals } from "jsr:@std/assert@^1";
import {
  basename as stdBasename,
  extname as stdExtname,
} from "jsr:@std/path@^1/posix";
import { basename, shortenFolder, stem } from "./paths.ts";

Deno.test("paths: shortenFolder keeps the first and last segments", () => {
  assertEquals(shortenFolder("stations/custom/deep/leaf"), "stations/…/leaf");
  assertEquals(shortenFolder("a/b/c"), "a/…/c");
  assertEquals(shortenFolder("stations/custom"), "stations/custom");
  assertEquals(shortenFolder("stations"), "stations");
  assertEquals(shortenFolder(""), "");
});

Deno.test("paths: stem agrees with @std/path on resource paths", () => {
  for (
    const path of [
      "/gui/icons/arrow.tga",
      "/placeholders/generic@2x.tga",
      "other_mod::/ui/b.PNG",
      "/a/b/",
      "file.dds",
      "noext",
      "/a/.hidden",
      "a.tar.gz",
      "",
    ]
  ) {
    assertEquals(stem(path), stdBasename(path, stdExtname(path)), path);
  }
});

Deno.test("paths: basename is the last segment of a resource path", () => {
  assertEquals(basename("/gui/icons/arrow.tga"), "arrow.tga");
  assertEquals(basename("mod_id::/ui/a.png"), "a.png");
  assertEquals(basename("arrow.tga"), "arrow.tga");
  assertEquals(basename("/gui/icons/"), "icons");
  assertEquals(basename(""), "");
});

Deno.test("paths: basename agrees with @std/path on resource paths", () => {
  for (
    const path of [
      "/gui/icons/arrow.tga",
      "/placeholders/generic@2x.tga",
      "other_mod::/ui/b.PNG",
      "/a/b/",
      "file.dds",
    ]
  ) {
    assertEquals(basename(path), stdBasename(path), path);
  }
});
