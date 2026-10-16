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
  return {
    title: qualified(titleCaseId(words.map(plainNumber).join("_")), qualifiers),
    base,
    stem: stemOf(base),
    tags: [...tags, ...suffixes],
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
  const all = [
    sourceChip(a.source),
    ...(a.modId ? [{ label: a.modId }] : []),
    ...pathChips(a.id),
    ...variants.flatMap((id) => modelNames(id).tags).map((label) => ({
      label,
    })),
  ].map((c): AssetChip =>
    c.label in ALIASES ? { ...c, aliases: ALIASES[c.label] } : c
  );
  return all.filter((c, i) => all.findIndex((d) => d.label === c.label) === i);
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
): string {
  const chips = assetChips(a, variants).flatMap((c) => [
    c.label,
    ...(c.aliases ?? []),
  ]);
  return [...variants, ...chips].join("\n").toLowerCase();
}
