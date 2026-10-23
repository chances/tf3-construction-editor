import { isMat4 } from "./transform.ts";
import type {
  AlignmentMode,
  ConstructionDoc,
  EdgeListDoc,
  EdgeListType,
  EdgeNodeDoc,
  EdgeObjectDoc,
  GroundFaceDoc,
  GroundFaceMode,
  GroundFaceModeType,
  LaneListDoc,
  LaneNodeDoc,
  ModelPlacement,
  ModInfoJson,
  ModJson,
  RunwayDoc,
  RunwayKind,
  SubconstructionDoc,
  TrafficLight,
  TransportMode,
  Vec3,
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

function pair(value: unknown, path: string): [number, number] {
  const a = arr(value, path);
  if (a.length !== 2) throw new SchemaError(path, "expected 2 numbers");
  return [num(a[0], `${path}.0`), num(a[1], `${path}.1`)];
}

function alignmentMode(value: unknown, path: string): AlignmentMode {
  if (value !== "OBJECT" && value !== "WORLD") {
    throw new SchemaError(path, 'expected "OBJECT" or "WORLD"');
  }
  return value;
}

const MODE_TYPES: GroundFaceModeType[] = [
  "FILL",
  "STROKE",
  "STROKE_INNER",
  "STROKE_OUTER",
];

function parseGroundFace(value: unknown, path: string): GroundFaceDoc {
  const o = obj(value, path);
  const face: GroundFaceDoc = {
    points: arr(o.points, `${path}.points`).map((p, i) =>
      pair(p, `${path}.points.${i}`)
    ),
    modes: arr(o.modes, `${path}.modes`).map((m, i) => {
      const mp = `${path}.modes.${i}`;
      const mo = obj(m, mp);
      const type = str(mo.type, `${mp}.type`) as GroundFaceModeType;
      if (!MODE_TYPES.includes(type)) {
        throw new SchemaError(`${mp}.type`, `expected one of ${MODE_TYPES}`);
      }
      const mode: GroundFaceMode = { type, key: str(mo.key, `${mp}.key`) };
      if (mo.texCoords !== undefined) {
        mode.texCoords = arr(mo.texCoords, `${mp}.texCoords`).map((t, k) =>
          pair(t, `${mp}.texCoords.${k}`)
        );
      }
      return mode;
    }),
  };
  const label = optStr(o, "label", path);
  if (label !== undefined) face.label = label;
  if (o.loop !== undefined) {
    if (typeof o.loop !== "boolean") {
      throw new SchemaError(`${path}.loop`, "expected a boolean");
    }
    face.loop = o.loop;
  }
  if (o.alignmentOffsetMode !== undefined) {
    face.alignmentOffsetMode = alignmentMode(
      o.alignmentOffsetMode,
      `${path}.alignmentOffsetMode`,
    );
  }
  if (o.alignmentOffset !== undefined) {
    face.alignmentOffset = pair(o.alignmentOffset, `${path}.alignmentOffset`);
  }
  if (o.alignmentDirMode !== undefined) {
    face.alignmentDirMode = alignmentMode(
      o.alignmentDirMode,
      `${path}.alignmentDirMode`,
    );
  }
  if (o.alignmentDir !== undefined) {
    face.alignmentDir = pair(o.alignmentDir, `${path}.alignmentDir`);
  }
  return face;
}

function bool(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") {
    throw new SchemaError(path, "expected a boolean");
  }
  return value;
}

function vec3(value: unknown, path: string): Vec3 {
  const a = arr(value, path);
  if (a.length !== 3) throw new SchemaError(path, "expected 3 numbers");
  return [
    num(a[0], `${path}.0`),
    num(a[1], `${path}.1`),
    num(a[2], `${path}.2`),
  ];
}

function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  path: string,
): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new SchemaError(path, `expected one of ${allowed.join(", ")}`);
  }
  return value as T;
}

const TRANSPORT_MODES: TransportMode[] = [
  "PERSON",
  "CARGO",
  "CAR",
  "BUS",
  "TRUCK",
  "TRAM",
  "ELECTRIC_TRAM",
  "TRAIN",
  "ELECTRIC_TRAIN",
  "AIRCRAFT",
  "SHIP",
  "SMALL_AIRCRAFT",
  "SMALL_SHIP",
  "HELICOPTER",
  "TRAM_TRACK",
  "ELECTRIC_TRAM_TRACK",
];

function parseLaneList(value: unknown, path: string): LaneListDoc {
  const o = obj(value, path);
  const lane: LaneListDoc = {
    nodes: arr(o.nodes, `${path}.nodes`).map((n, i) => {
      const np = `${path}.nodes.${i}`;
      const no = obj(n, np);
      const node: LaneNodeDoc = {
        pos: vec3(no.pos, `${np}.pos`),
        width: num(no.width, `${np}.width`),
      };
      if (no.tangent !== undefined) {
        node.tangent = vec3(no.tangent, `${np}.tangent`);
      }
      return node;
    }),
    transportModes: arr(o.transportModes, `${path}.transportModes`).map((
      m,
      i,
    ) => oneOf(m, TRANSPORT_MODES, `${path}.transportModes.${i}`)),
    speedLimit: num(o.speedLimit, `${path}.speedLimit`),
    linkable: bool(o.linkable, `${path}.linkable`),
    forwardOnly: bool(o.forwardOnly, `${path}.forwardOnly`),
    needsReservation: bool(o.needsReservation, `${path}.needsReservation`),
    pedestrianWalkPenalty: num(
      o.pedestrianWalkPenalty,
      `${path}.pedestrianWalkPenalty`,
    ),
  };
  const label = optStr(o, "label", path);
  if (label !== undefined) lane.label = label;
  if (o.transf !== undefined) {
    if (!isMat4(o.transf)) {
      throw new SchemaError(`${path}.transf`, "expected 16 finite numbers");
    }
    lane.transf = o.transf;
  }
  return lane;
}

