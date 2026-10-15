import { assert, assertEquals, assertThrows } from "jsr:@std/assert@^1";
import { join } from "jsr:@std/path@^1";
import { createHandler } from "./api.ts";
import {
  type ConfigSnapshot,
  ConfigWatcher,
  reloadConfig,
} from "./config-watch.ts";
import { withTempDir } from "./testing.ts";

const noEnv = { get: (_name: string) => undefined };

function configIn(dir: string) {
  return {
    installRoot: null as string | null,
    modsRoot: join(dir, "mods"),
    port: 0,
    configFile: join(dir, "cedit.config.json"),
  };
}

/** Resolves with the first value `next` returns, or fails after a timeout. */
function within<T>(ms: number, run: (done: (value: T) => void) => void) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Nothing happened within ${ms} ms.`)),
      ms,
    );
    run((value) => {
      clearTimeout(timer);
      resolve(value);
    });
  });
}

Deno.test("config watch: reload applies the file in place and reports changes", async () => {
  await withTempDir(async (dir) => {
    const config = configIn(dir);
    await Deno.writeTextFile(
      config.configFile,
      JSON.stringify({ installRoot: "D:\\Game", modsRoot: "D:\\Mods" }),
    );
    const first = reloadConfig(config, noEnv);
    assertEquals(first, { installRootChanged: true, modsRootChanged: true });
    assertEquals(config.installRoot, "D:\\Game");
    assertEquals(config.modsRoot, "D:\\Mods");
    assertEquals(reloadConfig(config, noEnv), {
      installRootChanged: false,
      modsRootChanged: false,
    });
  });
});

Deno.test("config watch: an environment value still wins over the file", async () => {
  await withTempDir(async (dir) => {
    const config = configIn(dir);
    await Deno.writeTextFile(
      config.configFile,
      JSON.stringify({ installRoot: "D:\\FromFile" }),
    );
    const env = {
      get: (name: string) =>
        name === "CEDIT_INSTALL_ROOT" ? "D:\\FromEnv" : undefined,
    };
    reloadConfig(config, env);
    assertEquals(config.installRoot, "D:\\FromEnv");
  });
});

Deno.test("config watch: a file that is not valid JSON keeps the old values", async () => {
  await withTempDir(async (dir) => {
    const config = configIn(dir);
    config.installRoot = "D:\\Game";
    await Deno.writeTextFile(config.configFile, "{nope");
    assertThrows(() => reloadConfig(config, noEnv));
    assertEquals(config.installRoot, "D:\\Game");
  });
});

Deno.test("config watch: a subscriber hears about an edited folder once", async () => {
  await withTempDir(async (dir) => {
    const config = configIn(dir);
    let installChanges = 0;
    const watcher = new ConfigWatcher(config, () => installChanges++, noEnv);
    const heard: ConfigSnapshot[] = [];
    let unsubscribe = () => {};
    try {
      const snapshot = await within<ConfigSnapshot>(5000, (done) => {
        unsubscribe = watcher.subscribe((s) => {
          heard.push(s);
          done(s);
        });
        void Deno.writeTextFile(
          config.configFile,
          JSON.stringify({ installRoot: "D:\\Game" }),
        );
      });
      assertEquals(snapshot.installRoot, "D:\\Game");
      assertEquals(config.installRoot, "D:\\Game");
      assertEquals(installChanges, 1);
    } finally {
      unsubscribe();
    }
    assert(heard.length >= 1);
  });
});

Deno.test({
  name: "api: the event stream sends the folders and then each change",
  ignore: Deno.env.get("CEDIT_INSTALL_ROOT") !== undefined,
  fn: async () => {
    await withTempDir(async (dir) => {
      const config = configIn(dir);
      const handler = createHandler(config);
      const res = await handler(
        new Request("http://localhost/api/events", { method: "GET" }),
      );
      assertEquals(res.headers.get("content-type"), "text/event-stream");
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let seen = "";
      const readUntil = (text: string) =>
        within<string>(5000, (done) => {
          void (async () => {
            while (!seen.includes(text)) {
              const chunk = await reader.read();
              if (chunk.done) return;
              seen += decoder.decode(chunk.value);
            }
            done(seen);
          })();
        });
      try {
        await readUntil('"installRoot":null');
        assert(seen.startsWith("event: config\n"));
        await Deno.writeTextFile(
          config.configFile,
          JSON.stringify({ installRoot: "D:\\Game" }),
        );
        await readUntil('"installRoot":"D:\\\\Game"');
        assertEquals(config.installRoot, "D:\\Game");
      } finally {
        await reader.cancel();
      }
    });
  },
});
