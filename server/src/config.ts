import { fromFileUrl, join } from "jsr:@std/path@^1";

export interface ServerConfig {
  /**
   * Transport Fever 3 install folder, or null when not configured. The server
   * only reads it. Without it the base game models are not indexed.
   */
  installRoot: string | null;
  /** Folder that holds one subfolder per mod. */
  modsRoot: string;
  port: number;
  /** Absolute path of `cedit.config.json`, whether or not the file exists. */
  configFile: string;
}

export function defaultConfigFile(): string {
  return fromFileUrl(new URL("../../cedit.config.json", import.meta.url));
}

export function defaultModsRoot(home: string): string {
  return join(home, "Documents", "Transport Fever 3", "mods");
}

type EnvLike = { get(name: string): string | undefined };

/**
 * Values come from, in order: environment variables `CEDIT_INSTALL_ROOT`,
 * `CEDIT_MODS_ROOT`, `CEDIT_PORT`; the file `cedit.config.json` at the repo
 * root; the defaults. `installRoot` has no default. `modsRoot` defaults to the
 * Documents mods folder of the current user.
 */
export function loadConfig(
  env: EnvLike = Deno.env,
  configFile = defaultConfigFile(),
): ServerConfig {
  let file: Partial<ServerConfig> = {};
  try {
    file = JSON.parse(Deno.readTextFileSync(configFile));
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
  const home = env.get("USERPROFILE") ?? env.get("HOME") ?? ".";
  return {
    installRoot: env.get("CEDIT_INSTALL_ROOT") ?? file.installRoot ?? null,
    modsRoot: env.get("CEDIT_MODS_ROOT") ?? file.modsRoot ??
      defaultModsRoot(home),
    port: Number(env.get("CEDIT_PORT") ?? file.port ?? 8787),
    configFile,
  };
}
