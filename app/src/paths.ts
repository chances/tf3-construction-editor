/**
 * The last segment of a `/` separated resource path, with trailing slashes
 * ignored. This is `basename` from `@std/path/posix`. The app is bundled by
 * Vite, which does not resolve `jsr:` specifiers, so the three lines live here.
 */
export function basename(path: string): string {
  const trimmed = path.replace(/\/+$/, "");
  return trimmed.slice(trimmed.lastIndexOf("/") + 1);
}
