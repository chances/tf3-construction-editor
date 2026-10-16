import { assertEquals } from "jsr:@std/assert@^1";
import { counted, nounForms, plural, pluralNoun } from "./plural.ts";

const model = { one: "model", other: "models" };

Deno.test("plural: one takes the one form, everything else takes other", () => {
  assertEquals(plural(1, model), "model");
  assertEquals(plural(0, model), "models");
  assertEquals(plural(2, model), "models");
});

Deno.test("plural: a missing category falls back to other", () => {
  assertEquals(plural(1, { other: "files" }), "files");
});

Deno.test("nounForms: regular and irregular nouns inflect", () => {
  assertEquals(nounForms("model"), model);
  assertEquals(nounForms("Warning"), { one: "Warning", other: "Warnings" });
  assertEquals(nounForms("child").other, "children");
  assertEquals(pluralNoun("awnings"), "awnings");
});

Deno.test("counted: the number is grouped and joined to its noun", () => {
  assertEquals(counted(1, model), "1 model");
  assertEquals(counted(1200, model), "1,200 models");
});
