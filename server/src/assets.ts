import { dirname, join, relative, SEPARATOR } from "jsr:@std/path@^1";
import * as posixPath from "jsr:@std/path@^1/posix";
import {
  type AssetChip,
  assetChips,
  type AssetFilters,
  type AssetGroup,
  assetSearchText,
  chipCounts,
  chipKey,
  type ChipKind,
  groupAssets,
  matchesFilters,
  searchKeywords,
  singleUseChips,
  transformPoint,
} from "@cedit/schema";
import { type MdlSummary, parseMdl } from "./mdl.ts";
import { parseMsh } from "./msh.ts";
import { type Point2, silhouette, type Triangle2 } from "./silhouette.ts";
import { ZipArchive, ZipError } from "./zip.ts";

export interface AssetEntry {
  /** Resource id as written into a construction, for example `/placeholders/unit_cube.mdl`. */
  id: string;
  source: "base" | "mod" | "dependency";
  /** Set for `dependency` entries. */
  modId?: string;
  /** Archive that holds the file, absent for loose files. */
  zip?: string;
  /** Entry name inside the archive, or the absolute file path for loose files. */
  entry: string;
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

/**
 * Model ids for the files of one mod folder. The id is `/` plus the path
 * under `content/`. A dependency id carries the `mod_id::` prefix.
 */
export async function indexModContent(
  modDir: string,
  source: "mod" | "dependency",
  modId?: string,
): Promise<AssetEntry[]> {
  const contentDir = join(modDir, "content");
  const entries: AssetEntry[] = [];
  for await (const file of walk(contentDir)) {
    if (!file.endsWith(".mdl")) continue;
    const rel = posix(relative(contentDir, file));
    const entry: AssetEntry = {
      id: source === "mod" ? `/${rel}` : `${modId}::/${rel}`,
      source,
      entry: file,
    };
    if (modId !== undefined) entry.modId = modId;
    entries.push(entry);
  }
  return entries;
}

/**
 * Model ids for every `.mdl` in the base game zips. The id is `/`, the zip's
 * folder under `base/content`, and the entry name: `stations/air.zip` holding
 * `air/airfield/apron.mdl` resolves as `/stations/air/airfield/apron.mdl`.
 */
export async function indexBaseGame(
  installRoot: string,
): Promise<AssetEntry[]> {
  const contentDir = join(installRoot, "base", "content");
  const entries: AssetEntry[] = [];
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
      if (entry.isDirectory || !entry.name.endsWith(".mdl")) continue;
      entries.push({
        id: `/${prefix}${entry.name}`,
        source: "base",
        zip: file,
        entry: entry.name,
      });
    }
  }
  return entries;
}

export class AssetIndex {
  private byId = new Map<string, AssetEntry>();

  constructor(entries: Iterable<AssetEntry> = []) {
    for (const entry of entries) this.add(entry);
  }

  add(entry: AssetEntry) {
    this.#searchText.delete(entry.id);
    this.#groups = null;
    this.byId.set(entry.id, entry);
  }

  get size(): number {
    return this.byId.size;
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }

  get(id: string): AssetEntry | undefined {
    return this.byId.get(id);
  }

  /** The lowercase search text of each entry, built on first search. */
  #searchText = new Map<string, string>();

