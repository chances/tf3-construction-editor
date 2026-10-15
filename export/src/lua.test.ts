import { assertEquals } from "jsr:@std/assert@^1";
import { luaString, toLua } from "./lua.ts";

Deno.test("toLua quotes keys that are not identifiers and skips undefined", () => {
  assertEquals(
    toLua({ ok: 1, "needs-quote": "x", end: true, skipped: undefined }),
    '{\n\tok = 1,\n\t["needs-quote"] = "x",\n\t["end"] = true,\n}',
  );
});

Deno.test("luaString escapes quotes, backslashes, and control characters", () => {
  assertEquals(luaString('a"b\\c\n\u0001'), '"a\\"b\\\\c\\n\\001"');
});
