/**
 * The last segment of a `/` separated resource path, with trailing slashes
 * ignored. This is `basename` from `@std/path/posix`. The app is bundled by
 * Vite, which does not resolve `jsr:` specifiers, so the three lines live here.
 */
export function basename(path: string): string {
  const trimmed = path.replace(/\/+$/, "");
  return trimmed.slice(trimmed.lastIndexOf("/") + 1);
}

/**
 * A folder path shortened from the middle, the way macOS truncates a long
 * path: the first and last segments stay and `…` replaces the ones between.
 * A path of one or two segments stays whole.
 */
export function shortenFolder(path: string): string {
  const parts = path.split("/").filter((part) => part !== "");
  if (parts.length <= 2) return path;
  return `${parts[0]}/…/${parts[parts.length - 1]}`;
}

/**
 * The last segment without its extension. This is `basename(path,
 * extname(path))` from `@std/path/posix`.
 */
export function stem(path: string): string {
  const name = basename(path);
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}
