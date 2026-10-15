import { assert, assertEquals } from "jsr:@std/assert@^1";
import { newConstruction } from "./defaults.ts";
import { hasErrors, isModDetailsComplete, lintConstruction } from "./lint.ts";
import { newModInfo } from "./defaults.ts";
import { composeTransf, identityMat4 } from "./transform.ts";

const knownModel = "/placeholders/unit_cube.mdl";
const ctx = { resolveModel: (id: string) => id === knownModel };

Deno.test("mod details: only name and summary are required", () => {
  const info = newModInfo("My Mod");
  assertEquals(isModDetailsComplete(info), false);
  info.summary = "Adds a hall.";
  assertEquals(isModDetailsComplete(info), true);
  assertEquals(info.description, "");
  assertEquals(info.authors, []);
  assertEquals(info.tags, []);
});

Deno.test("mod details: a blank name or an overlong value is incomplete", () => {
  const info = { ...newModInfo("My Mod"), summary: "x" };
  assertEquals(isModDetailsComplete({ ...info, name: "  " }), false);
  assertEquals(isModDetailsComplete({ ...info, name: "n".repeat(33) }), false);
  assertEquals(
    isModDetailsComplete({ ...info, summary: "s".repeat(101) }),
    false,
  );
});

Deno.test("lint flags an unknown model and an overlong name", () => {
  const doc = newConstruction("a");
  doc.description.name = "x".repeat(33);
  doc.subconstructions[0].models.push({
    id: "/missing.mdl",
    transf: identityMat4(),
  });
  const issues = lintConstruction(doc, ctx);
  assertEquals(
    issues.map((i) => i.rule).sort(),
    ["description-name-length", "model-resolves"],
  );
  assert(hasErrors(issues));
});

Deno.test("lint warns on a used unverified field without blocking export", () => {
  const doc = newConstruction("a");
  doc.snapPoint = {};
  const issues = lintConstruction(doc, ctx);
  assertEquals(issues.length, 1);
  assertEquals(issues[0].severity, "warning");
  assert(!hasErrors(issues));
});

Deno.test("lint warns on a scaled model", () => {
  const doc = newConstruction("a");
  doc.subconstructions[0].models.push({
    id: knownModel,
    transf: composeTransf({ x: 0, y: 0, z: 0, yaw: 0, scale: 1.5 }),
  });
  const issues = lintConstruction(doc, ctx);
  assertEquals(issues.map((i) => i.rule), ["unverified-field"]);
});
