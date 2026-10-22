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

const rotatedRect = (w: number, h: number, degrees: number): Triangle2[] => {
  const a = degrees * Math.PI / 180;
  const c = Math.cos(a), s = Math.sin(a);
  const p = (x: number, y: number): [number, number] => [
    x * c - y * s,
    x * s + y * c,
  ];
  const [a0, a1] = p(0, 0), [b0, b1] = p(w, 0), [c0, c1] = p(w, h);
  const [d0, d1] = p(0, h);
  return [[a0, a1, b0, b1, c0, c1], [a0, a1, c0, c1, d0, d1]];
};

for (const degrees of [30, 45, 17]) {
  Deno.test(`silhouette: a rectangle rotated ${degrees} degrees stays four straight edges`, () => {
    const rect = silhouette(rotatedRect(100, 20, degrees));
    assertEquals(rect.length, 1);
    assertEquals(rect[0].length, 4);
  });
}

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
