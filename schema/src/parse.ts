import { isMat4 } from "./transform.ts";
import type {
  ConstructionDoc,
  ModelPlacement,
  ModInfoJson,
  ModJson,
  SubconstructionDoc,
} from "./types.ts";

export class SchemaError extends Error {
  constructor(public readonly path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = "SchemaError";
  }
}

type Obj = Record<string, unknown>;

function obj(value: unknown, path: string): Obj {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new SchemaError(path, "expected an object");
  }
  return value as Obj;
}

function str(value: unknown, path: string): string {
  if (typeof value !== "string") {
    throw new SchemaError(path, "expected a string");
  }
  return value;
}

function num(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new SchemaError(path, "expected a finite number");
  }
  return value;
}

function arr(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new SchemaError(path, "expected an array");
  return value;
}

function optNum(o: Obj, key: string, path: string): number | undefined {
  return o[key] === undefined ? undefined : num(o[key], `${path}.${key}`);
}

function optStr(o: Obj, key: string, path: string): string | undefined {
  return o[key] === undefined ? undefined : str(o[key], `${path}.${key}`);
}

export function parseModJson(value: unknown): ModJson {
  const o = obj(value, "mod.json");
  str(o.modId, "mod.json.modId");
  num(o.revision, "mod.json.revision");
  return o as ModJson;
}

export function parseModInfo(value: unknown): ModInfoJson {
  const o = obj(value, "modinfo.json");
  const name = str(o.name, "modinfo.json.name");
  return {
    summary: "",
    description: "",
    authors: [],
    tags: [],
    ...o,
    name,
  } as ModInfoJson;
}

function parsePlacement(value: unknown, path: string): ModelPlacement {
  const o = obj(value, path);
  const placement: ModelPlacement = {
    id: str(o.id, `${path}.id`),
    transf: [],
  };
  if (!isMat4(o.transf)) {
    throw new SchemaError(`${path}.transf`, "expected 16 finite numbers");
  }
  placement.transf = o.transf;
  const tag = optStr(o, "tag", path);
  if (tag !== undefined) placement.tag = tag;
  return placement;
}

function parseSubconstruction(
  value: unknown,
  path: string,
): SubconstructionDoc {
  const o = obj(value, path);
  const sub: SubconstructionDoc = {
    models: arr(o.models, `${path}.models`).map((m, i) =>
      parsePlacement(m, `${path}.models.${i}`)
    ),
  };
  const label = optStr(o, "label", path);
  if (label !== undefined) sub.label = label;
  const tag = optNum(o, "tag", path);
  if (tag !== undefined) sub.tag = tag;
  if (o.hidden !== undefined) {
    if (typeof o.hidden !== "boolean") {
      throw new SchemaError(`${path}.hidden`, "expected a boolean");
    }
    sub.hidden = o.hidden;
  }
  return sub;
}

/** Validates the structure of a stored construction. Throws {@link SchemaError}. */
export function parseConstruction(value: unknown): ConstructionDoc {
  const o = obj(value, "construction");
  if (o.schemaVersion !== 1) {
    throw new SchemaError("construction.schemaVersion", "expected 1");
  }
  const description = obj(o.description, "construction.description");
  const availability = obj(o.availability, "construction.availability");
  const menuCategory = obj(o.menuCategory, "construction.menuCategory");
  const costs = obj(o.costs ?? {}, "construction.costs");
  const doc: ConstructionDoc = {
    schemaVersion: 1,
    id: str(o.id, "construction.id"),
    folder: str(o.folder, "construction.folder"),
    description: {
      name: str(description.name, "construction.description.name"),
      description: str(
        description.description,
        "construction.description.description",
      ),
    },
    availability: {
      yearFrom: num(
        availability.yearFrom,
        "construction.availability.yearFrom",
      ),
    },
    menuCategory: {
      category: str(
        menuCategory.category,
        "construction.menuCategory.category",
      ),
      order: num(menuCategory.order, "construction.menuCategory.order"),
    },
    costs: {},
    metadata: obj(o.metadata ?? {}, "construction.metadata"),
    subconstructions: arr(o.subconstructions, "construction.subconstructions")
      .map((s, i) =>
        parseSubconstruction(s, `construction.subconstructions.${i}`)
      ),
  };
  const icon = optStr(description, "icon", "construction.description");
  if (icon !== undefined) doc.description.icon = icon;
  const previewIcon = optStr(
    description,
    "previewIcon",
    "construction.description",
  );
  if (previewIcon !== undefined) doc.description.previewIcon = previewIcon;
  const yearTo = optNum(availability, "yearTo", "construction.availability");
  if (yearTo !== undefined) doc.availability.yearTo = yearTo;
  for (const key of ["cost", "maintenanceCost", "bulldozeCost"] as const) {
    const n = optNum(costs, key, "construction.costs");
    if (n !== undefined) doc.costs[key] = n;
  }
  if (costs.noCostAtAll !== undefined) {
    if (typeof costs.noCostAtAll !== "boolean") {
      throw new SchemaError(
        "construction.costs.noCostAtAll",
        "expected a boolean",
      );
    }
    doc.costs.noCostAtAll = costs.noCostAtAll;
  }
  if (o.snapPoint !== undefined) {
    doc.snapPoint = obj(
      o.snapPoint,
      "construction.snapPoint",
    ) as ConstructionDoc["snapPoint"];
  }
  return doc;
}
