import { type AssetFilters, CHIP_KINDS, type ChipKind } from "@cedit/schema";
import type { AssetFacet } from "./api.ts";
import { isSelected } from "./asset-filters.ts";

/** Most suggestions the list shows. */
export const MAX_SUGGESTIONS = 8;

/** The word being typed: the text after the last whitespace, and where it starts. */
export function trailingWord(text: string): { word: string; start: number } {
  const start = text.search(/\S*$/);
  return { word: text.slice(start), start };
}

/**
 * The group a typed prefix names, such as `vehicle` giving `vehicle` and `town`
 * giving the Towns & Cities group. A prefix names a group by its id or by the
 * start of its label.
 */
export function scopeOfPrefix(prefix: string): ChipKind | null {
  const p = prefix.toLowerCase();
  if (p === "") return null;
  const found = CHIP_KINDS.find((k) =>
    k.kind === p || k.label.toLowerCase().startsWith(p)
  );
  return found?.kind ?? null;
}

/** 0 when the label starts with the term, 1 when a word of it does, else 2. */
function rank(label: string, term: string): number {
  const text = label.toLowerCase();
  if (text.startsWith(term)) return 0;
  if (text.split(/[\s:/]+/).some((w) => w.startsWith(term))) return 1;
  return 2;
}

/**
 * The tags that match the word being typed. `vehicle:tr` limits the match to
 * the Vehicle Type group, and `vehicle:` alone lists that group by model count.
 * Tags already selected are left out. Best matches come first, then the ones
 * with more models. `start` is where the typed word starts, so the caller can
 * remove it from the text when a suggestion is taken.
 */
export function suggestTags(
  text: string,
  facets: readonly AssetFacet[],
  selected: AssetFilters,
  limit = MAX_SUGGESTIONS,
): { suggestions: AssetFacet[]; start: number } {
  const { word, start } = trailingWord(text);
  const colon = word.indexOf(":");
  const scope = colon > 0 ? scopeOfPrefix(word.slice(0, colon)) : null;
  const term = (scope ? word.slice(colon + 1) : word).toLowerCase();
  if (word === "" || (term === "" && scope === null)) {
    return { suggestions: [], start };
  }
  const suggestions = facets
    .filter((f) =>
      (scope === null || f.kind === scope) &&
      !isSelected(selected, f.kind, f.label) &&
      f.label.toLowerCase().includes(term)
    )
    .sort((a, b) =>
      rank(a.label, term) - rank(b.label, term) || b.count - a.count ||
      a.label.localeCompare(b.label)
    )
    .slice(0, limit);
  return { suggestions, start };
}
