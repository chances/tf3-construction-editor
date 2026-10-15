/** Decoded pixels, rows top to bottom, four bytes per pixel as R, G, B, A. */
export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8Array;
}

/** The file is a valid image in a format the decoders do not handle. */
export class UnsupportedImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedImageError";
  }
}

/** The bytes are not a well-formed image of the format they claim. */
export class ImageFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageFormatError";
  }
}

export function newImage(width: number, height: number): RgbaImage {
  if (width <= 0 || height <= 0 || width * height > 64 * 1024 * 1024) {
    throw new ImageFormatError(`Bad image size ${width} by ${height}.`);
  }
  return { width, height, data: new Uint8Array(width * height * 4) };
}
