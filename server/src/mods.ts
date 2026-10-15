import { dirname, join, relative, resolve } from "jsr:@std/path@^1";
import {
  type ConstructionDoc,
  hasErrors,
  type Issue,
  isValidModId,
  isValidResourceName,
  lintConstruction,
  lintMod,
  type ModInfoJson,
  type ModJson,
  newConstruction,
  newModInfo,
  newModJson,
  parseConstruction,
  parseModInfo,
  parseModJson,
} from "@cedit/schema";
import {
  constructionPaths,
  emptyManifest,
  formatJson,
  type Manifest,
  MANIFEST_PATH,
  mergeJson,
  MOD_INFO_PATH,
  MOD_JSON_PATH,
  planExport,
  type Refusal,
  resolveOwnership,
} from "@cedit/export";
import { type AssetEntry, AssetIndex, indexModContent } from "./assets.ts";

/** Thrown for a request the caller can fix. The API maps it to HTTP 400. */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserError";
  }
}

const DIR_NAME = /^[A-Za-z0-9_]+$/;
const CONSTRUCTIONS_DIR = "_metadata/constructions";

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return false;
    throw error;
  }
}

async function readJson(path: string): Promise<unknown | undefined> {
  try {
    return JSON.parse(await Deno.readTextFile(path));
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return undefined;
    throw new UserError(`${path}: ${(error as Error).message}`);
  }
}

async function writeText(root: string, relPath: string, text: string) {
  const full = resolve(root, relPath);
  if (relative(root, full).startsWith("..")) {
    throw new UserError(`Refusing to write outside the mod folder: ${relPath}`);
  }
  await Deno.mkdir(dirname(full), { recursive: true });
  await Deno.writeTextFile(full, text);
}

export interface ModListing {
  dirName: string;
  modId?: string;
  name?: string;
}

export function modDir(modsRoot: string, dirName: string): string {
  if (!DIR_NAME.test(dirName)) {
    throw new UserError(`Bad mod folder name: ${dirName}`);
  }
  return join(modsRoot, dirName);
}

