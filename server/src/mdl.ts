import {
  identityMat4,
  isMat4,
  type Mat4,
  multiplyMat4,
  type Vec3,
} from "@cedit/schema";
import { type LuaValue, parseLuaTable } from "./luatab.ts";

export class MdlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MdlError";
  }
}

export interface MdlMeshNode {
  /** Mesh path relative to the `.mdl`. */
  mesh: string;
  /** Node transform composed with all parent transforms. */
  world: Mat4;
}

export interface MdlSummary {
  bbMin: Vec3;
  bbMax: Vec3;
  lodCount: number;
  collider?: { type: string; halfExtents?: Vec3 };
  /** Mesh paths of the highest detail LOD, relative to the `.mdl`. */
  lod0Meshes: string[];
  /** Mesh nodes of the highest detail LOD with their model-space transforms. */
  lod0Nodes: MdlMeshNode[];
}

type Table = { [key: string]: LuaValue };

function isTable(v: LuaValue | undefined): v is Table {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asList(v: LuaValue | undefined): LuaValue[] {
  if (Array.isArray(v)) return v;
  if (isTable(v)) {
    return Object.keys(v).filter((k) => /^\d+$/.test(k))
      .sort((a, b) => Number(a) - Number(b)).map((k) => v[k]);
  }
  return [];
}

function vec3(v: LuaValue | undefined, what: string): Vec3 {
  const list = asList(v);
  if (list.length !== 3 || !list.every((n) => typeof n === "number")) {
    throw new MdlError(`${what} must be three numbers.`);
  }
  return list as Vec3;
}

function nodeTransf(node: Table): Mat4 {
  const list = asList(node.transf);
  return isMat4(list) ? list : identityMat4();
}

function collectMeshes(
  node: LuaValue | undefined,
  parent: Mat4,
  out: MdlMeshNode[],
) {
  if (!isTable(node)) return;
  const world = multiplyMat4(parent, nodeTransf(node));
  if (typeof node.mesh === "string") out.push({ mesh: node.mesh, world });
  for (const child of asList(node.children)) collectMeshes(child, world, out);
}

/** Reads the facts the editor needs from the text of an `.mdl` file. */
export function parseMdl(text: string): MdlSummary {
  const root = parseLuaTable(text);
  if (!isTable(root)) throw new MdlError("The .mdl root is not a table.");
  const info = root.boundingInfo;
  if (!isTable(info)) throw new MdlError("boundingInfo is missing.");
  const lods = asList(root.lods);
  const summary: MdlSummary = {
    bbMin: vec3(info.bbMin, "boundingInfo.bbMin"),
    bbMax: vec3(info.bbMax, "boundingInfo.bbMax"),
    lodCount: lods.length,
    lod0Meshes: [],
    lod0Nodes: [],
  };
  const collider = root.collider;
  if (isTable(collider) && typeof collider.type === "string") {
    summary.collider = { type: collider.type };
    const params = collider.params;
    if (isTable(params) && params.halfExtents !== undefined) {
      summary.collider.halfExtents = vec3(
        params.halfExtents,
        "collider.params.halfExtents",
      );
    }
  }
  const lod0 = lods[0];
  if (isTable(lod0)) {
    collectMeshes(lod0.node, identityMat4(), summary.lod0Nodes);
  }
  summary.lod0Meshes = summary.lod0Nodes.map((n) => n.mesh);
  return summary;
}
