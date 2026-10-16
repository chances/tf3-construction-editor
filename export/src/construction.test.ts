import { assertEquals } from "jsr:@std/assert@^1";
import { parseConstruction } from "@cedit/schema";
import { buildConLua, buildScriptTl } from "./construction.ts";

const testdata = new URL("../testdata/", import.meta.url);

function readText(name: string): string {
  // A git checkout may convert the stored files to CRLF.
  return Deno.readTextFileSync(new URL(name, testdata)).replaceAll(
    "\r\n",
    "\n",
  );
}

function loadSample() {
  return parseConstruction(
    JSON.parse(readText("sample_hall.construction.json")),
  );
}

Deno.test("golden: .con.lua matches the stored file", () => {
  assertEquals(buildConLua(loadSample()), readText("sample_hall.con.lua"));
});

Deno.test("golden: .script.tl matches the stored file", () => {
  assertEquals(buildScriptTl(loadSample()), readText("sample_hall.script.tl"));
});
