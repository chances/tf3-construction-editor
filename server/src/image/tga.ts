import {
  ImageFormatError,
  newImage,
  type RgbaImage,
  UnsupportedImageError,
} from "./types.ts";

/**
 * Decodes true-color and grayscale TGA files: image types 2 and 3, and their
 * run-length encoded forms 10 and 11. Color-mapped files are not supported.
 */
export function decodeTga(bytes: Uint8Array): RgbaImage {
  if (bytes.length < 18) {
    throw new ImageFormatError("The TGA header is cut off.");
  }
  const idLength = bytes[0];
  const colorMapType = bytes[1];
  const imageType = bytes[2];
  const width = bytes[12] | (bytes[13] << 8);
  const height = bytes[14] | (bytes[15] << 8);
  const bpp = bytes[16];
  const descriptor = bytes[17];

  if (colorMapType !== 0 || ![2, 3, 10, 11].includes(imageType)) {
    throw new UnsupportedImageError(
      `TGA image type ${imageType}${
        colorMapType !== 0 ? " with a color map" : ""
      } is not supported.`,
    );
  }
  const gray = imageType === 3 || imageType === 11;
  if (gray ? bpp !== 8 : bpp !== 24 && bpp !== 32) {
    throw new UnsupportedImageError(
      `TGA with ${bpp} bits per pixel is not supported.`,
    );
  }
  const bytesPerPixel = bpp / 8;
  const image = newImage(width, height);
  const total = width * height;
  const pixels = new Uint8Array(total * bytesPerPixel);

  let at = 18 + idLength;
  if (imageType === 2 || imageType === 3) {
    if (bytes.length - at < pixels.length) {
      throw new ImageFormatError("The TGA pixel data is cut off.");
    }
    pixels.set(bytes.subarray(at, at + pixels.length));
  } else {
    let out = 0;
    while (out < pixels.length) {
      if (at >= bytes.length) {
        throw new ImageFormatError("The TGA pixel data is cut off.");
      }
      const packet = bytes[at++];
      const count = (packet & 0x7f) + 1;
      const size = count * bytesPerPixel;
      if (packet & 0x80) {
        const value = bytes.subarray(at, at + bytesPerPixel);
        at += bytesPerPixel;
        for (let i = 0; i < count && out < pixels.length; i++) {
          pixels.set(value, out);
          out += bytesPerPixel;
        }
      } else {
        pixels.set(bytes.subarray(at, at + size), out);
        at += size;
        out += size;
      }
    }
  }

  const topDown = (descriptor & 0x20) !== 0;
  const rightToLeft = (descriptor & 0x10) !== 0;
  for (let y = 0; y < height; y++) {
    const srcY = topDown ? y : height - 1 - y;
    for (let x = 0; x < width; x++) {
      const srcX = rightToLeft ? width - 1 - x : x;
      const s = (srcY * width + srcX) * bytesPerPixel;
      const d = (y * width + x) * 4;
      if (gray) {
        image.data[d] = image.data[d + 1] = image.data[d + 2] = pixels[s];
        image.data[d + 3] = 255;
      } else {
        image.data[d] = pixels[s + 2];
        image.data[d + 1] = pixels[s + 1];
        image.data[d + 2] = pixels[s];
        image.data[d + 3] = bytesPerPixel === 4 ? pixels[s + 3] : 255;
      }
    }
  }
  return image;
}
