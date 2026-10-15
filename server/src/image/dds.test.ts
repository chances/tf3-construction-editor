import { assertEquals, assertThrows } from "jsr:@std/assert@^1";
import { chooseMip, decodeDds } from "./dds.ts";
import { ImageFormatError, UnsupportedImageError } from "./types.ts";

interface Layout {
  fourCC?: string;
  dxgi?: number;
  flags?: number;
  bitCount?: number;
  masks?: [number, number, number, number];
  /** Number of mip levels stored in the data. Omit for a single level. */
  mips?: number;
}

function dds(width: number, height: number, layout: Layout, data: number[]) {
  const dx10 = layout.fourCC === "DX10";
  const out = new Uint8Array(128 + (dx10 ? 20 : 0) + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x20534444, true);
  view.setUint32(4, 124, true);
  if (layout.mips !== undefined) {
    view.setUint32(8, 0x20000, true); // DDSD_MIPMAPCOUNT
    view.setUint32(28, layout.mips, true);
  }
  view.setUint32(12, height, true);
  view.setUint32(16, width, true);
  view.setUint32(76, 32, true);
  view.setUint32(80, layout.flags ?? (layout.fourCC ? 0x4 : 0x41), true);
  if (layout.fourCC) out.set(new TextEncoder().encode(layout.fourCC), 84);
  view.setUint32(88, layout.bitCount ?? 0, true);
  const masks = layout.masks ?? [0, 0, 0, 0];
  masks.forEach((m, i) => view.setUint32(92 + i * 4, m, true));
  if (dx10) view.setUint32(128, layout.dxgi ?? 0, true);
  out.set(data, 128 + (dx10 ? 20 : 0));
  return out;
}

const pixel = (image: { data: Uint8Array }, i: number) => [
  ...image.data.subarray(i * 4, i * 4 + 4),
];

Deno.test("dds: a BC1 block of one color", () => {
  // c0 pure red (565), c1 pure blue, every index 0.
  const block = [0x00, 0xf8, 0x1f, 0x00, 0, 0, 0, 0];
  const image = decodeDds(dds(4, 4, { fourCC: "DXT1" }, block));
  assertEquals(pixel(image, 0), [255, 0, 0, 255]);
  assertEquals(pixel(image, 15), [255, 0, 0, 255]);
});

Deno.test("dds: BC1 index 3 is transparent when c0 is not above c1", () => {
  const block = [0x00, 0x00, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff];
  const image = decodeDds(dds(4, 4, { fourCC: "DXT1" }, block));
  assertEquals(pixel(image, 0)[3], 0);
});

Deno.test("dds: BC3 takes alpha from the alpha block", () => {
  const alpha = [100, 100, 0, 0, 0, 0, 0, 0];
  const color = [0xe0, 0x07, 0xe0, 0x07, 0, 0, 0, 0]; // green
  const image = decodeDds(dds(4, 4, { fourCC: "DXT5" }, [...alpha, ...color]));
  assertEquals(pixel(image, 0), [0, 255, 0, 100]);
});

Deno.test("dds: BC4 is a gray image", () => {
  const block = [200, 0, 0, 0, 0, 0, 0, 0];
  const image = decodeDds(dds(4, 4, { fourCC: "ATI1" }, block));
  assertEquals(pixel(image, 5), [200, 200, 200, 255]);
});

Deno.test("dds: BC5 keeps red and green and rebuilds blue", () => {
  const r = [255, 255, 0, 0, 0, 0, 0, 0];
  const g = [128, 128, 0, 0, 0, 0, 0, 0];
  const image = decodeDds(dds(4, 4, { fourCC: "ATI2" }, [...r, ...g]));
  const [red, green, , alpha] = pixel(image, 0);
  assertEquals([red, green, alpha], [255, 128, 255]);
});

Deno.test("dds: the DX10 header maps BC1 and R8", () => {
  const bc1 = [0x00, 0xf8, 0x1f, 0x00, 0, 0, 0, 0];
  const a = decodeDds(dds(4, 4, { fourCC: "DX10", dxgi: 71 }, bc1));
  assertEquals(pixel(a, 0), [255, 0, 0, 255]);
  const r8 = new Array(16).fill(90);
  const b = decodeDds(dds(4, 4, { fourCC: "DX10", dxgi: 61 }, r8));
  assertEquals(pixel(b, 0), [90, 90, 90, 255]);
});

