import type {
  ConstructionDoc,
  ModInfoJson,
  ModJson,
  SubconstructionDoc,
} from "./types.ts";

export function newModJson(modId: string): ModJson {
  return {
    modId,
    revision: 1,
    severityAdd: "None",
    severityRemove: "Warning",
    visible: true,
    cosmetic: false,
  };
}

export function newModInfo(name: string): ModInfoJson {
  return {
    name,
    summary: "",
    description: "",
    authors: [],
    tags: [],
  };
}

export function newSubconstruction(label = "Main"): SubconstructionDoc {
  return { label, models: [] };
}

export function newConstruction(id: string): ConstructionDoc {
  return {
    schemaVersion: 1,
    id,
    folder: "constructions",
    description: { name: id, description: "" },
    availability: { yearFrom: 0 },
    menuCategory: { category: "landmarks", order: 5000 },
    costs: {},
    metadata: {},
    subconstructions: [newSubconstruction()],
  };
}