function parseRunway(value: unknown, path: string): RunwayDoc {
  const o = obj(value, path);
  const runway: RunwayDoc = {
    kind: oneOf<RunwayKind>(o.kind, ["LANDING", "TAKEOFF"], `${path}.kind`),
    edgeList: str(o.edgeList, `${path}.edgeList`),
    edges: arr(o.edges, `${path}.edges`).map((e, i) =>
      num(e, `${path}.edges.${i}`)
    ),
  };
  const label = optStr(o, "label", path);
  if (label !== undefined) runway.label = label;
  const node = optNum(o, "node", path);
  if (node !== undefined) runway.node = node;
  return runway;
}

function parseEdgeList(value: unknown, path: string): EdgeListDoc {
  const o = obj(value, path);
  const list: EdgeListDoc = {
    id: str(o.id, `${path}.id`),
    type: oneOf<EdgeListType>(o.type, ["STREET", "TRACK"], `${path}.type`),
    typeName: str(o.typeName, `${path}.typeName`),
    alignTerrain: bool(o.alignTerrain, `${path}.alignTerrain`),
    nodes: arr(o.nodes, `${path}.nodes`).map((n, i) => {
      const np = `${path}.nodes.${i}`;
      const no = obj(n, np);
      const node: EdgeNodeDoc = { pos: vec3(no.pos, `${np}.pos`) };
      if (no.tangent !== undefined) {
        node.tangent = vec3(no.tangent, `${np}.tangent`);
      }
      if (no.snap !== undefined) node.snap = bool(no.snap, `${np}.snap`);
      if (no.free !== undefined) node.free = bool(no.free, `${np}.free`);
      if (no.trafficLight !== undefined) {
        node.trafficLight = oneOf<TrafficLight>(
          no.trafficLight,
          ["YES", "NO", "AUTO"],
          `${np}.trafficLight`,
        );
      }
      return node;
    }),
    edges: arr(o.edges, `${path}.edges`).map((e, i) => {
      const pair = arr(e, `${path}.edges.${i}`);
      if (pair.length !== 2) {
        throw new SchemaError(`${path}.edges.${i}`, "expected 2 node indices");
      }
      return [
        num(pair[0], `${path}.edges.${i}.0`),
        num(pair[1], `${path}.edges.${i}.1`),
      ] as [number, number];
    }),
  };
  const label = optStr(o, "label", path);
  if (label !== undefined) list.label = label;
  if (o.tag2nodes !== undefined) {
    const tags = obj(o.tag2nodes, `${path}.tag2nodes`);
    list.tag2nodes = Object.fromEntries(
      Object.entries(tags).map(([tag, nodes]) => [
        tag,
        arr(nodes, `${path}.tag2nodes.${tag}`).map((n, i) =>
          num(n, `${path}.tag2nodes.${tag}.${i}`)
        ),
      ]),
    );
  }
  return list;
}

function parseEdgeObject(value: unknown, path: string): EdgeObjectDoc {
  const o = obj(value, path);
  return {
    model: str(o.model, `${path}.model`),
    edgeList: str(o.edgeList, `${path}.edgeList`),
    edge: num(o.edge, `${path}.edge`),
    param: num(o.param, `${path}.param`),
    left: bool(o.left, `${path}.left`),
  };
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
  if (o.laneLists !== undefined) {
    sub.laneLists = arr(o.laneLists, `${path}.laneLists`).map((l, i) =>
      parseLaneList(l, `${path}.laneLists.${i}`)
    );
  }
  if (o.runways !== undefined) {
    sub.runways = arr(o.runways, `${path}.runways`).map((r, i) =>
      parseRunway(r, `${path}.runways.${i}`)
    );
  }
  if (o.groundFaces !== undefined) {
    sub.groundFaces = arr(o.groundFaces, `${path}.groundFaces`).map((f, i) =>
      parseGroundFace(f, `${path}.groundFaces.${i}`)
    );
  }
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
  if (o.edgeLists !== undefined) {
    doc.edgeLists = arr(o.edgeLists, "construction.edgeLists").map((l, i) =>
      parseEdgeList(l, `construction.edgeLists.${i}`)
    );
  }
  if (o.edgeObjects !== undefined) {
    doc.edgeObjects = arr(o.edgeObjects, "construction.edgeObjects").map(
      (e, i) => parseEdgeObject(e, `construction.edgeObjects.${i}`),
    );
  }
  if (o.snapPoint !== undefined) {
    doc.snapPoint = obj(
      o.snapPoint,
      "construction.snapPoint",
    ) as ConstructionDoc["snapPoint"];
  }
  return doc;
}
