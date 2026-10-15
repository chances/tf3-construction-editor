import { dirname, join, relative, SEPARATOR } from "jsr:@std/path@^1";
import type { ModJson } from "@cedit/schema";
import { type AssetEntry } from "./assets.ts";
import { type ImageFormat, imageFormat } from "./image/thumbnail.ts";
import { listMods, modDir } from "./mods.ts";
import { ZipArchive, ZipError } from "./zip.ts";

export interface ImageEntry extends AssetEntry {
  format: ImageFormat;
  /** True when the entry reads from a `@2x` file, so no base file exists. */
  hires?: boolean;
}

/**
 * The id without a `@2x` resolution suffix: `/gui/a@2x.tga` is `/gui/a.tga`.
 * The game's own files write the base name and ship only the `@2x` file.
 */
export function canonicalImageId(id: string): string {
  return id.replace(/@2x(?=\.[^./]*$)/i, "").replace(/@2x$/i, "");
}

function posix(path: string): string {
  return path.split(SEPARATOR).join("/");
}

async function* walk(dir: string): AsyncGenerator<string> {
  let items: Deno.DirEntry[];
  try {
    items = [];
    for await (const item of Deno.readDir(dir)) items.push(item);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return;
    throw error;
  }
  items.sort((a, b) => a.name.localeCompare(b.name));
  for (const item of items) {
    const full = join(dir, item.name);
    if (item.isDirectory) yield* walk(full);
    else if (item.isFile) yield full;
  }
}

/** Image ids for one mod folder. The id is `/` plus the path under `content/`. */
export async function indexModImages(
  dir: string,
  source: "mod" | "dependency",
  modId?: string,
): Promise<ImageEntry[]> {
  const contentDir = join(dir, "content");
  const entries: ImageEntry[] = [];
  for await (const file of walk(contentDir)) {
    const format = imageFormat(file);
    if (!format) continue;
    const rel = posix(relative(contentDir, file));
    const entry: ImageEntry = {
      id: source === "mod" ? `/${rel}` : `${modId}::/${rel}`,
      source,
      entry: file,
      format,
    };
    if (modId !== undefined) entry.modId = modId;
    entries.push(entry);
  }
  return entries;
}

/** Image ids for every TGA, DDS, and PNG in the base game zips. */
export async function indexBaseImages(
  installRoot: string,
): Promise<ImageEntry[]> {
  const contentDir = join(installRoot, "base", "content");
  const entries: ImageEntry[] = [];
  for await (const file of walk(contentDir)) {
    if (!file.endsWith(".zip")) continue;
    const folder = posix(dirname(relative(contentDir, file)));
    const prefix = folder === "." ? "" : `${folder}/`;
    let archive: ZipArchive;
    try {
      archive = await ZipArchive.open(file);
    } catch (error) {
      if (error instanceof ZipError) {
        console.warn(`Skipping ${file}: ${error.message}`);
        continue;
      }
      throw error;
    }
    for (const entry of archive.entries) {
      if (entry.isDirectory) continue;
      const format = imageFormat(entry.name);
      if (!format) continue;
      entries.push({
        id: `/${prefix}${entry.name}`,
        source: "base",
        zip: file,
        entry: entry.name,
        format,
      });
    }
  }
  return entries;
}

/** `0` for ids under `/gui`, the game's icon folder, and `1` for the rest. */
export function imageZone(id: string): number {
  return id.toLowerCase().startsWith("/gui/") ? 0 : 1;
}

/** Score for a query against an id. Lower is better. `null` is no match. */
export function imageMatchScore(id: string, needle: string): number | null {
  if (needle === "") return 0;
  const lower = id.toLowerCase();
  const slash = lower.lastIndexOf("/");
  const name = lower.slice(slash + 1);
  if (name.startsWith(needle)) return 0;
  if (name.includes(needle)) return 1;
  if (lower.includes(needle)) return 2;
  return null;
}

export class ImageIndex {
  private byId = new Map<string, ImageEntry>();
  private archives = new Map<string, Promise<ZipArchive>>();

  constructor(entries: Iterable<ImageEntry> = []) {
    for (const entry of entries) this.add(entry);
  }

  /** Every folder that holds an image, by its lower case id. */
  private dirs = new Map<string, string>();

