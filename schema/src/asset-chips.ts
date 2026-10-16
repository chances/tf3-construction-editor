import pluralize from "pluralize-esm";
import { titleCaseId } from "./names.ts";

/** The plural of an English noun, such as `animal` to `animals`. */
export function pluralNoun(noun: string): string {
  return pluralize.plural(noun);
}

/**
 * One chip on an asset card. `zone` picks the chip color, and `aliases` are
 * extra words that search matches although the card does not show them.
 */
export interface AssetChip {
  label: string;
  zone?: "com" | "ind" | "res";
  aliases?: string[];
  /** Set by `assetChips`: the group of filters the chip belongs to. */
  kind?: ChipKind;
}

/** The groups of chips in the filters overlay, in display order. */
export const CHIP_KINDS = [
  { kind: "source", label: "Source" },
  { kind: "mod", label: "Mod" },
  { kind: "domain", label: "Domain" },
  { kind: "vehicle", label: "Vehicle Type" },
  { kind: "station", label: "Station Type" },
  { kind: "infrastructure", label: "Infrastructure Type" },
  { kind: "industry", label: "Industry" },
  { kind: "cargo", label: "Cargo" },
  { kind: "town", label: "Towns & Cities" },
  { kind: "variant", label: "Variant" },
  { kind: "size", label: "Size" },
  { kind: "folder", label: "Category" },
] as const;

export type ChipKind = typeof CHIP_KINDS[number]["kind"];

/** The selected filter labels of each kind. */
export type AssetFilters = Partial<Record<ChipKind, string[]>>;

/** A folder chip label that holds a footprint such as `11x21` is a size. */
const SIZE_LABEL = /\dx\d/;

/** The folder index after a size, so `1x1 1` and `1x1 2` are both `1x1`. */
const TRAILING_INDEX = / \d+$/;

/** The identity of a chip, `kind` plus `label`, such as `folder:Animals`. */
export function chipKey(chip: { kind?: ChipKind; label: string }): string {
  return `${chip.kind ?? ""}:${chip.label}`;
}

/** Search words for a chip that is not a word of its label. */
const ALIASES: Record<string, string[]> = {
  "I/O": ["input", "output"],
};

const ZONES = {
  com: "Commercial",
  ind: "Industrial",
  res: "Residential",
} as const;

/** The zone a chip label names, such as `Commercial` giving `com`. */
export function zoneOfLabel(label: string): AssetChip["zone"] {
  return (Object.keys(ZONES) as (keyof typeof ZONES)[]).find((z) =>
    ZONES[z] === label
  );
}

const SOURCES: Record<string, string> = {
  base: "Built-in",
  mod: "Mod",
  dependency: "Dependency",
};

/** Name prefixes that are game abbreviations, and their chip labels. */
const PREFIXES: Record<string, string> = {
  cr: "Critter",
};

/** Name suffixes that describe a variant of a model, and their chip labels. */
const SUFFIXES: Record<string, string> = {
  high: "High-Poly",
  hi: "High-Poly",
  low: "Low-Poly",
  tram: "Tram",
  cargo: "Cargo",
  input: "I/O",
  output: "I/O",
  idle: "State: Idle",
  open: "State: Open",
  closed: "State: Closed",
  lft: "Left",
  rgt: "Right",
};

/**
 * Leading words that say what kind of thing a model is. They move to the end
 * of the title in parentheses, so `bird_crane` reads `Crane (Bird)`.
 */
const QUALIFIERS: Record<string, string> = {
  bird: "Bird",
};

/**
 * Splits a name into words. A leading abbreviation moves into `tags`, and a
 * leading qualifier moves into `qualifiers`.
 */
function wordsOf(
  name: string,
  tags: string[],
  qualifiers: string[] = [],
): string[] {
  const words = name.split(/[_-]+/).filter((w) => w !== "");
  while (words.length > 1) {
    if (words[0] in PREFIXES) tags.push(PREFIXES[words.shift()!]);
    else if (words[0] in QUALIFIERS) {
      qualifiers.push(QUALIFIERS[words.shift()!]);
    } else break;
  }
  return words;
}