Deno.test("dds: BC7 is reported as unsupported with its name", () => {
  const file = dds(4, 4, { fourCC: "DX10", dxgi: 98 }, new Array(16).fill(0));
  assertThrows(() => decodeDds(file), UnsupportedImageError, "BC7");
});

Deno.test("dds: a 32 bit masked layout reads channels by mask", () => {
  const file = dds(
    1,
    1,
    {
      bitCount: 32,
      masks: [0x00ff0000, 0x0000ff00, 0x000000ff, 0xff000000],
    },
    [30, 20, 10, 200], // B G R A in memory
  );
  assertEquals(pixel(decodeDds(file), 0), [10, 20, 30, 200]);
});

/** A BC1 block whose every pixel is the 565 color `c`. */
const solidBlock = (c: number) => [
  c & 0xff,
  c >> 8,
  0,
  0,
  0,
  0,
  0,
  0,
];

/** 16x16, 8x8, and 4x4 BC1 levels: red, green, and blue. */
function threeLevels(): Uint8Array {
  const red = 0xf800;
  const green = 0x07e0;
  const blue = 0x001f;
  const level16 = Array.from({ length: 16 }, () => solidBlock(red)).flat();
  const level8 = Array.from({ length: 4 }, () => solidBlock(green)).flat();
  const level4 = solidBlock(blue);
  return dds(16, 16, { fourCC: "DXT1", mips: 3 }, [
    ...level16,
    ...level8,
    ...level4,
  ]);
}

Deno.test("dds: mip choice is the smallest level at least the wanted size", () => {
  assertEquals(chooseMip(1024, 512, 11, undefined), 0);
  assertEquals(chooseMip(1024, 512, 11, 64), 4); // 1024 >> 4 = 64
  assertEquals(chooseMip(1024, 512, 11, 65), 3); // 128
  assertEquals(chooseMip(1024, 512, 11, 5000), 0);
  assertEquals(chooseMip(1024, 512, 3, 1), 2); // only three levels stored
  assertEquals(chooseMip(256, 256, 1, 16), 0);
});

Deno.test("dds: no minimum size decodes the full level", () => {
  const image = decodeDds(threeLevels());
  assertEquals([image.width, image.height], [16, 16]);
  assertEquals(pixel(image, 0), [255, 0, 0, 255]);
});

Deno.test("dds: a wanted size picks the smallest level that is still big enough", () => {
  const eight = decodeDds(threeLevels(), 8);
  assertEquals([eight.width, eight.height], [8, 8]);
  assertEquals(pixel(eight, 0), [0, 255, 0, 255]);

  const four = decodeDds(threeLevels(), 4);
  assertEquals([four.width, four.height], [4, 4]);
  assertEquals(pixel(four, 0), [0, 0, 255, 255]);
});

Deno.test("dds: a size between two levels takes the larger one, never the smaller", () => {
  const image = decodeDds(threeLevels(), 6);
  assertEquals([image.width, image.height], [8, 8]);
});

Deno.test("dds: a wanted size above every level takes the full level", () => {
  const image = decodeDds(threeLevels(), 200);
  assertEquals([image.width, image.height], [16, 16]);
});

Deno.test("dds: uncompressed levels are skipped by their byte size", () => {
  // 4x4 then 2x2 then 1x1, 32 bit. Level 0 is all 10, level 1 all 20.
  const masks: [number, number, number, number] = [
    0x00ff0000,
    0x0000ff00,
    0x000000ff,
    0xff000000,
  ];
  const level = (v: number, n: number) =>
    Array.from({ length: n }, () => [v, v, v, 255]).flat();
  const file = dds(
    4,
    4,
    { bitCount: 32, masks, mips: 3 },
    [...level(10, 16), ...level(20, 4), ...level(30, 1)],
  );
  const image = decodeDds(file, 2);
  assertEquals([image.width, image.height], [2, 2]);
  assertEquals(pixel(image, 0), [20, 20, 20, 255]);
});

Deno.test("dds: a file that ends before the wanted level is a format error", () => {
  const whole = threeLevels();
  const cut = whole.subarray(0, 128 + 4);
  assertThrows(() => decodeDds(cut, 8), ImageFormatError, "cut off");
});

Deno.test("dds: a file without the marker is a format error", () => {
  assertThrows(
    () => decodeDds(new Uint8Array(140)),
    ImageFormatError,
    "DDS marker",
  );
});
