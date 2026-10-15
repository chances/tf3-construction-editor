import { assert, assertEquals } from "jsr:@std/assert@^1";
import { join } from "jsr:@std/path@^1";
import { createHandler } from "./api.ts";
import { withTempDir } from "./testing.ts";

const config = (modsRoot: string) => ({
  installRoot: null,
  modsRoot,
  port: 0,
  configFile: join(modsRoot, "cedit.config.json"),
});

async function call(
  handler: (req: Request) => Promise<Response>,
  method: string,
  path: string,
  body?: unknown,
) {
  const res = await handler(
    new Request(`http://localhost${path}`, {
      method,
      headers: body === undefined ? {} : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
  return { status: res.status, body: await res.json() };
}

Deno.test("api: delete a construction through the HTTP handler", async () => {
  await withTempDir(async (modsRoot) => {
    const handler = createHandler(config(modsRoot));
    assertEquals(
      (await call(handler, "POST", "/api/mods", {
        modId: "demo_mod",
        name: "Demo",
      }))
        .status,
      201,
    );
    const created = await call(
      handler,
      "POST",
      "/api/mods/demo_mod/constructions",
      { id: "foo", name: "Foo" },
    );
    assertEquals(created.status, 201);

    const deleted = await call(
      handler,
      "DELETE",
      "/api/mods/demo_mod/constructions/foo",
    );
    assertEquals(deleted.status, 200);
    assertEquals(deleted.body.removed, ["_metadata/constructions/foo.json"]);

    const again = await call(
      handler,
      "DELETE",
      "/api/mods/demo_mod/constructions/foo",
    );
    assertEquals(again.status, 404);
    assert(
      String(again.body.error).includes("foo"),
      `the error names the construction: ${again.body.error}`,
    );
  });
});

Deno.test("api: opening the config creates an empty file once and opens it", async () => {
  await withTempDir(async (modsRoot) => {
    const opened: string[] = [];
    const cfg = config(modsRoot);
    const handler = createHandler(cfg, (path) => {
      opened.push(path);
      return Promise.resolve();
    });

    const first = await call(handler, "POST", "/api/config/open");
    assertEquals(first.status, 200);
    assertEquals(first.body, { path: cfg.configFile, created: true });
    assertEquals(await Deno.readTextFile(cfg.configFile), "{}\n");

    await Deno.writeTextFile(cfg.configFile, '{"port": 9000}\n');
    const second = await call(handler, "POST", "/api/config/open");
    assertEquals(second.body.created, false);
    assertEquals(await Deno.readTextFile(cfg.configFile), '{"port": 9000}\n');
    assertEquals(opened, [cfg.configFile, cfg.configFile]);
  });
});

Deno.test("api: an unknown route says which route was not found", async () => {
  await withTempDir(async (modsRoot) => {
    const handler = createHandler(config(modsRoot));
    const res = await call(handler, "GET", "/api/nope");
    assertEquals(res.status, 404);
    assert(String(res.body.error).includes("GET /api/nope"));
  });
});
