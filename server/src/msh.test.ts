import { assert, assertEquals, assertThrows } from "jsr:@std/assert@^1";
import { MshError, parseMsh } from "./msh.ts";
import { fixtureBytes, fixtureText } from "./testing.ts";

Deno.test("msh: reads the cube mesh from the shipped fixture", () => {
  const blob = fixtureBytes("msh/cube_1x1_lod0.msh.blob");
  const mesh = parseMsh(fixtureText("msh/cube_1x1_lod0.msh"), blob);
  assertEquals(mesh.positions.length / 3, 8);
  assertEquals(mesh.triangles.length / 3, 12);
  const xs = Array.from(mesh.positions).filter((_, i) => i % 3 === 0);
  assertEquals([Math.min(...xs), Math.max(...xs)], [-0.5, 0.5]);
});

Deno.test("msh: an index past the position array is rejected", () => {
  const broken = new Uint8Array(fixtureBytes("msh/cube_1x1_lod0.msh.blob"));
  // The first position index sits at byte 664. Point it at vertex 99.
  new DataView(broken.buffer).setUint32(664, 99, true);
  const error = assertThrows(
    () => parseMsh(fixtureText("msh/cube_1x1_lod0.msh"), broken),
    MshError,
  );
  assert(error.message.includes("32-bit"));
});
