import {
  type AssetChip,
  type AssetFilters,
  CHIP_KINDS,
  type ChipKind,
  type ConstructionDoc,
  type Issue,
  type ModInfoJson,
  type ModJson,
  type Vec3,
} from "@cedit/schema";

export interface ModListing {
  dirName: string;
  modId?: string;
  name?: string;
}

export interface LoadedMod {
  dirName: string;
  mod: ModJson;
  modInfo: ModInfoJson;
  constructions: { id: string; name: string }[];
}

export interface AssetListing {
  id: string;
  source: "base" | "mod" | "dependency";
  modId?: string;
  /** Every file of this model, including `id`, such as its high and low poly. */
  variants: string[];
  /** The chips to show, without the ones only this model has. */
  chips: AssetChip[];
}

/** How many models have one chip in the whole index. */
export interface AssetFacet {
  kind: ChipKind;
  label: string;
  count: number;
}

export interface MdlSummary {
  bbMin: Vec3;
  bbMax: Vec3;
  lodCount: number;
  collider?: { type: string; halfExtents?: Vec3 };
  lod0Meshes: string[];
  /** Top-down outline loops in model space. */
  outline?: [number, number][][];
  outlineError?: string;
}

export interface ExportOutcome {
  ok: boolean;
  issues: Issue[];
  written: string[];
  refused: { path: string; reason: string }[];
}

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

/** The request never reached the server: it is down or the network is. */
export class UnreachableError extends Error {
  constructor() {
    super("The editor could not reach its server.");
    this.name = "UnreachableError";
  }
}

let unreachableListener: (() => void) | null = null;

/** Sets the one function that hears of every request that cannot connect. */
export function onUnreachable(listener: (() => void) | null) {
  unreachableListener = listener;
}

async function call<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? {} : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    // `fetch` rejects only when no response came back at all.
    unreachableListener?.();
    throw new UnreachableError();
  }
  // The Vite proxy answers 502 when the server is down. The server itself
  // never sends 502, 503, or 504.
  if (res.status === 502 || res.status === 503 || res.status === 504) {
    unreachableListener?.();
    throw new UnreachableError();
  }
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, payload.error ?? `HTTP ${res.status}`);
  }
  return payload as T;
}

const enc = encodeURIComponent;

export const api = {
  config: () =>
    call<{ installRoot: string | null; modsRoot: string }>("GET", "/config"),
  openConfig: () =>
    call<{ path: string; created: boolean }>("POST", "/config/open"),
  chooseFolder: (setting: "installRoot" | "modsRoot") =>
    call<
      | { cancelled: true }
      | { installRoot: string | null; modsRoot: string }
    >("POST", "/config/choose", { setting }),
  chooseContentFolder: (dir: string, current: string) =>
    call<{ cancelled: true } | { folder: string }>(
      "POST",
      "/config/choose",
      { setting: "contentFolder", dir, current },
    ),
  listMods: () => call<ModListing[]>("GET", "/mods"),
  createMod: (modId: string, name: string) =>
    call<ModListing>("POST", "/mods", { modId, name }),
  loadMod: (dir: string) => call<LoadedMod>("GET", `/mods/${enc(dir)}`),
  saveMod: (dir: string, mod: ModJson, modInfo: ModInfoJson) =>
    call<LoadedMod>("PUT", `/mods/${enc(dir)}`, { mod, modInfo }),
  createConstruction: (dir: string, id: string, name?: string) =>
    call<ConstructionDoc>("POST", `/mods/${enc(dir)}/constructions`, {
      id,
      name,
    }),
  readConstruction: (dir: string, id: string) =>
    call<ConstructionDoc>("GET", `/mods/${enc(dir)}/constructions/${enc(id)}`),
  deleteConstruction: (dir: string, id: string) =>
    call<{ removed: string[] }>(
      "DELETE",
      `/mods/${enc(dir)}/constructions/${enc(id)}`,
    ),
  writeConstruction: (dir: string, doc: ConstructionDoc) =>
    call<ConstructionDoc>(
      "PUT",
      `/mods/${enc(dir)}/constructions/${enc(doc.id)}`,
      doc,
    ),
  exportConstruction: (dir: string, id: string) =>
    call<ExportOutcome>(
      "POST",
      `/mods/${enc(dir)}/constructions/${enc(id)}/export`,
    ),
  lint: (dir: string, doc: ConstructionDoc) =>
    call<Issue[]>("POST", `/mods/${enc(dir)}/lint`, doc),
  assets: (dir: string, q: string, filters: AssetFilters = {}, limit = 100) => {
    const f = CHIP_KINDS.flatMap(({ kind }) =>
      (filters[kind] ?? []).map((label) => `&f=${enc(`${kind}:${label}`)}`)
    ).join("");
    return call<{ total: number; entries: AssetListing[] }>(
      "GET",
      `/mods/${enc(dir)}/assets?q=${enc(q)}&limit=${limit}${f}`,
    );
  },
  assetFacets: (dir: string) =>
    call<AssetFacet[]>("GET", `/mods/${enc(dir)}/asset-facets`),
  model: (dir: string, id: string) =>
    call<MdlSummary>("GET", `/mods/${enc(dir)}/model?id=${enc(id)}`),
  images: (dir: string, q: string, limit = 50) =>
    call<{
      total: number;
      exact: boolean;
      folders: string[];
      entries: ImageListing[];
    }>(
      "GET",
      `/mods/${enc(dir)}/images?q=${enc(q)}&limit=${limit}`,
    ),
  gtex: (dir: string, q: string, limit = 50) =>
    call<{ total: number; entries: GtexListing[] }>(
      "GET",
      `/mods/${enc(dir)}/gtex?q=${enc(q)}&limit=${limit}`,
    ),
};

export interface GtexListing {
  id: string;
  name: string;
  source: "base" | "mod" | "dependency";
  modId?: string;
}

/** URL of a PNG preview of a ground texture, scaled to fit `size` pixels. */
export function gtexImageUrl(dir: string, key: string, size = 64): string {
  return `/api/mods/${enc(dir)}/gtex-image?key=${enc(key)}&size=${size}`;
}

export interface ImageListing {
  id: string;
  source: "base" | "mod" | "dependency";
  modId?: string;
  format: "tga" | "dds" | "png";
}

/** URL of a PNG thumbnail of an image, scaled to fit `size` pixels. */
export function imageUrl(dir: string, id: string, size = 64): string {
  return `/api/mods/${enc(dir)}/image?id=${enc(id)}&size=${size}`;
}
