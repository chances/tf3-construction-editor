import { type LuaValue, parseLuaTable } from "./luatab.ts";

export class MshError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MshError";
  }
}

export interface MeshGeometry {
  /** x, y, z per vertex. */
  positions: Float32Array;
  /** Three indices per triangle, into `positions` by vertex number. */
  triangles: Uint32Array;
}

type Table = { [key: string]: LuaValue };

function isTable(v: LuaValue | undefined): v is Table {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function listOf(v: LuaValue | undefined): LuaValue[] {
  if (Array.isArray(v)) return v;
  if (isTable(v)) {
    return Object.keys(v).filter((k) => /^\d+$/.test(k))
      .sort((a, b) => Number(a) - Number(b)).map((k) => v[k]);
  }
  return [];
}

function range(v: LuaValue | undefined, what: string, blobSize: number) {
  if (
    !isTable(v) || typeof v.offset !== "number" || typeof v.count !== "number"
  ) {
    throw new MshError(`${what} is missing offset or count.`);
  }
  if (v.offset < 0 || v.count < 0 || v.offset + v.count > blobSize) {
    throw new MshError(`${what} reaches past the end of the .msh.blob.`);
  }
  return { offset: v.offset, count: v.count, numComp: v.numComp };
}

/**
 * Reads positions and triangles from a `.msh` index and its `.msh.blob`.
 * `count` and `offset` are bytes. Indices are 32-bit little-endian only.
 */
export function parseMsh(text: string, blob: Uint8Array): MeshGeometry {
  const root = parseLuaTable(text);
  if (!isTable(root)) throw new MshError("The .msh root is not a table.");
  const attrs = root.vertexAttr;
  if (!isTable(attrs)) throw new MshError("vertexAttr is missing.");
  const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);

  const pos = range(attrs.position, "vertexAttr.position", blob.byteLength);
  if (pos.numComp !== 3) throw new MshError("position must have 3 components.");
  if (pos.count % 12 !== 0) {
    throw new MshError("position count is not a multiple of 12 bytes.");
  }
  const vertexCount = pos.count / 12;
  const positions = new Float32Array(vertexCount * 3);
  for (let i = 0; i < positions.length; i++) {
    positions[i] = view.getFloat32(pos.offset + i * 4, true);
  }

  const flat: number[] = [];
  listOf(root.subMeshes).forEach((sub, s) => {
    const indices = isTable(sub) ? sub.indices : undefined;
    const where = `subMeshes[${s}].indices.position`;
    const r = range(
      isTable(indices) ? indices.position : undefined,
      where,
      blob.byteLength,
    );
    if (r.count % 12 !== 0) {
      throw new MshError(`${where} is not a whole number of 32-bit triangles.`);
    }
    for (let i = 0; i < r.count / 4; i++) {
      const index = view.getUint32(r.offset + i * 4, true);
      if (index >= vertexCount) {
        throw new MshError(
          `${where} holds index ${index} but only ${vertexCount} positions exist. ` +
            "Only 32-bit indices are supported.",
        );
      }
      flat.push(index);
    }
  });
  return { positions, triangles: Uint32Array.from(flat) };
}
