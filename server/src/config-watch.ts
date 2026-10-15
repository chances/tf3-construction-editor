import { basename, dirname } from "jsr:@std/path@^1";
import { loadConfig, type ServerConfig } from "./config.ts";

/** The part of the configuration the app shows and reacts to. */
export interface ConfigSnapshot {
  installRoot: string | null;
  modsRoot: string;
}

export function snapshotOf(config: ServerConfig): ConfigSnapshot {
  return { installRoot: config.installRoot, modsRoot: config.modsRoot };
}

type EnvLike = { get(name: string): string | undefined };

/**
 * Re-reads `cedit.config.json` and the environment into `config`, in place.
 * Environment variables still win over the file. Throws when the file is not
 * valid JSON, and leaves `config` as it was.
 */
export function reloadConfig(
  config: ServerConfig,
  env: EnvLike = Deno.env,
): { installRootChanged: boolean; modsRootChanged: boolean } {
  const next = loadConfig(env, config.configFile);
  const result = {
    installRootChanged: next.installRoot !== config.installRoot,
    modsRootChanged: next.modsRoot !== config.modsRoot,
  };
  config.installRoot = next.installRoot;
  config.modsRoot = next.modsRoot;
  return result;
}

const DEBOUNCE_MS = 100;

/**
 * Watches the config file while at least one subscriber listens. A change to
 * a folder updates `config` in place and notifies every subscriber with the
 * new snapshot. A change that leaves both folders as they were is silent, so
 * the server's own writes do not echo back.
 */
export class ConfigWatcher {
  #subscribers = new Set<(snapshot: ConfigSnapshot) => void>();
  #watcher: Deno.FsWatcher | undefined;
  #timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly config: ServerConfig,
    /** Called before subscribers hear about a changed install folder. */
    private readonly onInstallRootChange: () => void = () => {},
    private readonly env: EnvLike = Deno.env,
  ) {}

  /** Returns the function that unsubscribes. */
  subscribe(listener: (snapshot: ConfigSnapshot) => void): () => void {
    this.#subscribers.add(listener);
    if (this.#subscribers.size === 1) this.#start();
    return () => {
      this.#subscribers.delete(listener);
      if (this.#subscribers.size === 0) this.#stop();
    };
  }

  #start() {
    const file = this.config.configFile;
    const name = basename(file);
    let watcher: Deno.FsWatcher;
    try {
      // The file may not exist yet, so watch its folder and filter by name.
      watcher = Deno.watchFs(dirname(file), { recursive: false });
    } catch (error) {
      console.warn(
        `Could not watch ${file} for changes: ${(error as Error).message}`,
      );
      return;
    }
    this.#watcher = watcher;
    void (async () => {
      try {
        for await (const event of watcher) {
          if (!event.paths.some((p) => basename(p) === name)) continue;
          clearTimeout(this.#timer);
          this.#timer = setTimeout(() => this.#reload(), DEBOUNCE_MS);
        }
      } catch (error) {
        if (
          !(error instanceof Deno.errors.BadResource) &&
          !(error instanceof Deno.errors.Interrupted)
        ) {
          console.warn(
            `The config watcher stopped: ${(error as Error).message}`,
          );
        }
      }
    })();
  }

  #stop() {
    clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#watcher?.close();
    this.#watcher = undefined;
  }

  #reload() {
    try {
      const changed = reloadConfig(this.config, this.env);
      if (!changed.installRootChanged && !changed.modsRootChanged) return;
      if (changed.installRootChanged) this.onInstallRootChange();
      const snapshot = snapshotOf(this.config);
      for (const listener of this.#subscribers) listener(snapshot);
    } catch (error) {
      // A half-written file is retried by the next change event.
      console.warn(
        `Kept the previous configuration. ${
          (error as Error).message
        } Fix cedit.config.json to apply it.`,
      );
    }
  }
}
