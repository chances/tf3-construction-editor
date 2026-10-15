import {
  ImageFormatError,
  newImage,
  type RgbaImage,
  UnsupportedImageError,
} from "./types.ts";

const MAGIC = 0x20534444; // "DDS "
const DDPF_ALPHAPIXELS = 0x1;
const DDPF_LUMINANCE = 0x20000;

type Kind =
  | "bc1"
  | "bc2"
  | "bc3"
  | "bc4"
  | "bc5"
  | "bgra8"
  | "rgba8"
  | "r8"
  | "masked";

/** DXGI formats from the `DX10` extension header that map to a decoder. */
const DXGI: Record<number, Kind> = {
  71: "bc1",
  72: "bc1",
  74: "bc2",
  75: "bc2",
  77: "bc3",
  78: "bc3",
  80: "bc4",
  83: "bc5",
  87: "bgra8",
  91: "bgra8",
  61: "r8",
  28: "rgba8",
  29: "rgba8",
};

const DXGI_NAMES: Record<number, string> = {
  98: "BC7",
  99: "BC7 (sRGB)",
  95: "BC6H",
  96: "BC6H",
  2: "R32G32B32A32 float",
  10: "R16G16B16A16 float",
};

const FOURCC: Record<string, Kind> = {
  DXT1: "bc1",
  DXT3: "bc2",
  DXT5: "bc3",
  ATI1: "bc4",
  BC4U: "bc4",
  ATI2: "bc5",
  BC5U: "bc5",
};

function rgb565(value: number): [number, number, number] {
  const r = (value >> 11) & 31;
  const g = (value >> 5) & 63;
  const b = value & 31;
  return [(r << 3) | (r >> 2), (g << 2) | (g >> 4), (b << 3) | (b >> 2)];
}

/** Writes one 4 by 4 BC1 color block's pixels, with alpha 255 or 0. */
function bc1Block(
  src: Uint8Array,
  at: number,
  out: Uint8Array,
  x0: number,
  y0: number,
  width: number,
  height: number,
  allowAlpha: boolean,
) {
  const c0 = src[at] | (src[at + 1] << 8);
  const c1 = src[at + 2] | (src[at + 3] << 8);
  const a = rgb565(c0);
  const b = rgb565(c1);
  const palette: number[][] = [[...a, 255], [...b, 255], [], []];
  if (c0 > c1 || !allowAlpha) {
    palette[2] = [
      (2 * a[0] + b[0]) / 3,
      (2 * a[1] + b[1]) / 3,
      (2 * a[2] + b[2]) / 3,
      255,
    ];
    palette[3] = [
      (a[0] + 2 * b[0]) / 3,
      (a[1] + 2 * b[1]) / 3,
      (a[2] + 2 * b[2]) / 3,
      255,
    ];
  } else {
    palette[2] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, 255];
    palette[3] = [0, 0, 0, 0];
  }
  const bits = src[at + 4] | (src[at + 5] << 8) | (src[at + 6] << 16) |
    (src[at + 7] << 24);
  for (let py = 0; py < 4; py++) {
    for (let px = 0; px < 4; px++) {
      const x = x0 + px;
      const y = y0 + py;
      if (x >= width || y >= height) continue;
      const color = palette[(bits >>> (2 * (py * 4 + px))) & 3];
      const d = (y * width + x) * 4;
      out[d] = color[0];
      out[d + 1] = color[1];
      out[d + 2] = color[2];
      out[d + 3] = color[3];
    }
  }
}

/** Decodes one BC4 channel block into 16 values. */
function bc4Values(src: Uint8Array, at: number): number[] {
  const e0 = src[at];
  const e1 = src[at + 1];
  const table: number[] = [e0, e1];
  if (e0 > e1) {
    for (let i = 1; i <= 6; i++) {
      table.push(((7 - i) * e0 + i * e1) / 7);
    }
  } else {
    for (let i = 1; i <= 4; i++) {
      table.push(((5 - i) * e0 + i * e1) / 5);
    }
    table.push(0, 255);
  }
  let lo = src[at + 2] | (src[at + 3] << 8) | (src[at + 4] << 16);
  let hi = src[at + 5] | (src[at + 6] << 8) | (src[at + 7] << 16);
  const values: number[] = [];
  for (let i = 0; i < 8; i++) {
    values.push(table[lo & 7]);
    lo >>>= 3;
  }
  for (let i = 0; i < 8; i++) {
    values.push(table[hi & 7]);
    hi >>>= 3;
  }
  return values;
}

