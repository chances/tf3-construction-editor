import { assertEquals, assertThrows } from "jsr:@std/assert@^1";
import { decodeTga } from "./tga.ts";
import { UnsupportedImageError } from "./types.ts";

function header(
  type: number,
  width: number,
  height: number,
  bpp: number,
  descriptor = 0,
  colorMapType = 0,
): number[] {
  const h = new Array(18).fill(0);
  h[1] = colorMapType;
  h[2] = type;
  h[12] = width & 0xff;
  h[13] = width >> 8;
  h[14] = height & 0xff;
  h[15] = height >> 8;
  h[16] = bpp;
  h[17] = descriptor;
  return h;
}

Deno.test("tga: a bottom-up 24 bit image is flipped to top-down RGB", () => {
  // Rows are stored bottom first: red green, then blue white.
  const bytes = new Uint8Array([
    ...header(2, 2, 2, 24),
    0,
    0,
    255,
    0,
    255,
    0, // bottom row as B G R: red, green
    255,
    0,
    0,
    255,
    255,
    255, // top row: blue, white
  ]);
  const image = decodeTga(bytes);
  assertEquals([image.width, image.height], [2, 2]);
  assertEquals([...image.data.subarray(0, 4)], [0, 0, 255, 255]); // blue
  assertEquals([...image.data.subarray(4, 8)], [255, 255, 255, 255]); // white
  assertEquals([...image.data.subarray(8, 12)], [255, 0, 0, 255]); // red
  assertEquals([...image.data.subarray(12, 16)], [0, 255, 0, 255]); // green
});

Deno.test("tga: an 8 bit grayscale image becomes gray RGB", () => {
  const bytes = new Uint8Array([...header(3, 2, 1, 8, 0x20), 10, 200]);
  const image = decodeTga(bytes);
  assertEquals([...image.data], [10, 10, 10, 255, 200, 200, 200, 255]);
});

Deno.test("tga: a 32 bit image keeps its alpha", () => {
  const bytes = new Uint8Array([...header(2, 1, 1, 32, 0x20), 1, 2, 3, 77]);
  assertEquals([...decodeTga(bytes).data], [3, 2, 1, 77]);
});

Deno.test("tga: run-length packets expand", () => {
  // One run packet of 3 pixels, then one raw packet of 1 pixel.
  const bytes = new Uint8Array([
    ...header(10, 4, 1, 24, 0x20),
    0x82,
    0,
    0,
    255,
    0x00,
    255,
    0,
    0,
  ]);
  const image = decodeTga(bytes);
  assertEquals([...image.data.subarray(0, 4)], [255, 0, 0, 255]);
  assertEquals([...image.data.subarray(8, 12)], [255, 0, 0, 255]);
  assertEquals([...image.data.subarray(12, 16)], [0, 0, 255, 255]);
});

Deno.test("tga: a color-mapped image is reported as unsupported", () => {
  const bytes = new Uint8Array([...header(1, 1, 1, 8, 0, 1), 0]);
  assertThrows(() => decodeTga(bytes), UnsupportedImageError, "type 1");
});