/** `Crane` and `["Bird"]` become `Crane (Bird)`. */
function qualified(label: string, qualifiers: string[]): string {
  return qualifiers.length > 0 ? `${label} (${qualifiers.join(", ")})` : label;
}

/** `03` becomes `3` and `00` becomes `0`. Other words are unchanged. */
function plainNumber(word: string): string {
  return /^\d+$/.test(word) ? String(Number(word)) : word;
}

/** `animal` becomes `Animals`. A word that is already plural stays plural. */
function pluralLabel(words: string[]): string {
  if (words.length === 0) return "";
  const plain = words.map(plainNumber);
  const last = plain[plain.length - 1];
  if (!/^\d+$/.test(last)) plain[plain.length - 1] = pluralNoun(last);
  return titleCaseId(plain.join("_"));
}

/** Words that are dropped from a title and get no chip. Meaning unknown. */
const DROPPED = new Set(["prod"]);

/**
 * Words that make a file one variant of a model: the detail level and the
 * animation state. Files whose names differ only in these words are one model.
 */
const VARIANT_WORDS = new Set([
  "high",
  "hi",
  "low",
  "idle",
  "open",
  "closed",
  "prod",
]);

/** The base name without the trailing variant words, such as `cow_2`. */
function stemOf(base: string): string {
  const words = base.split(/[_-]+/).filter((w) => w !== "");
  while (words.length > 1 && VARIANT_WORDS.has(words[words.length - 1])) {
    words.pop();
  }
  return words.join("_");
}

/**
 * The parts of a model card: the Title Case name, the file base name without
 * `.mdl`, the base name without its variant words (`stem`), and a chip label
 * for each abbreviation prefix and variant suffix taken off the name.
 * `/animal/cr_fish/cr_fish_01.mdl` gives `Fish 1`, `cr_fish_01`, and the tag
 * `Critter`. `/animal/cow/cow_2_prod_high.mdl` gives `Cow 2`, stem `cow_2`,
 * and the tag `High-Poly`. A name that is only an abbreviation or a suffix
 * keeps it.
 */
export function modelNames(
  id: string,
): { title: string; base: string; stem: string; tags: string[] } {
  const file = id.split("/").pop() ?? id;
  const base = file.replace(/\.mdl$/i, "");
  const tags: string[] = [];
  const qualifiers: string[] = [];
  const words = wordsOf(base, tags, qualifiers);
  const suffixes: string[] = [];
  while (words.length > 1) {
    const last = words[words.length - 1];
    if (last in SUFFIXES) suffixes.unshift(SUFFIXES[words.pop()!]);
    else if (DROPPED.has(last)) words.pop();
    else break;
  }
  const animated = suffixes.some((s) => s.startsWith("State: "));
  return {
    title: qualified(titleCaseId(words.map(plainNumber).join("_")), qualifiers),
    base,
    stem: stemOf(base),
    tags: [...tags, ...suffixes, ...(animated ? ["Animated"] : [])],
  };
}

/**
 * The key shared by every variant of one model: its folder and its stem.
 * `/animal/cow/cow_2_prod_low.mdl` and `/animal/cow/cow_2_idle.mdl` share
 * `/animal/cow/cow_2`.
 */
export function assetGroupKey(id: string): string {
  const folder = id.split("/").slice(0, -1).join("/");
  return `${folder}/${modelNames(id).stem}`;
}

/** The variant a card places: a high-poly file, else the one with no variant. */
function representativeOf<T extends { id: string }>(variants: T[]): T {
  const names = variants.map((v) => modelNames(v.id));
  const high = names.findIndex((n) => n.tags.includes("High-Poly"));
  if (high >= 0) return variants[high];
  const plain = names.findIndex((n) => n.stem === n.base);
  return variants[plain >= 0 ? plain : 0];
}

