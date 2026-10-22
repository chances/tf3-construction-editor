import {
  isValidContentFolder,
  isValidModId,
  isValidResourceName,
} from "./names.ts";
import {
  isCounterClockwise,
  MIN_FACE_POINTS,
  selfIntersects,
} from "./ground-face.ts";
import { decomposeTransf } from "./transform.ts";
import type {
  ConstructionDoc,
  GroundFaceDoc,
  Issue,
  ModInfoJson,
  ModJson,
} from "./types.ts";

export const NAME_MAX = 32;
export const DESCRIPTION_MAX = 320;

/** Fields whose exported form has no in-game confirmation yet. */
export const UNVERIFIED_FIELDS: Record<string, string> = {
  snapPoint: "Exported from the tealdef shape. Not checked in game.",
  dependencyModelPrefix:
    "The `mod_id::/path` form for a dependency model id is not checked in game.",
  modelScale: "A scaled model transform is not checked in game.",
  groundFaceAlignment:
    "`loop` and the alignment fields come from the wiki and are not checked in game.",
};

export interface LintContext {
  /** Returns true when the model id exists in the asset index. */
  resolveModel(id: string): boolean;
  /**
   * Returns true when the image id exists in the image index, false when it
   * does not, and `null` when the index cannot say (the game is not set up).
   * Omit it to skip image checks.
   */
  resolveImage?(id: string): boolean | null;
}

/** Why an image id is not valid, written for the person who typed it. */
export function missingImageMessage(id: string): string {
  return id.endsWith("/")
    ? `${id} is a folder, not an image. Pick an image inside it.`
    : `${id} is not an image in the game, this mod, or its dependencies. Pick one from the list.`;
}

export const MOD_NAME_MAX = 32;
export const MOD_SUMMARY_MAX = 100;

/**
 * True when the required Mod Details are filled in: a name and a summary, each
 * within the wiki length limit. Everything else is optional.
 */
export function isModDetailsComplete(info: ModInfoJson): boolean {
  return info.name.trim() !== "" && info.name.length <= MOD_NAME_MAX &&
    info.summary.trim() !== "" && info.summary.length <= MOD_SUMMARY_MAX;
}

export function lintMod(mod: ModJson): Issue[] {
  const issues: Issue[] = [];
  if (!isValidModId(mod.modId)) {
    issues.push({
      severity: "error",
      rule: "mod-id-characters",
      path: "mod.modId",
      message: "modId may use only a-z, 0-9, and _.",
    });
  }
  return issues;
}

/** True when the id points into another mod (`mod_id::/path`). */
export function isDependencyModelId(id: string): boolean {
  const at = id.indexOf("::");
  return at > 0;
}

/** Lint rules for one ground face. `path` is the face's path in the document. */
export function lintGroundFace(face: GroundFaceDoc, path: string): Issue[] {
  const issues: Issue[] = [];
  if (face.points.length < MIN_FACE_POINTS) {
    issues.push({
      severity: "error",
      rule: "ground-face-points",
      path: `${path}.points`,
      message: `A ground face needs at least ${MIN_FACE_POINTS} points.`,
    });
  } else {
    if (!isCounterClockwise(face.points)) {
      issues.push({
        severity: "error",
        rule: "ground-face-winding",
        path: `${path}.points`,
        message: "The ground face points must run counterclockwise.",
      });
    }
    if (selfIntersects(face.points)) {
      issues.push({
        severity: "warning",
        rule: "ground-face-self-intersects",
        path: `${path}.points`,
        message: "Two edges of the ground face cross each other.",
      });
    }
  }
  face.modes.forEach((mode, mi) => {
    if (mode.key.trim() === "") {
      issues.push({
        severity: "error",
        rule: "ground-face-key",
        path: `${path}.modes.${mi}.key`,
        message: "Pick a ground texture for this paint mode.",
      });
    }
    if (mode.texCoords && mode.texCoords.length !== face.points.length) {
      issues.push({
        severity: "error",
        rule: "ground-face-tex-coords",
        path: `${path}.modes.${mi}.texCoords`,
        message:
          `The texture coordinates need one entry per point (${face.points.length}).`,
      });
    }
  });
  if (face.modes.length === 0) {
    issues.push({
      severity: "warning",
      rule: "ground-face-modes",
      path: `${path}.modes`,
      message: "A ground face with no paint mode paints nothing.",
    });
  }
  const usesAlignment = face.loop !== undefined ||
    face.alignmentOffsetMode !== undefined ||
    face.alignmentOffset !== undefined ||
    face.alignmentDirMode !== undefined ||
    face.alignmentDir !== undefined;
  if (usesAlignment) {
    issues.push({
      severity: "warning",
      rule: "unverified-field",
      path,
      message: UNVERIFIED_FIELDS.groundFaceAlignment,
    });
  }
  return issues;
}

export function lintConstruction(
  doc: ConstructionDoc,
  ctx: LintContext,
): Issue[] {
  const issues: Issue[] = [];
  if (!isValidResourceName(doc.id)) {
    issues.push({
      severity: "error",
      rule: "construction-id-characters",
      path: "id",
      message: "The id may use only a-z, 0-9, _, and -.",
    });
  }
  if (!isValidContentFolder(doc.folder)) {
    issues.push({
      severity: "error",
      rule: "content-folder-characters",
      path: "folder",
      message: "Each folder segment may use only a-z, 0-9, _, and -.",
    });
  }
  if (doc.description.name.length > NAME_MAX) {
    issues.push({
      severity: "error",
      rule: "description-name-length",
      path: "description.name",
      message: `The name is longer than ${NAME_MAX} characters.`,
    });
  }
  if (doc.description.description.length > DESCRIPTION_MAX) {
    issues.push({
      severity: "error",
      rule: "description-length",
      path: "description.description",
      message: `The description is longer than ${DESCRIPTION_MAX} characters.`,
    });
  }
  for (const field of ["icon", "previewIcon"] as const) {
    const id = doc.description[field]?.trim() ?? "";
    if (id !== "" && ctx.resolveImage?.(id) === false) {
      issues.push({
        severity: "warning",
        rule: "image-resolves",
        path: `description.${field}`,
        message: missingImageMessage(id),
      });
    }
  }
  doc.subconstructions.forEach((sub, si) => {
    (sub.groundFaces ?? []).forEach((face, fi) => {
      issues.push(
        ...lintGroundFace(face, `subconstructions.${si}.groundFaces.${fi}`),
      );
    });
    sub.models.forEach((model, mi) => {
      const path = `subconstructions.${si}.models.${mi}.id`;
      if (!ctx.resolveModel(model.id)) {
        issues.push({
          severity: "error",
          rule: "model-resolves",
          path,
          message: `Model id ${model.id} is not in the asset index.`,
        });
      }
      if (Math.abs(decomposeTransf(model.transf).scale - 1) > 1e-9) {
        issues.push({
          severity: "warning",
          rule: "unverified-field",
          path: `subconstructions.${si}.models.${mi}.transf`,
          message: UNVERIFIED_FIELDS.modelScale,
        });
      }
      if (isDependencyModelId(model.id)) {
        issues.push({
          severity: "warning",
          rule: "unverified-field",
          path,
          message: UNVERIFIED_FIELDS.dependencyModelPrefix,
        });
      }
    });
  });
  if (doc.snapPoint !== undefined) {
    issues.push({
      severity: "warning",
      rule: "unverified-field",
      path: "snapPoint",
      message: UNVERIFIED_FIELDS.snapPoint,
    });
  }
  return issues;
}

export function hasErrors(issues: Issue[]): boolean {
  return issues.some((i) => i.severity === "error");
}
