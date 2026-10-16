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
