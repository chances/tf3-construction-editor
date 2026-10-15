import { assert, assertEquals, assertRejects } from "jsr:@std/assert@^1";
import { decodePng, encodePng } from "./png.ts";
import {
  clampThumbnailSize,
  fitWithin,
  imageFormat,
  makeThumbnail,
} from "./thumbnail.ts";
import { ImageFormatError, type RgbaImage } from "./types.ts";

function solid(width: number, height: number, rgba: number[]): RgbaImage {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) data.set(rgba, i * 4);
  return { width, height, data };
}

Deno.test("png: encoding then decoding keeps every pixel", async () => {
  const image: RgbaImage = {
    width: 3,
    height: 2,
    data: new Uint8Array([
      ...[255, 0, 0, 255, 0, 255, 0, 128, 0, 0, 255, 0],
      ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    ]),
  };
  const back = await decodePng(await encodePng(image));
  assertEquals([back.width, back.height], [3, 2]);
  assertEquals([...back.data], [...image.data]);
});

Deno.test("png: bytes without the marker are a format error", async () => {
  await assertRejects(
    () => decodePng(new Uint8Array(64)),
    ImageFormatError,
    "PNG marker",
  );
});

Deno.test("thumbnail: the longer side is scaled to the size", () => {
  const out = fitWithin(solid(8, 4, [10, 20, 30, 255]), 4);
  assertEquals([out.width, out.height], [4, 2]);
  assertEquals([...out.data.subarray(0, 4)], [10, 20, 30, 255]);
});

Deno.test("thumbnail: a small image is never enlarged", () => {
  const image = solid(4, 4, [1, 2, 3, 255]);
  assertEquals(fitWithin(image, 64), image);
});

Deno.test("thumbnail: transparent pixels do not tint their neighbours", () => {
  const image: RgbaImage = {
    width: 2,
    height: 1,
    data: new Uint8Array([200, 100, 50, 255, 0, 0, 0, 0]),
  };
  const out = fitWithin(image, 1);
  assertEquals([...out.data], [200, 100, 50, 128]);
});

Deno.test("thumbnail: the size is clamped to 16 through 256", () => {
  assertEquals(clampThumbnailSize(4), 16);
  assertEquals(clampThumbnailSize(1000), 256);
  assertEquals(clampThumbnailSize(Number.NaN), 64);
});

Deno.test("thumbnail: the format comes from the file name", () => {
  assertEquals(imageFormat("/a/B.TGA"), "tga");
  assertEquals(imageFormat("x.dds"), "dds");
  assertEquals(imageFormat("x.png"), "png");
  assertEquals(imageFormat("x.mdl"), null);
});

Deno.test("thumbnail: a TGA becomes a PNG within the size", async () => {
  const header = new Array(18).fill(0);
  header[2] = 2;
  header[12] = 32;
  header[14] = 32;
  header[16] = 24;
  header[17] = 0x20;
  const pixels = new Array(32 * 32 * 3).fill(128);
  const png = await makeThumbnail(
    new Uint8Array([...header, ...pixels]),
    "/ui/test.tga",
    16,
  );
  assert(png[0] === 137 && png[1] === 80, "starts with the PNG marker");
  const back = await decodePng(png);
  assertEquals([back.width, back.height], [16, 16]);
});
