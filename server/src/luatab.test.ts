import { assertEquals, assertThrows } from "jsr:@std/assert@^1";
import { LuaParseError, parseLuaTable } from "./luatab.ts";

Deno.test("luatab: comments, keys, negatives, and escapes", () => {
  const value = parseLuaTable(`
    -- header
    return {
      a = -1.5e1, --[[ block ]] b = "x\\ty",
      ["c-d"] = { 1, 2, 3, },
      [5] = true;
      empty = { },
    }`);
  assertEquals(value, {
    a: -15,
    b: "x\ty",
    "c-d": [1, 2, 3],
    "5": true,
    empty: [],
  });
});

Deno.test('luatab: _("KEY") parses as its key', () => {
  assertEquals(parseLuaTable('return { name = _("MISSING_MODEL_NAME"), }'), {
    name: "MISSING_MODEL_NAME",
  });
});

Deno.test("luatab: a function call is rejected with the line", () => {
  const error = assertThrows(
    () => parseLuaTable('return {\n a = require("x"),\n}'),
    LuaParseError,
  );
  assertEquals(error.line, 2);
});
