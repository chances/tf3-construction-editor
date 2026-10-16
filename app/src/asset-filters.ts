import { type AssetFilters, CHIP_KINDS } from "@cedit/schema";
import type { AssetFacet } from "./api.ts";

/**
 * Reads the selected filters from a URL query string. Each group is one
 * parameter with comma separated labels, such as
 * `domain=animals,game%20mechanics`. Labels come back as written, and chip
 * matching ignores case.
 */
export function filtersFromSearch(search: string): AssetFilters {
  const params = new URLSearchParams(search);
  const filters: AssetFilters = {};
  for (const { kind } of CHIP_KINDS) {
    const labels = (params.get(kind) ?? "").split(",").map((l) => l.trim())
      .filter((l) => l !== "");
    if (labels.length > 0) filters[kind] = [...new Set(labels)];
  }
  return filters;
}

/** A label for the query string: a space is `+`, and a real plus is `%2B`. */
function encodeLabel(label: string): string {
  return encodeURIComponent(label).replaceAll("%20", "+");
}

/** The search text in the `q` parameter of a URL query string. */
export function queryFromSearch(search: string): string {
  return new URLSearchParams(search).get("q") ?? "";
}

/**
 * The query string with the search text as `q` and the filter parameters
 * replaced by `filters`, each group as one parameter of lowercase, comma
 * separated labels, such as `domain=animals,game+mechanics`. An empty `query`
 * leaves out `q`. Other parameters stay. The result has no leading `?` and is
 * empty without parameters.
 */
export function searchWithState(
  search: string,
  filters: AssetFilters,
  query: string,
): string {
  const params = new URLSearchParams(search);
  for (const { kind } of CHIP_KINDS) params.delete(kind);
  if (query === "") params.delete("q");
  else params.set("q", query);
  const groups = CHIP_KINDS.flatMap(({ kind }) => {
    const labels = [
      ...new Set((filters[kind] ?? []).map((l) => l.toLowerCase())),
    ];
    return labels.length > 0
      ? [`${kind}=${labels.map(encodeLabel).join(",")}`]
      : [];
  });
  return [params.toString(), ...groups].filter((p) => p !== "").join("&");
}

/** How many labels are selected across all kinds. */
export function filterCount(filters: AssetFilters): number {
  return CHIP_KINDS.reduce(
    (n, { kind }) => n + (filters[kind]?.length ?? 0),
    0,
  );
}

/** True when the label is selected in the group, ignoring case. */
export function isSelected(
  filters: AssetFilters,
  kind: AssetFacet["kind"],
  label: string,
): boolean {
  const lower = label.toLowerCase();
  return (filters[kind] ?? []).some((l) => l.toLowerCase() === lower);
}

/** The filters with each label spelled as the chip of the same group spells it. */
export function canonicalFilters(
  filters: AssetFilters,
  facets: readonly AssetFacet[],
): AssetFilters {
  const result: AssetFilters = {};
  for (const { kind } of CHIP_KINDS) {
    const labels = filters[kind];
    if (!labels) continue;
    result[kind] = labels.map((l) =>
      facets.find((f) =>
        f.kind === kind && f.label.toLowerCase() === l.toLowerCase()
      )
        ?.label ?? l
    );
  }
  return result;
}
