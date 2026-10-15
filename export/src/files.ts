import type { ConstructionDoc, ModInfoJson, ModJson } from "@cedit/schema";
import { buildConLua, buildScriptTl } from "./construction.ts";

export const MANIFEST_PATH = "_metadata/export-manifest.json";
export const MOD_JSON_PATH = "mod.json";
export const MOD_INFO_PATH = "_metadata/modinfo.json";

export interface PlannedFile {
  /** Path relative to the mod root, with forward slashes. */
  path: string;
  content: string;
  /** `generated` files need ownership. `merged` files are key-merged JSON. */
  kind: "generated" | "merged";
}

export interface Manifest {
  version: 1;
  /** Paths relative to the mod root that the exporter may overwrite. */
  owned: string[];
}

export interface ExportInput {
  mod: ModJson;
  modInfo: ModInfoJson;
  construction: ConstructionDoc;
  /** Parsed content of the existing `mod.json`, when the file exists. */
  existingModJson?: Record<string, unknown>;
  /** Parsed content of the existing `modinfo.json`, when the file exists. */
  existingModInfo?: Record<string, unknown>;
}

/**
 * Overlays `edited` on `existing`. Keys only in `existing` survive.
 * A key set to `undefined` in `edited` is removed.
 */
export function mergeJson(
  existing: Record<string, unknown> | undefined,
  edited: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...(existing ?? {}) };
  for (const [key, value] of Object.entries(edited)) {
    if (value === undefined) delete merged[key];
    else merged[key] = value;
  }
  return merged;
}

export function formatJson(value: unknown): string {
  return `${JSON.stringify(value, null, 4)}\n`;
}

export function constructionPaths(doc: ConstructionDoc) {
  const base = `content/${doc.folder}/${doc.id}`;
  return { con: `${base}.con.lua`, script: `${base}.script.tl` };
}

export function planExport(input: ExportInput): PlannedFile[] {
  const { construction } = input;
  const paths = constructionPaths(construction);
  return [
    {
      path: MOD_JSON_PATH,
      content: formatJson(mergeJson(input.existingModJson, input.mod)),
      kind: "merged",
    },
    {
      path: MOD_INFO_PATH,
      content: formatJson(mergeJson(input.existingModInfo, input.modInfo)),
      kind: "merged",
    },
    { path: paths.con, content: buildConLua(construction), kind: "generated" },
    {
      path: paths.script,
      content: buildScriptTl(construction),
      kind: "generated",
    },
  ];
}

export interface Refusal {
  path: string;
  reason: string;
}

export interface OwnershipResult {
  writes: PlannedFile[];
  refused: Refusal[];
  manifest: Manifest;
}

export function emptyManifest(): Manifest {
  return { version: 1, owned: [] };
}

/**
 * Splits planned files into writes and refusals. A generated file is written
 * when the manifest owns it or when no file exists at that path yet.
 */
export function resolveOwnership(
  files: PlannedFile[],
  manifest: Manifest,
  exists: (path: string) => boolean,
): OwnershipResult {
  const owned = new Set(manifest.owned);
  const writes: PlannedFile[] = [];
  const refused: Refusal[] = [];
  for (const file of files) {
    if (file.kind === "merged" || owned.has(file.path) || !exists(file.path)) {
      writes.push(file);
      if (file.kind === "generated") owned.add(file.path);
    } else {
      refused.push({
        path: file.path,
        reason: "The file exists and the export manifest does not own it.",
      });
    }
  }
  return {
    writes,
    refused,
    manifest: { version: 1, owned: [...owned].sort() },
  };
}