  #searchTextOf(entry: AssetEntry): string {
    let text = this.#searchText.get(entry.id);
    if (text === undefined) {
      text = assetSearchText(entry);
      this.#searchText.set(entry.id, text);
    }
    return text;
  }

  /**
   * Keyword search. The query splits on whitespace, and an entry matches when
   * every keyword is in its id or in the text or alias of one of its chips.
   */
  search(query: string, limit = 100): AssetEntry[] {
    const keywords = searchKeywords(query);
    const found: AssetEntry[] = [];
    for (const entry of this.byId.values()) {
      const text = keywords.length > 0 ? this.#searchTextOf(entry) : "";
      if (keywords.every((k) => text.includes(k))) {
        found.push(entry);
        if (found.length >= limit) break;
      }
    }
    return found;
  }

  /**
   * Models with their variant files, chips, and search text, built on first
   * use. A chip that only one model has is left out of `chips` and `text`.
   */
  #groups: {
    group: AssetGroup<AssetEntry>;
    chips: AssetChip[];
    text: string;
  }[] | null = null;

  #built() {
    if (this.#groups) return this.#groups;
    const groups = groupAssets(this.byId.values());
    const all = groups.map((g) =>
      assetChips(g.entry, g.variants.map((v) => v.id))
    );
    const single = singleUseChips(all);
    this.#groups = groups.map((group, i) => {
      const chips = all[i].filter((c) => !single.has(chipKey(c)));
      return {
        group,
        chips,
        text: assetSearchText(
          group.entry,
          group.variants.map((v) => v.id),
          chips,
        ),
      };
    });
    return this.#groups;
  }

  /**
   * Keyword search over models, where the variant files of one model (high and
   * low poly, animation states) are one result. A keyword may match any
   * variant. The result places `entry`, lists every file in `variants`, and
   * gives the `chips` to show. `filters` keep the models whose chips match.
   */
  searchGroups(
    query: string,
    limit = 100,
    filters: AssetFilters = {},
  ): (AssetGroup<AssetEntry> & { chips: AssetChip[] })[] {
    const keywords = searchKeywords(query);
    const found: (AssetGroup<AssetEntry> & { chips: AssetChip[] })[] = [];
    for (const { group, chips, text } of this.#built()) {
      if (
        keywords.every((k) => text.includes(k)) &&
        matchesFilters(chips, filters)
      ) {
        found.push({ ...group, chips });
        if (found.length >= limit) break;
      }
    }
    return found;
  }

  /** How many models each chip has, by kind and label. One-model chips are left out. */
  facets(): { kind: ChipKind; label: string; count: number }[] {
    const counts = chipCounts(this.#built().map((g) => g.chips));
    const seen = new Map<string, { kind: ChipKind; label: string }>();
    for (const { chips } of this.#built()) {
      for (const c of chips) {
        seen.set(chipKey(c), { kind: c.kind!, label: c.label });
      }
    }
    return [...seen].map(([key, chip]) => ({
      ...chip,
      count: counts.get(key)!,
    }));
  }

  /** Cache key that changes when the model file changes on disk. */
  async cacheKey(id: string): Promise<string> {
    const entry = this.byId.get(id);
    if (!entry) {
      throw new Deno.errors.NotFound(`Model ${id} is not in the index.`);
    }
    if (entry.zip) return `${entry.zip}|${entry.entry}`;
    const { mtime } = await Deno.stat(entry.entry);
    return `${entry.entry}|${mtime?.getTime() ?? 0}`;
  }

  async #readSibling(entry: AssetEntry, relative: string): Promise<Uint8Array> {
    if (entry.zip) {
      const dir = posixPath.dirname(entry.entry);
      const name = posixPath.normalize(posixPath.join(dir, relative));
      if (name.startsWith("../")) {
        throw new Error(`${relative} points outside the archive.`);
      }
      return await (await ZipArchive.open(entry.zip)).read(name);
    }
    return await Deno.readFile(join(dirname(entry.entry), relative));
  }

  /** Top-down outline loops of the highest detail LOD, in model space. */
  async readOutline(id: string): Promise<Point2[][]> {
    return silhouette(await this.readTriangles(id));
  }

  /** Top-down triangles of the highest detail LOD, in model space. */
  async readTriangles(id: string): Promise<Triangle2[]> {
    const entry = this.byId.get(id);
    if (!entry) {
      throw new Deno.errors.NotFound(`Model ${id} is not in the index.`);
    }
    const summary = await this.readModel(id);
    const triangles: Triangle2[] = [];
    for (const node of summary.lod0Nodes) {
      const text = new TextDecoder().decode(
        await this.#readSibling(entry, node.mesh),
      );
      const blob = await this.#readSibling(entry, `${node.mesh}.blob`);
      const mesh = parseMsh(text, blob);
      const world = (i: number): Point2 => {
        const p = transformPoint(node.world, [
          mesh.positions[i * 3],
          mesh.positions[i * 3 + 1],
          mesh.positions[i * 3 + 2],
        ]);
        return [p[0], p[1]];
      };
      for (let t = 0; t < mesh.triangles.length; t += 3) {
        const a = world(mesh.triangles[t]);
        const b = world(mesh.triangles[t + 1]);
        const c = world(mesh.triangles[t + 2]);
        triangles.push([a[0], a[1], b[0], b[1], c[0], c[1]]);
      }
    }
    return triangles;
  }

  async readModel(id: string): Promise<MdlSummary> {
    const entry = this.byId.get(id);
    if (!entry) {
      throw new Deno.errors.NotFound(`Model ${id} is not in the index.`);
    }
    const text = entry.zip
      ? await (await ZipArchive.open(entry.zip)).readText(entry.entry)
      : await Deno.readTextFile(entry.entry);
    try {
      return parseMdl(text);
    } catch (error) {
      throw new Error(`${id}: ${(error as Error).message}`, { cause: error });
    }
  }
}
