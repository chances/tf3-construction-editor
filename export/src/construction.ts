import { type ConstructionDoc, resolvedTexCoords } from "@cedit/schema";
import { toLua } from "./lua.ts";

/** The table returned by `updateFn`. */
export function buildResult(doc: ConstructionDoc): Record<string, unknown> {
  return {
    subconstructions: doc.subconstructions.map((sub) => ({
      models: sub.models.map((m) => ({
        id: m.id,
        transf: m.transf,
        tag: m.tag,
      })),
      groundFaces: sub.groundFaces?.length
        ? sub.groundFaces.map((face) => ({
          // The game ignores a face's Z, so every point is written at 0.
          face: face.points.map(([x, y]) => [x, y, 0]),
          modes: face.modes.map((mode) => ({
            type: mode.type,
            key: mode.key,
            texCoords: resolvedTexCoords(face, mode),
          })),
          loop: face.loop,
          alignmentOffsetMode: face.alignmentOffsetMode,
          alignmentOffset: face.alignmentOffset,
          alignmentDirMode: face.alignmentDirMode,
          alignmentDir: face.alignmentDir,
        }))
        : undefined,
      tag: sub.tag,
    })),
    cost: doc.costs.cost,
    maintenanceCost: doc.costs.maintenanceCost,
    bulldozeCost: doc.costs.bulldozeCost,
    noCostAtAll: doc.costs.noCostAtAll,
    snapPoint: doc.snapPoint,
    metadata: Object.keys(doc.metadata).length > 0 ? doc.metadata : undefined,
  };
}

/** `<id>.con.lua`: the data-only construction entry file. */
export function buildConLua(doc: ConstructionDoc): string {
  const table = {
    description: {
      name: doc.description.name,
      description: doc.description.description,
      icon: doc.description.icon,
      previewIcon: doc.description.previewIcon,
    },
    availability: {
      yearFrom: doc.availability.yearFrom,
      yearTo: doc.availability.yearTo,
    },
    menuCategory: {
      categories: [{
        category: doc.menuCategory.category,
        order: doc.menuCategory.order,
      }],
    },
    order: doc.menuCategory.order,
    params: [],
    updateScript: {
      fileName: `${doc.id}.script@updateFn`,
      params: {},
    },
  };
  return `function data()\n\nreturn ${toLua(table)}\n\nend\n`;
}

/** `<id>.script.tl`: the update script whose `updateFn` returns the data. */
export function buildScriptTl(doc: ConstructionDoc): string {
  const body = toLua(buildResult(doc), 1);
  return [
    "local data = {}",
    "",
    "function data.updateFn(_captureParams : table, _params : table) : ConstructionUtilSerialized.ConstructionResult",
    `\treturn ${body}`,
    "end",
    "",
    "return data",
    "",
  ].join("\n");
}
