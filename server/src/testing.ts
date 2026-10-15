import { join } from "jsr:@std/path@^1";
import { zipSync } from "npm:fflate@0.8.2";
import { loadConfig } from "./config.ts";

/** Shared helpers for the sibling `*.test.ts` files. Not a test itself. */
export const fixtures = new URL("../testdata/placeholders/", import.meta.url);

export function fixtureText(name: string): string {
  return Deno.readTextFileSync(new URL(name, fixtures));
}

export function fixtureBytes(name: string): Uint8Array {
  return Deno.readFileSync(new URL(name, fixtures));
}

export async function withTempDir(fn: (dir: string) => Promise<void>) {
  const dir = await Deno.makeTempDir({ prefix: "cedit_" });
  try {
    await fn(dir);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
}

export async function writeZip(
  path: string,
  files: Record<string, string>,
  level: 0 | 6,
) {
  const data: Record<string, Uint8Array> = {};
  const encoder = new TextEncoder();
  for (const [name, content] of Object.entries(files)) {
    data[name] = encoder.encode(content);
  }
  await Deno.mkdir(join(path, ".."), { recursive: true });
  await Deno.writeFile(path, zipSync(data, { level }));
}

/**
 * The install folder from the same configuration the server uses
 * (`CEDIT_INSTALL_ROOT` or `cedit.config.json`). Null when not configured.
 */
export const installRoot: string | null = loadConfig().installRoot;

/** True when `installRoot` is configured and holds the base game content. */
export const installPresent = (() => {
  if (installRoot === null) return false;
  try {
    Deno.statSync(join(installRoot, "base", "content", "placeholders.zip"));
    return true;
  } catch {
    return false;
  }
})();
