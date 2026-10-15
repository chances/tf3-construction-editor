import { assert, assertEquals } from "jsr:@std/assert@^1";
import {
  composeTransf,
  decomposeTransf,
  identityMat4,
  multiplyMat4,
  transformPoint,
} from "./transform.ts";

Deno.test("transform helpers agree", () => {
  const m = composeTransf({ x: 10, y: 5, z: 2, yaw: Math.PI / 2 });
  const [x, y, z] = transformPoint(m, [1, 0, 0]);
  assertEquals([Math.round(x), Math.round(y), z], [10, 6, 2]);
  const back = decomposeTransf(m);
  assertEquals([back.x, back.y, back.z], [10, 5, 2]);
  assert(Math.abs(back.yaw - Math.PI / 2) < 1e-9);
  assertEquals(transformPoint(identityMat4(), [1, 2, 3]), [1, 2, 3]);
});

Deno.test("scale and matrix multiplication", () => {
  const scaled = composeTransf({
    x: 1,
    y: 2,
    z: 0,
    yaw: Math.PI / 2,
    scale: 2,
  });
  assertEquals(decomposeTransf(scaled).scale, 2);
  const [x, y] = transformPoint(scaled, [1, 0, 0]);
  assertEquals([Math.round(x), Math.round(y)], [1, 4]);
  const move = composeTransf({ x: 10, y: 0, z: 0, yaw: 0 });
  const both = multiplyMat4(move, scaled);
  const [px, py] = transformPoint(both, [1, 0, 0]);
  assertEquals([Math.round(px), Math.round(py)], [11, 4]);
});