function decodeBlocks(
  kind: "bc1" | "bc2" | "bc3" | "bc4" | "bc5",
  src: Uint8Array,
  width: number,
  height: number,
): RgbaImage {
  const image = newImage(width, height);
  const blockBytes = kind === "bc1" || kind === "bc4" ? 8 : 16;
  const blocksX = Math.ceil(width / 4);
  const blocksY = Math.ceil(height / 4);
  if (src.length < blocksX * blocksY * blockBytes) {
    throw new ImageFormatError("The DDS pixel data is cut off.");
  }
  let at = 0;
  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      const x0 = bx * 4;
      const y0 = by * 4;
      if (kind === "bc1") {
        bc1Block(src, at, image.data, x0, y0, width, height, true);
      } else if (kind === "bc2" || kind === "bc3") {
        bc1Block(src, at + 8, image.data, x0, y0, width, height, false);
        const alpha = kind === "bc3" ? bc4Values(src, at) : null;
        for (let i = 0; i < 16; i++) {
          const x = x0 + (i & 3);
          const y = y0 + (i >> 2);
          if (x >= width || y >= height) continue;
          const a = alpha
            ? alpha[i]
            : ((src[at + (i >> 1)] >> ((i & 1) * 4)) & 15) * 17;
          image.data[(y * width + x) * 4 + 3] = a;
        }
      } else if (kind === "bc4") {
        const v = bc4Values(src, at);
        for (let i = 0; i < 16; i++) {
          const x = x0 + (i & 3);
          const y = y0 + (i >> 2);
          if (x >= width || y >= height) continue;
          const d = (y * width + x) * 4;
          image.data[d] = image.data[d + 1] = image.data[d + 2] = v[i];
          image.data[d + 3] = 255;
        }
      } else {
        const r = bc4Values(src, at);
        const g = bc4Values(src, at + 8);
        for (let i = 0; i < 16; i++) {
          const x = x0 + (i & 3);
          const y = y0 + (i >> 2);
          if (x >= width || y >= height) continue;
          const nx = (r[i] / 255) * 2 - 1;
          const ny = (g[i] / 255) * 2 - 1;
          const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
          const d = (y * width + x) * 4;
          image.data[d] = r[i];
          image.data[d + 1] = g[i];
          image.data[d + 2] = Math.round((nz * 0.5 + 0.5) * 255);
          image.data[d + 3] = 255;
        }
      }
      at += blockBytes;
    }
  }
  return image;
}

function shiftOf(mask: number): number {
  if (mask === 0) return -1;
  let shift = 0;
  while (((mask >>> shift) & 1) === 0) shift++;
  return shift;
}

/** Bytes of one mip level, for a block format or a per-pixel format. */
function mipBytes(
  width: number,
  height: number,
  blockBytes: number,
  bytesPerPixel: number,
): number {
  return blockBytes > 0
    ? Math.ceil(width / 4) * Math.ceil(height / 4) * blockBytes
    : width * height * bytesPerPixel;
}

/**
 * Picks the mip to decode. It is the smallest level whose longer side is still
 * at least `minSize`, so a thumbnail never reads a level too small to be
 * legible and never reads a bigger one than it needs. With no `minSize` the
 * full-size level 0 is used.
 */
export function chooseMip(
  width: number,
  height: number,
  levels: number,
  minSize?: number,
): number {
  if (minSize === undefined) return 0;
  const longest = Math.max(width, height);
  let level = 0;
  for (let i = 1; i < levels; i++) {
    if (Math.max(1, longest >> i) < minSize) break;
    level = i;
  }
  return level;
}

/**
 * Decodes a DDS file. Block formats BC1 to BC5 and the common 8, 24, and 32
 * bit uncompressed layouts are supported. BC7 and float formats raise
 * `UnsupportedImageError`. `minSize` asks for the smallest mip whose longer
 * side is at least that many pixels. Without it the result is mip 0.
 */