/** One model with all of its variant files. `entry` is the one it places. */
export interface AssetGroup<T extends { id: string }> {
  entry: T;
  variants: T[];
}

/** Merges the entries that are variants of one model, in first-seen order. */
export function groupAssets<T extends { id: string }>(
  entries: Iterable<T>,
): AssetGroup<T>[] {
  const byKey = new Map<string, T[]>();
  for (const entry of entries) {
    const key = assetGroupKey(entry.id);
    const list = byKey.get(key);
    if (list) list.push(entry);
    else byKey.set(key, [entry]);
  }
  return [...byKey.values()].map((variants) => ({
    entry: representativeOf(variants),
    variants,
  }));
}

/** The chip for an asset source, such as `base` becoming `Built-in`. */
export function sourceChip(source: string): AssetChip {
  return { label: SOURCES[source] ?? titleCaseId(source) };
}

/**
 * The path chips for a model id. A `building` or `buildings` folder followed by
 * `com`, `ind`, or `res` gives a zone chip, and each folder after it gives a
 * generic chip. Any other path gives one pluralized chip per folder.
 */
export function pathChips(id: string): AssetChip[] {
  const folders = id.split("/").filter((s) => s !== "").slice(0, -1);
  const at = folders.findIndex((s, i) =>
    /^buildings?$/.test(s) && folders[i + 1] in ZONES
  );
  const chips = (segments: string[]): AssetChip[] =>
    segments.flatMap((s) => {
      const tags: string[] = [];
      const qualifiers: string[] = [];
      const label = qualified(
        pluralLabel(wordsOf(s, tags, qualifiers)),
        qualifiers,
      );
      return [...tags.map((t) => ({ label: t })), { label }];
    });
  if (at >= 0) {
    const zone = folders[at + 1] as keyof typeof ZONES;
    return [{ label: ZONES[zone], zone }, ...chips(folders.slice(at + 2))];
  }
  return chips(folders);
}

/** Domain labels where plural of the folder name reads wrong. */
const DOMAIN_LABELS: Record<string, string> = {
  infrastructure: "Infrastructure",
  cargos: "Cargo",
};

/** Domains that belong in the Towns & Cities group, not in Domain. */
const TOWN_DOMAINS = new Set(["landmarks"]);

/** `buildings/a/c1` is era A, commercial level 1. */
const ERA_FOLDER = /^[abc]$/;
const LEVEL_FOLDER = /^([cir])(\d)$/;
const LEVEL_ZONES: Record<string, keyof typeof ZONES> = {
  c: "com",
  i: "ind",
  r: "res",
};

/** The section that holds the second folder, by the first folder. */
const TYPE_SECTIONS: Record<string, ChipKind> = {
  vehicle: "vehicle",
  stations: "station",
  infrastructure: "infrastructure",
  industries: "industry",
  cargos: "cargo",
};

/**
 * The domain chip (the first folder, ignoring a leading `assets`) and, for a
 * domain with types, the type chip (the second folder). `/vehicle/train/a.mdl`
 * gives `Vehicles` and `Train`. The path chips of these folders are left out
 * of the category.
 */
function pathSections(
  id: string,
): { chips: AssetChip[]; consumed: Set<string> } {
  const folders = id.split("/").filter((s) => s !== "" && !s.includes("::"))
    .slice(0, -1);
  const [domain, type] = folders.slice(folders[0] === "assets" ? 1 : 0);
  const chips: AssetChip[] = [];
  const consumed = new Set<string>();
  const plural = (seg: string) => pluralLabel(wordsOf(seg, [], []));
  if (domain === undefined) return { chips, consumed };
  chips.push({
    kind: TOWN_DOMAINS.has(domain) ? "town" : "domain",
    label: DOMAIN_LABELS[domain] ?? plural(domain),
  });
  consumed.add(plural(domain));
  if (type !== undefined && domain in TYPE_SECTIONS) {
    chips.push({ kind: TYPE_SECTIONS[domain], label: titleCaseId(type) });
    consumed.add(plural(type));
  }
  if (domain === "buildings") {
    const [, era, level] = folders.slice(folders[0] === "assets" ? 1 : 0);
    const [, zoneLetter, n] = level?.match(LEVEL_FOLDER) ?? [];
    if (era !== undefined && ERA_FOLDER.test(era)) {
      chips.push({ kind: "town", label: `Era ${era.toUpperCase()}` });
      consumed.add(plural(era));
    }
    if (level !== undefined && zoneLetter !== undefined) {
      const zone = LEVEL_ZONES[zoneLetter];
      chips.push({ kind: "town", label: ZONES[zone], zone });
      chips.push({ kind: "town", label: `Level: ${n}` });
      consumed.add(plural(level));
    }
  }
  return { chips, consumed };
}

