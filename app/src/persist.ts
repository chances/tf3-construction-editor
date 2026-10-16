import type { ConstructionDoc, ModInfoJson, ModJson } from "@cedit/schema";
import { defaultSnap, type SnapSettings } from "./snapping.ts";

export const STORAGE_KEY = "construction-editor.state";
export const STORAGE_VERSION = 1;

export type PersistedView = "mods" | "details" | "constructions" | "editor";
export type PersistedInspectTarget = "construction" | "layer" | "model";

/**
 * UI state kept in `localStorage` so a reload resumes where the user was.
 * Mod and construction data live on the server. `pending` holds edits that
 * were not yet written there when the page unloaded.
 */
export interface PersistedState {
  version: typeof STORAGE_VERSION;
  view: PersistedView;
  modDir: string | null;
  constructionId: string | null;
  selection: { sub: number; model: number } | null;
  activeSub: number;
  inspectTarget: PersistedInspectTarget;
  snap: SnapSettings;
  zBand: { min: number | null; max: number | null };
  canvas: { cx: number; cy: number; scale: number };
  draft: {
    modId: string;
    modName: string;
    creatingMod: boolean;
    constructionName: string;
    creatingConstruction: boolean;
  };
  pending: {
    doc: ConstructionDoc | null;
    mod: ModJson | null;
    modInfo: ModInfoJson | null;
  };
}

export function emptyPersisted(): PersistedState {
  return {
    version: STORAGE_VERSION,
    view: "mods",
    modDir: null,
    constructionId: null,
    selection: null,
    activeSub: 0,
    inspectTarget: "construction",
    snap: defaultSnap(),
    zBand: { min: null, max: null },
    canvas: { cx: 0, cy: 0, scale: 10 },
    draft: {
      modId: "",
      modName: "",
      creatingMod: false,
      constructionName: "",
      creatingConstruction: false,
    },
    pending: { doc: null, mod: null, modInfo: null },
  };
}

const VIEWS: readonly PersistedView[] = [
  "mods",
  "details",
  "constructions",
  "editor",
];
const TARGETS: readonly PersistedInspectTarget[] = [
  "construction",
  "layer",
  "model",
];

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, fallback = ""): string =>
  typeof v === "string" ? v : fallback;
const bool = (v: unknown): boolean => v === true;
const num = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;
const numOrNull = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const strOrNull = (v: unknown): string | null =>
  typeof v === "string" && v !== "" ? v : null;

/**
 * Reads stored JSON back into a state, field by field. Anything missing or of
 * the wrong type falls back to the default, so a stale or hand-edited entry
 * never breaks startup. Returns null for unreadable or other-version data.
 */
export function parsePersisted(raw: string | null): PersistedState | null {
  if (raw === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObj(value) || value.version !== STORAGE_VERSION) return null;

  const base = emptyPersisted();
  const view = VIEWS.find((v) => v === value.view) ?? base.view;
  const target = TARGETS.find((t) => t === value.inspectTarget) ??
    base.inspectTarget;
  const sel = value.selection;
  const snap = isObj(value.snap) ? value.snap : {};
  const band = isObj(value.zBand) ? value.zBand : {};
  const canvas = isObj(value.canvas) ? value.canvas : {};
  const draft = isObj(value.draft) ? value.draft : {};
  const pending = isObj(value.pending) ? value.pending : {};

  return {
    version: STORAGE_VERSION,
    view,
    modDir: strOrNull(value.modDir),
    constructionId: strOrNull(value.constructionId),
    selection: isObj(sel) && typeof sel.sub === "number" &&
        typeof sel.model === "number"
      ? { sub: sel.sub, model: sel.model }
      : null,
    activeSub: Math.max(0, Math.trunc(num(value.activeSub, 0))),
    inspectTarget: target,
    snap: {
      grid: numOrNull(snap.grid) ??
        (snap.grid === null ? null : base.snap.grid),
      vertex: typeof snap.vertex === "boolean" ? snap.vertex : base.snap.vertex,
      edge: typeof snap.edge === "boolean" ? snap.edge : base.snap.edge,
      angle: numOrNull(snap.angle) ??
        (snap.angle === null ? null : base.snap.angle),
    },
    zBand: { min: numOrNull(band.min), max: numOrNull(band.max) },
    canvas: {
      cx: num(canvas.cx, base.canvas.cx),
      cy: num(canvas.cy, base.canvas.cy),
      scale: Math.min(200, Math.max(0.5, num(canvas.scale, base.canvas.scale))),
    },
    draft: {
      modId: str(draft.modId),
      modName: str(draft.modName),
      creatingMod: bool(draft.creatingMod),
      constructionName: str(draft.constructionName),
      creatingConstruction: bool(draft.creatingConstruction),
    },
    pending: {
      doc: isObj(pending.doc)
        ? (pending.doc as unknown as ConstructionDoc)
        : null,
      mod: isObj(pending.mod) ? (pending.mod as unknown as ModJson) : null,
      modInfo: isObj(pending.modInfo)
        ? (pending.modInfo as unknown as ModInfoJson)
        : null,
    },
  };
}

/** The slice of the Storage interface the app uses. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Reads the saved state. Storage can be blocked or empty, so errors give null. */
export function loadPersisted(storage: StorageLike): PersistedState | null {
  try {
    return parsePersisted(storage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

/** Writes the state. Returns false when storage refuses (full or blocked). */
export function savePersisted(
  storage: StorageLike,
  state: PersistedState,
): boolean {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
