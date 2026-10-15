import { decodeDds } from "./dds.ts";
import { decodePng, encodePng } from "./png.ts";
import { decodeTga } from "./tga.ts";
import { newImage, type RgbaImage, UnsupportedImageError } from "./types.ts";

export const MIN_THUMBNAIL = 16;
export const MAX_THUMBNAIL = 256;

export type ImageFormat = "tga" | "dds" | "png";

export function imageFormat(name: string): ImageFormat | null {
  const match = name.toLowerCase().match(/\.(tga|dds|png)$/);
  return match ? (match[1] as ImageFormat) : null;
}

/**
 * Decodes an image file. For a DDS with mip levels, `minSize` picks the
 * smallest level whose longer side is at least that many pixels.
 */
export async function decodeImage(
  bytes: Uint8Array,
  name: string,
  minSize?: number,
): Promise<RgbaImage> {
  switch (imageFormat(name)) {
    case "tga":
      return decodeTga(bytes);
    case "dds":
      return decodeDds(bytes, minSize);
    case "png":
      return await decodePng(bytes);
    default:
      throw new UnsupportedImageError(
        `${name} is not a TGA, DDS, or PNG file.`,
      );
  }
}

/** Box-filter downscale so the longer side is at most `size`. Never upscales. */
export function fitWithin(image: RgbaImage, size: number): RgbaImage {
  const scale = Math.min(1, size / Math.max(image.width, image.height));
  if (scale === 1) return image;
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const out = newImage(width, height);
  for (let y = 0; y < height; y++) {
    const y0 = Math.floor((y * image.height) / height);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * image.height) / height));
    for (let x = 0; x < width; x++) {
      const x0 = Math.floor((x * image.width) / width);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * image.width) / width));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const s = (sy * image.width + sx) * 4;
          const alpha = image.data[s + 3];
          r += image.data[s] * alpha;
          g += image.data[s + 1] * alpha;
          b += image.data[s + 2] * alpha;
          a += alpha;
          n++;
        }
      }
      const d = (y * width + x) * 4;
      if (a > 0) {
        out.data[d] = Math.round(r / a);
        out.data[d + 1] = Math.round(g / a);
        out.data[d + 2] = Math.round(b / a);
      }
      out.data[d + 3] = Math.round(a / n);
    }
  }
  return out;
}

export function clampThumbnailSize(size: number): number {
  if (!Number.isFinite(size)) return 64;
  return Math.min(MAX_THUMBNAIL, Math.max(MIN_THUMBNAIL, Math.round(size)));
}

/**
 * Decodes an image file and returns a PNG that fits within `size` pixels. A
 * DDS decodes the smallest mip that is still at least `size` on its longer
 * side, so the thumbnail is downscaled from a level close to its own size and
 * stays sharp.
 */
export async function makeThumbnail(
  bytes: Uint8Array,
  name: string,
  size: number,
): Promise<Uint8Array> {
  const target = clampThumbnailSize(size);
  const image = await decodeImage(bytes, name, target);
  return await encodePng(fitWithin(image, target));
}