/**
 * Every chip of one asset, each label once: the source, the mod, the folders,
 * and the tags taken off the name. `variants` are the ids of all files of the
 * model, and their tags are included, so a card shows both `High-Poly` and
 * `Low-Poly`. The card shows these, and search matches the text of any of them.
 */
export function assetChips(
  a: { id: string; source: string; modId?: string | null },
  variants: readonly string[] = [a.id],
): AssetChip[] {
  const kinded = (kind: ChipKind, chips: AssetChip[]): AssetChip[] =>
    chips.map((c) => ({ ...c, kind }));
  const { chips: sections, consumed } = pathSections(a.id);
  const all = [
    ...kinded("source", [sourceChip(a.source)]),
    ...kinded("mod", a.modId ? [{ label: a.modId }] : []),
    ...sections,
    ...pathChips(a.id).filter((c) => !consumed.has(c.label)).map((
      c,
    ): AssetChip =>
      SIZE_LABEL.test(c.label)
        ? { ...c, kind: "size", label: c.label.replace(TRAILING_INDEX, "") }
        : { ...c, kind: c.zone ? "town" : "folder" }
    ),
    ...kinded(
      "variant",
      variants.flatMap((id) => modelNames(id).tags).map((label) => ({
        label,
      })),
    ),
  ].map((c): AssetChip =>
    c.label in ALIASES ? { ...c, aliases: ALIASES[c.label] } : c
  );
  return all.filter((c, i) => all.findIndex((d) => d.label === c.label) === i);
}

/**
 * The keys of the chips that exactly one model has. They tell nothing apart, so
 * the index drops them. An index of fewer than two models has none.
 */
export function singleUseChips(chipLists: AssetChip[][]): Set<string> {
  const counts = chipCounts(chipLists);
  return new Set(
    chipLists.length < 2
      ? []
      : [...counts].filter(([, n]) => n === 1).map(([key]) => key),
  );
}

/** How many models have each chip, by `chipKey`. */
export function chipCounts(chipLists: AssetChip[][]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const list of chipLists) {
    for (const key of new Set(list.map(chipKey))) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * True when the chips satisfy the filters: within a kind any selected label
 * matches, and across kinds every kind with a selection matches.
 */
export function matchesFilters(
  chips: readonly AssetChip[],
  filters: AssetFilters,
): boolean {
  return CHIP_KINDS.every(({ kind }) => {
    const wanted = (filters[kind] ?? []).map((l) => l.toLowerCase());
    return wanted.length === 0 ||
      chips.some((c) =>
        c.kind === kind && wanted.includes(c.label.toLowerCase())
      );
  });
}

/** The lowercase keywords of a search query, split on whitespace. */
export function searchKeywords(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter((k) => k !== "");
}

/**
 * The lowercase text that search matches for an asset: its id, and the label
 * and aliases of each chip, one per line. An asset matches a query when every
 * keyword is found somewhere in this text.
 */
export function assetSearchText(
  a: { id: string; source: string; modId?: string | null },
  variants: readonly string[] = [a.id],
  chips: readonly AssetChip[] = assetChips(a, variants),
): string {
  const words = chips.flatMap((c) => [c.label, ...(c.aliases ?? [])]);
  return [...variants, ...words].join("\n").toLowerCase();
}
