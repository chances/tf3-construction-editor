import {
  isValidContentFolder,
  isValidModId,
  isValidResourceName,
} from "./names.ts";
import { decomposeTransf } from "./transform.ts";
import type { ConstructionDoc, Issue, ModInfoJson, ModJson } from "./types.ts";

export const NAME_MAX = 32;
export const DESCRIPTION_MAX = 320;

/** Fields whose exported form has no in-game confirmation yet. */
export const UNVERIFIED_FIELDS: Record<string, string> = {
  snapPoint: "Exported from the tealdef shape. Not checked in game.",
  dependencyModelPrefix:
    "The `mod_id::/path` form for a dependency model id is not checked in game.",
  modelScale: "A scaled model transform is not checked in game.",
};

export interface LintContext {
  /** Returns true when the model id exists in the asset index. */
  resolveModel(id: string): boolean;
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
  doc.subconstructions.forEach((sub, si) => {
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
