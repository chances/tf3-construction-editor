const RESOURCE_NAME = /^[a-z0-9_-]+$/;
const MOD_ID = /^[a-z0-9_]+$/;

/** Wiki rule: resource names use lowercase `a-z`, `0-9`, `_`, and `-`. */
export function isValidResourceName(name: string): boolean {
  return RESOURCE_NAME.test(name);
}

/** Wiki rule: a modId uses only `a-z`, `0-9`, and `_`. */
export function isValidModId(modId: string): boolean {
  return MOD_ID.test(modId);
}

/** `my_cool_mod` becomes `My Cool Mod`. Splits on `_` and `-`. */
export function titleCaseId(id: string): string {
  return id.split(/[_-]+/).filter((word) => word !== "").map((word) =>
    word[0].toUpperCase() + word.slice(1)
  ).join(" ");
}

/**
 * Title cases typed text for a display name: underscores become spaces, runs of
 * spaces collapse, and each word starts with a capital after any leading
 * punctuation. The rest of a word is left as typed, so `side platform (v2)`
 * becomes `Side Platform (V2)` and `MyHall` stays `MyHall`.
 */
export function titleCaseWords(text: string): string {
  return text.replace(/_+/g, " ").trim().split(/\s+/).filter((w) => w !== "")
    .map((word) =>
      word.replace(
        /^([^\p{L}\p{N}]*)(\p{L})/u,
        (_, lead, letter) => lead + letter.toUpperCase(),
      )
    )
    .join(" ");
}

/**
 * Proposes a new construction from typed text: a Title Case display name and a
 * file name. Returns null when the text is empty, cannot make a file name, or
 * already names an existing construction (by file name or by display name).
 */
export function proposeConstruction(
  typed: string,
  existing: readonly { id: string; name: string }[],
): { id: string; name: string } | null {
  const text = typed.trim();
  const id = toResourceId(text);
  if (id === "") return null;
  const taken = existing.some((c) =>
    c.id === id || c.name.trim().toLowerCase() === text.toLowerCase()
  );
  return taken ? null : { id, name: titleCaseWords(text) };
}

/** `Grand Hall (v2)` becomes `grand_hall_v2`. Returns "" when nothing is left. */
export function toResourceId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

/** A folder path under `content/`: one or more resource names joined by `/`. */
export function isValidContentFolder(folder: string): boolean {
  if (folder === "") return false;
  return folder.split("/").every(isValidResourceName);
}