export async function listMods(modsRoot: string): Promise<ModListing[]> {
  const listing: ModListing[] = [];
  try {
    for await (const item of Deno.readDir(modsRoot)) {
      if (!item.isDirectory) continue;
      const dir = join(modsRoot, item.name);
      const modJson = await readJson(join(dir, MOD_JSON_PATH)).catch(() =>
        undefined
      );
      if (modJson === undefined) continue;
      const entry: ModListing = { dirName: item.name };
      const record = modJson as Record<string, unknown>;
      if (typeof record.modId === "string") entry.modId = record.modId;
      const info = await readJson(join(dir, MOD_INFO_PATH)).catch(() =>
        undefined
      ) as
        | Record<string, unknown>
        | undefined;
      if (info && typeof info.name === "string") entry.name = info.name;
      listing.push(entry);
    }
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
  return listing.sort((a, b) => a.dirName.localeCompare(b.dirName));
}

export async function createMod(
  modsRoot: string,
  modId: string,
  name: string,
): Promise<ModListing> {
  if (!isValidModId(modId)) {
    throw new UserError("modId may use only a-z, 0-9, and _.");
  }
  const dir = modDir(modsRoot, modId);
  if (await exists(dir)) throw new UserError(`${dir} already exists.`);
  await Deno.mkdir(join(dir, "content"), { recursive: true });
  await writeText(dir, MOD_JSON_PATH, formatJson(newModJson(modId)));
  await writeText(dir, MOD_INFO_PATH, formatJson(newModInfo(name || modId)));
  return { dirName: modId, modId, name: name || modId };
}

export interface ConstructionListing {
  id: string;
  name: string;
}

export interface LoadedMod {
  dirName: string;
  mod: ModJson;
  modInfo: ModInfoJson;
  constructions: ConstructionListing[];
}

export async function listConstructions(
  dir: string,
): Promise<ConstructionListing[]> {
  const listing: ConstructionListing[] = [];
  try {
    for await (const item of Deno.readDir(join(dir, CONSTRUCTIONS_DIR))) {
      if (!item.isFile || !item.name.endsWith(".json")) continue;
      const id = item.name.slice(0, -".json".length);
      const doc = parseConstruction(
        await readJson(join(dir, CONSTRUCTIONS_DIR, item.name)),
      );
      listing.push({ id, name: doc.description.name });
    }
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
  return listing.sort((a, b) => a.id.localeCompare(b.id));
}

export async function loadMod(
  modsRoot: string,
  dirName: string,
): Promise<LoadedMod> {
  const dir = modDir(modsRoot, dirName);
  const modRaw = await readJson(join(dir, MOD_JSON_PATH));
  if (modRaw === undefined) throw new UserError(`${dir} has no mod.json.`);
  const infoRaw = await readJson(join(dir, MOD_INFO_PATH));
  return {
    dirName,
    mod: parseModJson(modRaw),
    modInfo: parseModInfo(infoRaw ?? { name: dirName }),
    constructions: await listConstructions(dir),
  };
}

export async function saveMod(
  modsRoot: string,
  dirName: string,
  mod: ModJson,
  modInfo: ModInfoJson,
): Promise<void> {
  const dir = modDir(modsRoot, dirName);
  const issues = lintMod(mod);
  if (hasErrors(issues)) throw new UserError(issues[0].message);
  const existingMod = await readJson(join(dir, MOD_JSON_PATH)) as Record<
    string,
    unknown
  >;
  const existingInfo = await readJson(join(dir, MOD_INFO_PATH)) as
    | Record<string, unknown>
    | undefined;
  await writeText(dir, MOD_JSON_PATH, formatJson(mergeJson(existingMod, mod)));
  await writeText(
    dir,
    MOD_INFO_PATH,
    formatJson(mergeJson(existingInfo, modInfo)),
  );
}

function constructionPath(id: string): string {
  if (!isValidResourceName(id)) {
    throw new UserError(`Bad construction id: ${id}`);
  }
  return `${CONSTRUCTIONS_DIR}/${id}.json`;
}

export async function readConstruction(
  modsRoot: string,
  dirName: string,
  id: string,
): Promise<ConstructionDoc> {
  const dir = modDir(modsRoot, dirName);
  const raw = await readJson(join(dir, constructionPath(id)));
  if (raw === undefined) {
    throw new Deno.errors.NotFound(
      `The construction ${id} is not in the mod ${dirName}. It may have been deleted or renamed outside the editor.`,
    );
  }
  return parseConstruction(raw);
}

export async function writeConstruction(
  modsRoot: string,
  dirName: string,
  doc: ConstructionDoc,
): Promise<void> {
  const dir = modDir(modsRoot, dirName);
  await writeText(
    dir,
    constructionPath(doc.id),
    formatJson(parseConstruction(doc)),
  );
}

export async function createConstruction(
  modsRoot: string,
  dirName: string,
  id: string,
  name?: string,
): Promise<ConstructionDoc> {
  const dir = modDir(modsRoot, dirName);
  if (await exists(join(dir, constructionPath(id)))) {
    throw new UserError(`Construction ${id} already exists.`);
  }
  const doc = newConstruction(id);
  if (name !== undefined && name.trim() !== "") {
    doc.description.name = name.trim();
  }
  await writeConstruction(modsRoot, dirName, doc);
  return doc;
}

/**
 * Deletes a construction: its editor document, its mask folder, and the
 * exported `.con.lua` and `.script.tl` files. Exported files are removed only
 * when the export manifest owns them, and they leave the manifest. Returns the
 * paths removed, relative to the mod folder.
 */
export async function deleteConstruction(
  modsRoot: string,
  dirName: string,
  id: string,
): Promise<{ removed: string[] }> {
  const dir = modDir(modsRoot, dirName);
  const doc = await readConstruction(modsRoot, dirName, id);
  const manifestRaw = await readJson(join(dir, MANIFEST_PATH)) as
    | Manifest
    | undefined;
  const manifest = manifestRaw?.version === 1 ? manifestRaw : emptyManifest();
  const owned = new Set(manifest.owned);
  const removed: string[] = [];

  const inside = (rel: string) => {
    const full = resolve(dir, ...rel.split("/"));
    return relative(dir, full).startsWith("..") ? null : full;
  };

  const paths = constructionPaths(doc);
  for (const rel of [paths.con, paths.script]) {
    const full = inside(rel);
    if (full !== null && owned.has(rel) && await exists(full)) {
      await Deno.remove(full);
      removed.push(rel);
    }
    owned.delete(rel);
  }

  const docRel = constructionPath(id);
  await Deno.remove(join(dir, ...docRel.split("/")));
  removed.push(docRel);

  const masks = join(dir, ...CONSTRUCTIONS_DIR.split("/"), id);
  if (await exists(masks)) {
    await Deno.remove(masks, { recursive: true });
    removed.push(`${CONSTRUCTIONS_DIR}/${id}/`);
  }

  if (manifestRaw) {
    await writeText(
      dir,
      MANIFEST_PATH,
      formatJson({ version: 1, owned: [...owned].sort() }),
    );
  }
  return { removed };
}

/** Index of the base game, the open mod, and the mods in its `dependencies`. */
export async function buildAssetIndex(
  baseEntries: AssetEntry[],
  modsRoot: string,
  dirName: string,
  mod: ModJson,
): Promise<AssetIndex> {
  const index = new AssetIndex(baseEntries);
  for (const e of await indexModContent(modDir(modsRoot, dirName), "mod")) {
    index.add(e);
  }
  const wanted = new Set(
    (mod.dependencies ?? []).map((d) => d.mod.modId),
  );
  if (wanted.size > 0) {
    for (const listing of await listMods(modsRoot)) {
      if (listing.modId === undefined || !wanted.has(listing.modId)) continue;
      if (listing.dirName === dirName) continue;
      const entries = await indexModContent(
        modDir(modsRoot, listing.dirName),
        "dependency",
        listing.modId,
      );
      for (const e of entries) index.add(e);
    }
  }
  return index;
}

export interface ExportOutcome {
  ok: boolean;
  issues: Issue[];
  written: string[];
  refused: Refusal[];
}

export async function exportConstruction(
  modsRoot: string,
  dirName: string,
  id: string,
  index: AssetIndex,
): Promise<ExportOutcome> {
  const dir = modDir(modsRoot, dirName);
  const loaded = await loadMod(modsRoot, dirName);
  const construction = await readConstruction(modsRoot, dirName, id);
  const issues = [
    ...lintMod(loaded.mod),
    ...lintConstruction(construction, { resolveModel: (m) => index.has(m) }),
  ];
  if (hasErrors(issues)) return { ok: false, issues, written: [], refused: [] };

  const files = planExport({
    mod: loaded.mod,
    modInfo: loaded.modInfo,
    construction,
    existingModJson: await readJson(join(dir, MOD_JSON_PATH)) as Record<
      string,
      unknown
    >,
    existingModInfo: await readJson(join(dir, MOD_INFO_PATH)) as
      | Record<string, unknown>
      | undefined,
  });
  const manifestRaw = await readJson(join(dir, MANIFEST_PATH)) as
    | Manifest
    | undefined;
  const manifest = manifestRaw?.version === 1 ? manifestRaw : emptyManifest();
  const present = new Set<string>();
  for (const file of files) {
    if (await exists(join(dir, ...file.path.split("/")))) {
      present.add(file.path);
    }
  }
  const result = resolveOwnership(files, manifest, (p) => present.has(p));
  if (result.refused.length > 0) {
    return { ok: false, issues, written: [], refused: result.refused };
  }
  for (const file of result.writes) {
    await writeText(dir, file.path, file.content);
  }
  await writeText(dir, MANIFEST_PATH, formatJson(result.manifest));
  return {
    ok: true,
    issues,
    written: result.writes.map((f) => f.path),
    refused: [],
  };
}
