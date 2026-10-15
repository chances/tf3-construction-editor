import { assert, assertEquals } from "jsr:@std/assert@^1";
import { silhouette, type Triangle2 } from "./silhouette.ts";

const quad = (x0: number, y0: number, x1: number, y1: number): Triangle2[] => [
  [x0, y0, x1, y0, x1, y1],
  [x0, y0, x1, y1, x0, y1],
];

Deno.test("silhouette: a rectangle is one loop of four points", () => {
  const rect = silhouette(quad(0, 0, 10, 4));
  assertEquals(rect.length, 1);
  assertEquals(rect[0].length, 4);
});

Deno.test("silhouette: an L shape keeps its notch", () => {
  const ell = silhouette([...quad(0, 0, 10, 4), ...quad(0, 4, 4, 10)]);
  assertEquals(ell.length, 1);
  const xs = ell[0].map((p) => p[0]);
  const ys = ell[0].map((p) => p[1]);
  assertEquals([Math.min(...xs), Math.max(...xs)].map(Math.round), [0, 10]);
  assertEquals([Math.min(...ys), Math.max(...ys)].map(Math.round), [0, 10]);
  assert(!ell[0].some(([x, y]) => x > 8 && y > 8), "the notch stays empty");
  assertEquals(ell[0].length, 6);
});
