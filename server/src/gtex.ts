import { dirname, join, relative, SEPARATOR } from "jsr:@std/path@^1";
import * as posixPath from "jsr:@std/path@^1/posix";
import type { ModJson } from "@cedit/schema";
import { type AssetEntry, walk } from "./assets.ts";
import { listMods, modDir } from "./mods.ts";
import { ZipArchive, ZipError } from "./zip.ts";

export interface GtexEntry extends AssetEntry {
  kind: "gtex" | "tmat";
}

const SUFFIXES = { ".gtex.lua": "gtex", ".tmat.lua": "tmat" } as const;

function kindOf(name: string): GtexEntry["kind"] | null {
  for (const [suffix, kind] of Object.entries(SUFFIXES)) {
    if (name.endsWith(suffix)) return kind;
  }
  return null;
}

/** `/a/b.gtex.lua` is the ground texture `/a/b.gtex`. */
function withoutLua(id: string): string {
  return id.slice(0, -".lua".length);
}

function posix(path: string): string {
  return path.split(SEPARATOR).join("/");
}

/** Ground texture and terrain material ids for one mod folder. */
export async function indexModGtex(
  dir: string,
  source: "mod" | "dependency",
  modId?: string,
): Promise<GtexEntry[]> {
  const contentDir = join(dir, "content");
  const entries: GtexEntry[] = [];
  for await (const file of walk(contentDir)) {
    const kind = kindOf(file);
    if (!kind) continue;
    const rel = posix(relative(contentDir, file));
    const entry: GtexEntry = {
      id: withoutLua(source === "mod" ? `/${rel}` : `${modId}::/${rel}`),
      source,
      entry: file,
      kind,
    };
    if (modId !== undefined) entry.modId = modId;
    entries.push(entry);
  }
  return entries;
}

/** Ground texture and terrain material ids for every base game zip. */
export async function indexBaseGtex(installRoot: string): Promise<GtexEntry[]> {
  const contentDir = join(installRoot, "base", "content");
  const entries: GtexEntry[] = [];
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
      const kind = kindOf(entry.name);
      if (!kind) continue;
      entries.push({
        id: withoutLua(`/${prefix}${entry.name}`),
        source: "base",
        zip: file,
        entry: entry.name,
        kind,
      });
    }
  }
  return entries;
}

/** The name shown for a ground texture: the file name without folder or extension. */
export function gtexName(id: string): string {
  const base = posixPath.basename(id);
  return base.slice(0, base.length - posixPath.extname(base).length);
}

/**
 * Resolves `ref` against the file `from`. A reference starting with `/` or
 * `::/` is absolute. A dependency file keeps its `mod_id::` prefix.
 */
export function resolveGtexRef(from: string, ref: string): string {
  const at = from.indexOf("::");
  const prefix = at > 0 ? from.slice(0, at + 2) : "";
  const path = at > 0 ? from.slice(at + 2) : from;
  if (ref.startsWith("::/")) return ref.slice(2);
  if (ref.startsWith("/")) return prefix + posixPath.normalize(ref);
  return prefix +
    posixPath.normalize(posixPath.join(posixPath.dirname(path), ref));
}

export class GtexIndex {
  private byId = new Map<string, GtexEntry>();
  private archives = new Map<string, Promise<ZipArchive>>();
  private read: (entry: GtexEntry) => Promise<string>;

  constructor(
    entries: Iterable<GtexEntry> = [],
    read?: (entry: GtexEntry) => Promise<string>,
  ) {
    for (const entry of entries) this.byId.set(entry.id.toLowerCase(), entry);
    this.read = read ?? ((entry) => this.readText(entry));
  }

  get size(): number {
    return [...this.byId.values()].filter((e) => e.kind === "gtex").length;
  }

  get(id: string): GtexEntry | undefined {
    return this.byId.get(id.toLowerCase());
  }

  /** Keyword search over ground textures: every keyword must match the id. */
  search(query: string, limit = 50): GtexEntry[] {
    const keywords = query.toLowerCase().split(/\s+/).filter((k) => k !== "");
    const found: GtexEntry[] = [];
    for (const entry of this.byId.values()) {
      if (entry.kind !== "gtex") continue;
      const id = entry.id.toLowerCase();
      if (keywords.every((k) => id.includes(k))) found.push(entry);
    }
    found.sort((a, b) =>
      gtexName(a.id).localeCompare(gtexName(b.id)) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    );
    return found.slice(0, limit);
  }

  /**
   * The image id that previews a ground texture. A mask texture names its TGA.
   * A single-material texture names a terrain material, and that material names
   * its preview icon or color texture. Null when neither is found.
   */
  async previewImage(key: string): Promise<string | null> {
    const entry = this.get(key);
    if (!entry || entry.kind !== "gtex") return null;
    const text = await this.read(entry);
    const mask = /makeMaterialIndexTexture\(\s*["']([^"']+)["']/.exec(text);
    if (mask) return resolveGtexRef(entry.id, mask[1]);
    // The files are Lua with expressions such as `1 / 32`, so fields are read
    // by pattern and not with the data-only table parser.
    const material = /["']([^"']+\.tmat)(?:\.lua)?["']/.exec(text);
    if (!material) return null;
    const tmat = this.get(resolveGtexRef(entry.id, material[1]));
    if (!tmat || tmat.kind !== "tmat") return null;
    const fields = await this.read(tmat);
    for (const field of ["previewIcon", "icon", "detailColorTexture"]) {
      const image = new RegExp(`\\b${field}\\s*=\\s*["']([^"']+)["']`).exec(
        fields,
      );
      if (image) return resolveGtexRef(tmat.id, image[1]);
    }
    return null;
  }

  private async readText(entry: GtexEntry): Promise<string> {
    if (!entry.zip) return await Deno.readTextFile(entry.entry);
    let archive = this.archives.get(entry.zip);
    if (!archive) {
      archive = ZipArchive.open(entry.zip);
      this.archives.set(entry.zip, archive);
    }
    return new TextDecoder().decode(await (await archive).read(entry.entry));
  }
}

/** Base game ground textures plus the open mod's and its dependencies'. */
export async function buildGtexIndex(
  baseEntries: GtexEntry[],
  modsRoot: string,
  dirName: string,
  mod: ModJson,
): Promise<GtexIndex> {
  const entries = [
    ...baseEntries,
    ...await indexModGtex(modDir(modsRoot, dirName), "mod"),
  ];
  const wanted = new Set((mod.dependencies ?? []).map((d) => d.mod.modId));
  if (wanted.size > 0) {
    for (const listing of await listMods(modsRoot)) {
      if (listing.modId === undefined || !wanted.has(listing.modId)) continue;
      if (listing.dirName === dirName) continue;
      entries.push(
        ...await indexModGtex(
          modDir(modsRoot, listing.dirName),
          "dependency",
          listing.modId,
        ),
      );
    }
  }
  return new GtexIndex(entries);
}
