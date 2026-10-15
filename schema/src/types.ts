/** Column-major 4x4 matrix, 16 numbers. Translation is elements 12, 13, 14. */
export type Mat4 = number[];

export type Vec3 = [number, number, number];

export type Severity = "None" | "Warning" | "Critical";

export interface ModRef {
  modId: string;
  revisionMin?: number;
  revisionMax?: number;
}

export interface ModDependency {
  mod: ModRef;
  modInfo?: { displayName?: string; url?: string };
  loadBefore?: boolean;
  optional?: boolean;
}

export interface ModIncompatibility {
  mod: ModRef;
}

/** `mod.json`. Unknown keys are preserved. */
export interface ModJson {
  modId: string;
  revision: number;
  severityAdd?: Severity;
  severityRemove?: Severity;
  visible?: boolean;
  cosmetic?: boolean;
  dependencies?: ModDependency[];
  incompatibilities?: ModIncompatibility[];
  [key: string]: unknown;
}

export interface ModAuthor {
  name: string;
  role: string;
}

export interface ModLocalization {
  name?: string;
  summary?: string;
  description?: string;
}

/** `_metadata/modinfo.json`. Unknown keys are preserved. */
export interface ModInfoJson {
  name: string;
  summary: string;
  description: string;
  localization?: Record<string, ModLocalization>;
  authors: ModAuthor[];
  tags: string[];
  dependencies?: string[];
  url?: string;
  [key: string]: unknown;
}

export type TransportMode =
  | "PERSON"
  | "CARGO"
  | "CAR"
  | "BUS"
  | "TRUCK"
  | "TRAM"
  | "ELECTRIC_TRAM"
  | "TRAIN"
  | "ELECTRIC_TRAIN"
  | "AIRCRAFT"
  | "SHIP"
  | "SMALL_AIRCRAFT"
  | "SMALL_SHIP"
  | "HELICOPTER"
  | "TRAM_TRACK"
  | "ELECTRIC_TRAM_TRACK";

export type EdgeListType = "STREET" | "TRACK";

export interface SnapPoint {
  snapToBaseEdgeTypes?: EdgeListType[];
  allowSnapToBaseEdgeEnds?: boolean;
  alignWithCoast?: boolean;
  placeAtTerrainHeight?: boolean;
  transf?: Mat4;
  transportModes?: TransportMode[];
}

export interface ModelPlacement {
  /** Model resource id, for example `/placeholders/unit_cube.mdl`. */
  id: string;
  transf: Mat4;
  tag?: string;
}

export interface SubconstructionDoc {
  /** Editor-only name. Never exported. */
  label?: string;
  /** Integer tag written to the exported subconstruction. */
  tag?: number;
  /** Editor-only layer visibility. Never exported. */
  hidden?: boolean;
  models: ModelPlacement[];
}

export interface ConstructionDescription {
  name: string;
  description: string;
  icon?: string;
  previewIcon?: string;
}

export interface ConstructionAvailability {
  yearFrom: number;
  yearTo?: number;
}

export interface ConstructionMenuCategory {
  category: string;
  order: number;
}

export interface ConstructionCosts {
  cost?: number;
  maintenanceCost?: number;
  bulldozeCost?: number;
  noCostAtAll?: boolean;
}

/** One construction. Stored at `_metadata/constructions/<id>.json`. */
export interface ConstructionDoc {
  schemaVersion: 1;
  /** File base name of the exported `.con.lua` and `.script.tl`. */
  id: string;
  /** Folder under the mod's `content/`, for example `stations/custom`. */
  folder: string;
  description: ConstructionDescription;
  availability: ConstructionAvailability;
  menuCategory: ConstructionMenuCategory;
  costs: ConstructionCosts;
  snapPoint?: SnapPoint;
  metadata: Record<string, unknown>;
  subconstructions: SubconstructionDoc[];
}

export type IssueSeverity = "error" | "warning";

export interface Issue {
  severity: IssueSeverity;
  rule: string;
  /** Dotted path into the document, for example `subconstructions.0.models.2.id`. */
  path: string;
  message: string;
}
