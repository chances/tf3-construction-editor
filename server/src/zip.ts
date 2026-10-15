export class ZipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZipError";
  }
}

export interface ZipEntry {
  name: string;
  /** 0 is stored, 8 is deflate. */
  method: number;
  compressedSize: number;
  size: number;
  localHeaderOffset: number;
  isDirectory: boolean;
}

const EOCD_SIGNATURE = 0x06054b50;
const ZIP64_LOCATOR_SIGNATURE = 0x07064b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const MAX_EOCD_SEARCH = 0xffff + 22;
const LIMIT_32 = 0xffffffff;

async function readRange(
  path: string,
  offset: number,
  length: number,
): Promise<Uint8Array> {
  using file = await Deno.open(path, { read: true });
  await file.seek(offset, Deno.SeekMode.Start);
  const buffer = new Uint8Array(length);
  let filled = 0;
  while (filled < length) {
    const n = await file.read(buffer.subarray(filled));
    if (n === null) throw new ZipError(`${path}: unexpected end of file.`);
    filled += n;
  }
  return buffer;
}

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(
    new DecompressionStream("deflate-raw"),
  );
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Reads a zip through its central directory. Entries are read one at a time,
 * so a large archive is never loaded whole.
 */
export class ZipArchive {
  private constructor(
    readonly path: string,
    readonly entries: ZipEntry[],
  ) {}

  static async open(path: string): Promise<ZipArchive> {
    const { size } = await Deno.stat(path);
    if (size < 22) throw new ZipError(`${path}: not a zip file.`);
    const tailLength = Math.min(size, MAX_EOCD_SEARCH);
    const tailStart = size - tailLength;
    const tail = await readRange(path, tailStart, tailLength);
    const tailView = new DataView(tail.buffer);
    let eocd = -1;
    for (let i = tailLength - 22; i >= 0; i--) {
      if (tailView.getUint32(i, true) === EOCD_SIGNATURE) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) {
      throw new ZipError(`${path}: end of central directory not found.`);
    }
    if (
      eocd >= 20 &&
      tailView.getUint32(eocd - 20, true) === ZIP64_LOCATOR_SIGNATURE
    ) {
      throw new ZipError(`${path}: ZIP64 archives are not supported.`);
    }
    const total = tailView.getUint16(eocd + 10, true);
    const directorySize = tailView.getUint32(eocd + 12, true);
    const directoryOffset = tailView.getUint32(eocd + 16, true);
    if (directoryOffset === LIMIT_32 || directorySize === LIMIT_32) {
      throw new ZipError(`${path}: ZIP64 archives are not supported.`);
    }
    const directory = await readRange(path, directoryOffset, directorySize);
    const view = new DataView(directory.buffer);
    const decoder = new TextDecoder();
    const entries: ZipEntry[] = [];
    let at = 0;
    for (let n = 0; n < total; n++) {
      if (view.getUint32(at, true) !== CENTRAL_SIGNATURE) {
        throw new ZipError(`${path}: bad central directory entry ${n}.`);
      }
      const method = view.getUint16(at + 10, true);
      const compressedSize = view.getUint32(at + 20, true);
      const entrySize = view.getUint32(at + 24, true);
      const nameLength = view.getUint16(at + 28, true);
      const extraLength = view.getUint16(at + 30, true);
      const commentLength = view.getUint16(at + 32, true);
      const localHeaderOffset = view.getUint32(at + 42, true);
      if (
        compressedSize === LIMIT_32 || entrySize === LIMIT_32 ||
        localHeaderOffset === LIMIT_32
      ) {
        throw new ZipError(`${path}: ZIP64 entries are not supported.`);
      }
      const name = decoder.decode(
        directory.subarray(at + 46, at + 46 + nameLength),
      );
      entries.push({
        name,
        method,
        compressedSize,
        size: entrySize,
        localHeaderOffset,
        isDirectory: name.endsWith("/"),
      });
      at += 46 + nameLength + extraLength + commentLength;
    }
    return new ZipArchive(path, entries);
  }

  find(name: string): ZipEntry | undefined {
    return this.entries.find((e) => e.name === name);
  }

  async read(entry: ZipEntry | string): Promise<Uint8Array> {
    const resolved = typeof entry === "string" ? this.find(entry) : entry;
    if (!resolved) throw new ZipError(`${this.path}: no entry ${entry}.`);
    const header = await readRange(this.path, resolved.localHeaderOffset, 30);
    const view = new DataView(header.buffer);
    if (view.getUint32(0, true) !== LOCAL_SIGNATURE) {
      throw new ZipError(
        `${this.path}: bad local header for ${resolved.name}.`,
      );
    }
    const dataStart = resolved.localHeaderOffset + 30 +
      view.getUint16(26, true) + view.getUint16(28, true);
    const raw = await readRange(this.path, dataStart, resolved.compressedSize);
    if (resolved.method === 0) return raw;
    if (resolved.method === 8) return await inflate(raw);
    throw new ZipError(
      `${this.path}: ${resolved.name} uses unsupported method ${resolved.method}.`,
    );
  }

  async readText(entry: ZipEntry | string): Promise<string> {
    return new TextDecoder().decode(await this.read(entry));
  }
}
