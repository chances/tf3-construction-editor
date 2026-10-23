import { dirname, join, relative, SEPARATOR } from "jsr:@std/path@^1";
import * as posixPath from "jsr:@std/path@^1/posix";
import type { ModJson } from "@cedit/schema";
import { type AssetEntry, walk } from "./assets.ts";
import { listMods, modDir } from "./mods.ts";
import { ZipArchive, ZipError } from "./zip.ts";

/** What a `.lua` file under the game or a mod defines for the path tools. */
export type PathTypeKind = "street" | "track" | "edgeObject";

export interface PathTypeEntry extends AssetEntry {
  kind: PathTypeKind;
}

const SUFFIXES: [string, PathTypeKind][] = [
  [".street_template.lua", "street"],
  [".street.lua", "street"],
  [".track_template.lua", "track"],
  [".track.lua", "track"],
];

/** Kind from the file name alone. A `.con.lua` needs its text read first. */
function kindOfName(name: string): PathTypeKind | "con" | null {
  if (name.endsWith(".con.lua")) return "con";
  for (const [suffix, kind] of SUFFIXES) {
    if (name.endsWith(suffix)) return kind;
  }
  return null;
}

/** A `.con.lua` is an edge object when it declares an `edgeObject` table. */
export function isEdgeObjectCon(text: string): boolean {
  return /\bedgeObject\s*=/.test(text);
}

function withoutLua(id: string): string {
  return id.slice(0, -".lua".length);
}

function posix(path: string): string {
  return path.split(SEPARATOR).join("/");
}

/** Street types, track types, and edge objects of one mod folder. */
export async function indexModPathTypes(
  dir: string,
  source: "mod" | "dependency",
  modId?: string,
): Promise<PathTypeEntry[]> {
  const contentDir = join(dir, "content");
  const entries: PathTypeEntry[] = [];
  for await (const file of walk(contentDir)) {
    let kind = kindOfName(file);
    if (kind === null) continue;
    if (kind === "con") {
      if (!isEdgeObjectCon(await Deno.readTextFile(file))) continue;
      kind = "edgeObject";
    }
    const rel = posix(relative(contentDir, file));
    const entry: PathTypeEntry = {
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

/** Street types, track types, and edge objects of every base game zip. */
export async function indexBasePathTypes(
  installRoot: string,
): Promise<PathTypeEntry[]> {
  const contentDir = join(installRoot, "base", "content");
  const entries: PathTypeEntry[] = [];
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
      let kind = kindOfName(entry.name);
      if (kind === null) continue;
      if (kind === "con") {
        if (!isEdgeObjectCon(await archive.readText(entry.name))) continue;
        kind = "edgeObject";
      }
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

/** The name shown for an id: the file name without folder or extensions. */
export function pathTypeName(id: string): string {
  return posixPath.basename(id).split(".")[0];
}

export class PathTypeIndex {
  #byKey = new Map<string, PathTypeEntry>();

  constructor(entries: Iterable<PathTypeEntry> = []) {
    for (const entry of entries) {
      this.#byKey.set(`${entry.kind}|${entry.id.toLowerCase()}`, entry);
    }
  }

  count(kind: PathTypeKind): number {
    let n = 0;
    for (const entry of this.#byKey.values()) if (entry.kind === kind) n++;
    return n;
  }

  has(kind: PathTypeKind, id: string): boolean {
    return this.#byKey.has(`${kind}|${id.toLowerCase()}`);
  }

  /** Keyword search: every keyword must match the id. Sorted by name. */
  search(kind: PathTypeKind, query: string, limit = 50): PathTypeEntry[] {
    const keywords = query.toLowerCase().split(/\s+/).filter((k) => k !== "");
    const found: PathTypeEntry[] = [];
    for (const entry of this.#byKey.values()) {
      if (entry.kind !== kind) continue;
      const id = entry.id.toLowerCase();
      if (keywords.every((k) => id.includes(k))) found.push(entry);
    }
    found.sort((a, b) =>
      pathTypeName(a.id).localeCompare(pathTypeName(b.id)) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    );
    return found.slice(0, limit);
  }
}

/** Base game path types plus the open mod's and its dependencies'. */
export async function buildPathTypeIndex(
  baseEntries: PathTypeEntry[],
  modsRoot: string,
  dirName: string,
  mod: ModJson,
): Promise<PathTypeIndex> {
  const entries = [
    ...baseEntries,
    ...await indexModPathTypes(modDir(modsRoot, dirName), "mod"),
  ];
  const wanted = new Set((mod.dependencies ?? []).map((d) => d.mod.modId));
  if (wanted.size > 0) {
    for (const listing of await listMods(modsRoot)) {
      if (listing.modId === undefined || !wanted.has(listing.modId)) continue;
      if (listing.dirName === dirName) continue;
      entries.push(
        ...await indexModPathTypes(
          modDir(modsRoot, listing.dirName),
          "dependency",
          listing.modId,
        ),
      );
    }
  }
  return new PathTypeIndex(entries);
}
