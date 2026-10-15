import { assertEquals } from "jsr:@std/assert@^1";
import { join } from "jsr:@std/path@^1";
import { loadConfig } from "./config.ts";
import { withTempDir } from "./testing.ts";

const none = { get: (_name: string) => undefined };

Deno.test("config: installRoot has no default", () => {
  const config = loadConfig(none, "missing-file.json");
  assertEquals(config.installRoot, null);
});

Deno.test("config: environment overrides the defaults", () => {
  const env = new Map([
    ["CEDIT_INSTALL_ROOT", "/games/tf3"],
    ["CEDIT_MODS_ROOT", "/mods"],
    ["CEDIT_PORT", "9000"],
  ]);
  const config = loadConfig({ get: (k) => env.get(k) }, "missing-file.json");
  assertEquals(config.installRoot, "/games/tf3");
  assertEquals(config.modsRoot, "/mods");
  assertEquals(config.port, 9000);
});

Deno.test("config: values come from the config file", async () => {
  await withTempDir(async (dir) => {
    const file = join(dir, "cedit.config.json");
    await Deno.writeTextFile(
      file,
      JSON.stringify({ installRoot: "/from/file", port: 9100 }),
    );
    const config = loadConfig(none, file);
    assertEquals(config.installRoot, "/from/file");
    assertEquals(config.port, 9100);
  });
});

Deno.test("config: the environment wins over the config file", async () => {
  await withTempDir(async (dir) => {
    const file = join(dir, "cedit.config.json");
    await Deno.writeTextFile(
      file,
      JSON.stringify({ installRoot: "/from/file" }),
    );
    const env = new Map([["CEDIT_INSTALL_ROOT", "/from/env"]]);
    const config = loadConfig({ get: (k) => env.get(k) }, file);
    assertEquals(config.installRoot, "/from/env");
  });
});
