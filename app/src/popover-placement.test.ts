import { assert, assertEquals } from "jsr:@std/assert@^1";
import { placeList } from "./popover-placement.ts";

const WANTED = 288;

Deno.test("placement: plenty of room below opens down at the wanted height", () => {
  const p = placeList(
    { top: 100, bottom: 130 },
    { top: 0, bottom: 600 },
    WANTED,
  );
  assertEquals(p, { up: false, maxHeight: 288 });
});

Deno.test("placement: the list never extends past the bottom edge", () => {
  for (const bottom of [140, 200, 320, 480, 700]) {
    const anchor = { top: 100, bottom: 130 };
    const clip = { top: 0, bottom };
    const p = placeList(anchor, clip, WANTED);
    if (!p.up) {
      // The 8px edge keeps the border off the pane's own edge.
      assert(130 + 4 + p.maxHeight <= bottom - 8, `down fits in ${bottom}`);
    } else {
      assert(100 - 4 - p.maxHeight >= 8, `up fits in ${bottom}`);
    }
  }
});

Deno.test("placement: little room below but more above opens up", () => {
  const p = placeList(
    { top: 400, bottom: 430 },
    { top: 0, bottom: 480 },
    WANTED,
  );
  assertEquals(p.up, true);
  assertEquals(p.maxHeight, 288);
});

Deno.test("placement: the taller side wins when neither fits", () => {
  const above = placeList(
    { top: 150, bottom: 180 },
    { top: 0, bottom: 200 },
    WANTED,
  );
  assertEquals(above, { up: true, maxHeight: 138 });
  const below = placeList(
    { top: 20, bottom: 50 },
    { top: 0, bottom: 200 },
    WANTED,
  );
  assertEquals(below, { up: false, maxHeight: 138 });
});

Deno.test("placement: an anchor outside the clip area gets no height, not a negative one", () => {
  const p = placeList(
    { top: 500, bottom: 530 },
    { top: 0, bottom: 300 },
    WANTED,
  );
  assertEquals(p.maxHeight >= 0, true);
});