  /**
   * Adds an image under its canonical id, the name without `@2x`. A `@2x` file
   * is the same icon at a higher resolution, so it and its base file are one
   * entry. Thumbnails are small, so the entry reads from the base file when
   * there is one and from the `@2x` file only when that is all the game ships.
   */
  add(entry: ImageEntry) {
    const id = canonicalImageId(entry.id);
    const hires = id !== entry.id;
    const existing = this.byId.get(id);
    if (!(existing && hires && !existing.hires)) {
      this.byId.set(id, { ...entry, id, hires });
    }
    for (let i = id.indexOf("/"); i >= 0; i = id.indexOf("/", i + 1)) {
      const dir = id.slice(0, i + 1);
      const key = dir.toLowerCase();
      if (!this.dirs.has(key)) this.dirs.set(key, dir);
    }
  }

  /**
   * Folders that complete a typed path. Typing `/gui/bu` offers the folders
   * directly under `/gui/` whose name starts with `bu`, such as
   * `/gui/builtin/`. Nothing is offered until the text holds a `/`. Folders
   * under `/gui` come first, then alphabetical.
   */
  folders(query: string, limit = 20): string[] {
    const typed = query.trim().toLowerCase();
    if (!typed.includes("/")) return [];
    const path = typed.startsWith("/") || typed.includes("::")
      ? typed
      : `/${typed}`;
    const cut = path.lastIndexOf("/");
    const parent = path.slice(0, cut + 1);
    const partial = path.slice(cut + 1);
    const found: string[] = [];
    for (const [key, dir] of this.dirs) {
      if (key === parent || !key.startsWith(parent)) continue;
      const rest = key.slice(parent.length);
      if (rest.indexOf("/") !== rest.length - 1) continue;
      if (rest.startsWith(partial)) found.push(dir);
    }
    found.sort((a, b) =>
      imageZone(a) - imageZone(b) || (a < b ? -1 : a > b ? 1 : 0)
    );
    return found.slice(0, limit);
  }

  get size(): number {
    return this.byId.size;
  }

  /** Finds an image by its id with or without `@2x`. */
  get(id: string): ImageEntry | undefined {
    return this.byId.get(canonicalImageId(id));
  }

  /**
   * Matches in order: images under `/gui` first, since those are the game's
   * icons, then by how well the name matches, then alphabetically by id so the
   * list is stable.
   */
  search(query: string, limit = 50): ImageEntry[] {
    const needle = canonicalImageId(query.trim().toLowerCase());
    const scored: { entry: ImageEntry; zone: number; score: number }[] = [];
    for (const entry of this.byId.values()) {
      const score = imageMatchScore(entry.id, needle);
      if (score !== null) {
        scored.push({ entry, zone: imageZone(entry.id), score });
      }
    }
    scored.sort((a, b) =>
      a.zone - b.zone || a.score - b.score ||
      (a.entry.id < b.entry.id ? -1 : a.entry.id > b.entry.id ? 1 : 0)
    );
    return scored.slice(0, limit).map((s) => s.entry);
  }

  async readBytes(entry: ImageEntry): Promise<Uint8Array> {
    if (!entry.zip) return await Deno.readFile(entry.entry);
    let archive = this.archives.get(entry.zip);
    if (!archive) {
      archive = ZipArchive.open(entry.zip);
      this.archives.set(entry.zip, archive);
    }
    return await (await archive).read(entry.entry);
  }
}

/** Base game images plus the open mod's and its dependencies'. */
export async function buildImageIndex(
  baseEntries: ImageEntry[],
  modsRoot: string,
  dirName: string,
  mod: ModJson,
): Promise<ImageIndex> {
  const index = new ImageIndex(baseEntries);
  for (const e of await indexModImages(modDir(modsRoot, dirName), "mod")) {
    index.add(e);
  }
  const wanted = new Set((mod.dependencies ?? []).map((d) => d.mod.modId));
  if (wanted.size > 0) {
    for (const listing of await listMods(modsRoot)) {
      if (listing.modId === undefined || !wanted.has(listing.modId)) continue;
      if (listing.dirName === dirName) continue;
      const entries = await indexModImages(
        modDir(modsRoot, listing.dirName),
        "dependency",
        listing.modId,
      );
      for (const e of entries) index.add(e);
    }
  }
  return index;
}
