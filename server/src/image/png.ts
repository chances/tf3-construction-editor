import {
  ImageFormatError,
  newImage,
  type RgbaImage,
  UnsupportedImageError,
} from "./types.ts";

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

async function transform(
  bytes: Uint8Array,
  stream: CompressionStream | DecompressionStream,
): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  const done = writer.write(bytes as BufferSource).then(() => writer.close());
  const out = await new Response(stream.readable).arrayBuffer();
  await done;
  return new Uint8Array(out);
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(parts: Uint8Array[]): number {
  let c = 0xffffffff;
  for (const part of parts) {
    for (let i = 0; i < part.length; i++) {
      c = crcTable[(c ^ part[i]) & 0xff] ^ (c >>> 8);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  const name = new TextEncoder().encode(type);
  out.set(name, 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32([name, data]));
  return out;
}

/** Encodes 8 bit RGBA pixels as a PNG with no row filtering. */
export async function encodePng(image: RgbaImage): Promise<Uint8Array> {
  const { width, height, data } = image;
  const raw = new Uint8Array((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw.set(
      data.subarray(y * width * 4, (y + 1) * width * 4),
      y * (width * 4 + 1) + 1,
    );
  }
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const idat = await transform(raw, new CompressionStream("deflate"));
  const parts = [
    new Uint8Array(SIGNATURE),
    chunk("IHDR", header),
    chunk("IDAT", idat),
    chunk("IEND", new Uint8Array(0)),
  ];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Decodes non-interlaced PNG files of bit depth 8 or 16, and palettes. */
export async function decodePng(bytes: Uint8Array): Promise<RgbaImage> {
  if (bytes.length < 33 || SIGNATURE.some((v, i) => bytes[i] !== v)) {
    throw new ImageFormatError("The file does not start with the PNG marker.");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0;
  let height = 0;
  let depth = 0;
  let colorType = 0;
  let interlace = 0;
  let palette: Uint8Array | null = null;
  let transparency: Uint8Array | null = null;
  const idat: Uint8Array[] = [];
  let at = 8;
  while (at + 8 <= bytes.length) {
    const length = view.getUint32(at);
    const type = new TextDecoder().decode(bytes.subarray(at + 4, at + 8));
    const body = bytes.subarray(at + 8, at + 8 + length);
    if (type === "IHDR") {
      width = view.getUint32(at + 8);
      height = view.getUint32(at + 12);
      depth = body[8];
      colorType = body[9];
      interlace = body[12];
    } else if (type === "PLTE") palette = body;
    else if (type === "tRNS") transparency = body;
    else if (type === "IDAT") idat.push(body);
    else if (type === "IEND") break;
    at += 12 + length;
  }
  if (interlace !== 0) {
    throw new UnsupportedImageError("Interlaced PNG is not supported.");
  }
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (!channels || ![1, 2, 4, 8, 16].includes(depth)) {
    throw new UnsupportedImageError(
      `PNG color type ${colorType} at ${depth} bits is not supported.`,
    );
  }
  if (colorType === 3 && !palette) {
    throw new ImageFormatError("The PNG palette is missing.");
  }
  const joined = new Uint8Array(idat.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of idat) {
    joined.set(part, offset);
    offset += part.length;
  }
  const raw = await transform(joined, new DecompressionStream("deflate"));
  const bitsPerPixel = channels * depth;
  const stride = Math.ceil((width * bitsPerPixel) / 8);
  const step = Math.max(1, bitsPerPixel >> 3);
  if (raw.length < (stride + 1) * height) {
    throw new ImageFormatError("The PNG pixel data is cut off.");
  }
  const rows = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const left = x >= step ? rows[dst + x - step] : 0;
      const up = y > 0 ? rows[dst - stride + x] : 0;
      const upLeft = y > 0 && x >= step ? rows[dst - stride + x - step] : 0;
      const value = raw[src + x];
      rows[dst + x] = filter === 0
        ? value
        : filter === 1
        ? value + left
        : filter === 2
        ? value + up
        : filter === 3
        ? value + ((left + up) >> 1)
        : value + paeth(left, up, upLeft);
    }
  }

  const image = newImage(width, height);
  const sample = (y: number, index: number): number => {
    if (depth === 8) return rows[y * stride + index];
    if (depth === 16) return rows[y * stride + index * 2];
    const bit = index * depth;
    const byte = rows[y * stride + (bit >> 3)];
    return (byte >> (8 - depth - (bit & 7))) & ((1 << depth) - 1);
  };
  const scale = depth < 8 ? 255 / ((1 << depth) - 1) : 1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const d = (y * width + x) * 4;
      const i = x * channels;
      if (colorType === 3) {
        const p = sample(y, x);
        image.data[d] = palette![p * 3];
        image.data[d + 1] = palette![p * 3 + 1];
        image.data[d + 2] = palette![p * 3 + 2];
        image.data[d + 3] = transparency && p < transparency.length
          ? transparency[p]
          : 255;
      } else if (colorType === 0 || colorType === 4) {
        const g = Math.round(sample(y, i) * scale);
        image.data[d] = image.data[d + 1] = image.data[d + 2] = g;
        image.data[d + 3] = colorType === 4 ? sample(y, i + 1) : 255;
      } else {
        image.data[d] = sample(y, i);
        image.data[d + 1] = sample(y, i + 1);
        image.data[d + 2] = sample(y, i + 2);
        image.data[d + 3] = colorType === 6 ? sample(y, i + 3) : 255;
      }
    }
  }
  return image;
}