export function decodeDds(bytes: Uint8Array, minSize?: number): RgbaImage {
  if (bytes.length < 128) {
    throw new ImageFormatError("The DDS header is cut off.");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== MAGIC) {
    throw new ImageFormatError("The file does not start with the DDS marker.");
  }
  const fullHeight = view.getUint32(12, true);
  const fullWidth = view.getUint32(16, true);
  const hasMips = (view.getUint32(8, true) & 0x20000) !== 0;
  const levels = hasMips ? Math.max(1, view.getUint32(28, true)) : 1;
  const pfFlags = view.getUint32(80, true);
  const fourCC = new TextDecoder().decode(bytes.subarray(84, 88));
  const bitCount = view.getUint32(88, true);
  const masks = [
    view.getUint32(92, true),
    view.getUint32(96, true),
    view.getUint32(100, true),
    view.getUint32(104, true),
  ];

  let kind: Kind | undefined;
  let dataStart = 128;
  if (fourCC === "DX10") {
    if (bytes.length < 148) {
      throw new ImageFormatError("The DDS header is cut off.");
    }
    const dxgi = view.getUint32(128, true);
    dataStart = 148;
    kind = DXGI[dxgi];
    if (!kind) {
      throw new UnsupportedImageError(
        `DDS format ${DXGI_NAMES[dxgi] ?? `DXGI ${dxgi}`} is not supported.`,
      );
    }
  } else if (FOURCC[fourCC]) {
    kind = FOURCC[fourCC];
  } else if (pfFlags & 0x4) {
    throw new UnsupportedImageError(`DDS format ${fourCC} is not supported.`);
  } else if (bitCount === 8 || bitCount === 24 || bitCount === 32) {
    kind = "masked";
  } else {
    throw new UnsupportedImageError(
      `DDS with ${bitCount} bits per pixel is not supported.`,
    );
  }

  const isBlock = kind === "bc1" || kind === "bc2" || kind === "bc3" ||
    kind === "bc4" || kind === "bc5";
  const blockBytes = !isBlock ? 0 : kind === "bc1" || kind === "bc4" ? 8 : 16;
  const bytesPer = kind === "r8" || (kind === "masked" && bitCount === 8)
    ? 1
    : kind === "masked"
    ? bitCount / 8
    : 4;

  // Skip the larger levels. They sit one after another from the data start.
  const level = chooseMip(fullWidth, fullHeight, levels, minSize);
  let offset = dataStart;
  for (let i = 0; i < level; i++) {
    offset += mipBytes(
      Math.max(1, fullWidth >> i),
      Math.max(1, fullHeight >> i),
      blockBytes,
      bytesPer,
    );
  }
  const width = Math.max(1, fullWidth >> level);
  const height = Math.max(1, fullHeight >> level);
  const src = bytes.subarray(Math.min(offset, bytes.length));
  if (isBlock) {
    return decodeBlocks(
      kind as "bc1" | "bc2" | "bc3" | "bc4" | "bc5",
      src,
      width,
      height,
    );
  }

  const image = newImage(width, height);
  if (src.length < width * height * bytesPer) {
    throw new ImageFormatError("The DDS pixel data is cut off.");
  }
  const shifts = masks.map(shiftOf);
  const luminance = (pfFlags & DDPF_LUMINANCE) !== 0;
  const hasAlpha = (pfFlags & DDPF_ALPHAPIXELS) !== 0 && shifts[3] >= 0;
  for (let i = 0; i < width * height; i++) {
    const s = i * bytesPer;
    const d = i * 4;
    if (kind === "r8" || (kind === "masked" && bytesPer === 1)) {
      const alphaOnly = kind === "masked" && !luminance && hasAlpha;
      image.data[d] = image.data[d + 1] = image.data[d + 2] = alphaOnly
        ? 255
        : src[s];
      image.data[d + 3] = alphaOnly ? src[s] : 255;
    } else if (kind === "bgra8") {
      image.data[d] = src[s + 2];
      image.data[d + 1] = src[s + 1];
      image.data[d + 2] = src[s];
      image.data[d + 3] = src[s + 3];
    } else if (kind === "rgba8") {
      image.data.set(src.subarray(s, s + 4), d);
    } else {
      let value = 0;
      for (let k = 0; k < bytesPer; k++) value |= src[s + k] << (8 * k);
      value >>>= 0;
      const channel = (n: number) =>
        shifts[n] < 0 ? 0 : (value >>> shifts[n]) & 0xff;
      image.data[d] = channel(0);
      image.data[d + 1] = channel(1);
      image.data[d + 2] = channel(2);
      image.data[d + 3] = hasAlpha ? channel(3) : 255;
    }
  }
  return image;
}
