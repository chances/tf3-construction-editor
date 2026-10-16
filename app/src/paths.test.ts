import { assertEquals } from "jsr:@std/assert@^1";
import { shortenFolder } from "./paths.ts";

Deno.test("paths: shortenFolder keeps the first and last segments", () => {
  assertEquals(shortenFolder("stations/custom/deep/leaf"), "stations/…/leaf");
  assertEquals(shortenFolder("a/b/c"), "a/…/c");
  assertEquals(shortenFolder("stations/custom"), "stations/custom");
  assertEquals(shortenFolder("stations"), "stations");
  assertEquals(shortenFolder(""), "");
});
