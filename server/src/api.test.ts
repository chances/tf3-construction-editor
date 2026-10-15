import { assert, assertEquals } from "jsr:@std/assert@^1";
import { join } from "jsr:@std/path@^1";
import { createHandler } from "./api.ts";
import { encodePng } from "./image/png.ts";
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

async function modWithImages(modsRoot: string) {
  const handler = createHandler(config(modsRoot));
  await call(handler, "POST", "/api/mods", { modId: "demo_mod", name: "Demo" });
  const ui = join(modsRoot, "demo_mod", "content", "ui");
  await Deno.mkdir(ui, { recursive: true });
  const png = await encodePng({
    width: 32,
    height: 32,
    data: new Uint8Array(32 * 32 * 4).fill(200),
  });
  await Deno.writeFile(join(ui, "arrow.png"), png);
  // A color-mapped TGA, which the decoders do not handle.
  const tga = new Uint8Array(19);
  tga[1] = 1;
  tga[2] = 1;
  tga[12] = 1;
  tga[14] = 1;
  tga[16] = 8;
  await Deno.writeFile(join(ui, "mapped.tga"), tga);
  return handler;
}

Deno.test("api: the images route searches by file name", async () => {
  await withTempDir(async (modsRoot) => {
    const handler = await modWithImages(modsRoot);
    const res = await call(handler, "GET", "/api/mods/demo_mod/images?q=arr");
    assertEquals(res.status, 200);
    assertEquals(res.body.total, 2);
    assertEquals(res.body.entries.map((e: { id: string }) => e.id), [
      "/ui/arrow.png",
    ]);
    assertEquals(res.body.entries[0].format, "png");
  });
});

Deno.test("api: the images route says whether the query is an exact image id", async () => {
  await withTempDir(async (modsRoot) => {
    const handler = await modWithImages(modsRoot);
    const known = await call(
      handler,
      "GET",
      "/api/mods/demo_mod/images?q=%2Fui%2Farrow.png",
    );
    assertEquals(known.body.exact, true);
    const partial = await call(
      handler,
      "GET",
      "/api/mods/demo_mod/images?q=%2Fui%2Farr",
    );
    assertEquals(partial.body.exact, false);
    const folder = await call(
      handler,
      "GET",
      "/api/mods/demo_mod/images?q=%2Fui%2F",
    );
    assertEquals(folder.body.exact, false);
  });
});

Deno.test("api: lint warns about an icon that is not an indexed image", async () => {
  await withTempDir(async (modsRoot) => {
    const handler = await modWithImages(modsRoot);
    const doc = (await call(
      handler,
      "POST",
      "/api/mods/demo_mod/constructions",
      { id: "hall", name: "Hall" },
    )).body;
    doc.description.icon = "/ui/arrow.png";
    doc.description.previewIcon = "/ui/nope.png";
    const res = await call(handler, "POST", "/api/mods/demo_mod/lint", doc);
    assertEquals(res.status, 200);
    const icons = res.body.filter(
      (i: { rule: string }) => i.rule === "image-resolves",
    );
    assertEquals(icons.length, 1);
    assertEquals(icons[0].path, "description.previewIcon");
    assertEquals(icons[0].severity, "warning");
    assert(icons[0].message.includes("/ui/nope.png"));
  });
});

Deno.test("api: the image route serves a PNG thumbnail with an etag", async () => {
  await withTempDir(async (modsRoot) => {
    const handler = await modWithImages(modsRoot);
    const path = "/api/mods/demo_mod/image?id=%2Fui%2Farrow.png&size=4";
    const first = await handler(new Request(`http://localhost${path}`));
    assertEquals(first.status, 200);
    assertEquals(first.headers.get("content-type"), "image/png");
    const png = new Uint8Array(await first.arrayBuffer());
    assertEquals([...png.subarray(0, 4)], [137, 80, 78, 71]);
    // The size is clamped to 16, so the 32 pixel source comes back at 16.
    assertEquals(new DataView(png.buffer).getUint32(16), 16);

    const again = await handler(
      new Request(`http://localhost${path}`, {
        headers: { "if-none-match": first.headers.get("etag")! },
      }),
    );
    assertEquals(again.status, 304);
  });
});

Deno.test("api: an unknown image id names the image and the mod", async () => {
  await withTempDir(async (modsRoot) => {
    const handler = await modWithImages(modsRoot);
    const res = await call(
      handler,
      "GET",
      "/api/mods/demo_mod/image?id=%2Fui%2Fnope.png",
    );
    assertEquals(res.status, 404);
    assert(String(res.body.error).includes("/ui/nope.png"));
    assert(String(res.body.error).includes("demo_mod"));
  });
});

Deno.test("api: an undecodable image is a 415 that names the image", async () => {
  await withTempDir(async (modsRoot) => {
    const handler = await modWithImages(modsRoot);
    const res = await call(
      handler,
      "GET",
      "/api/mods/demo_mod/image?id=%2Fui%2Fmapped.tga",
    );
    assertEquals(res.status, 415);
    assert(String(res.body.error).includes("/ui/mapped.tga"));
    assert(String(res.body.error).includes("cannot be previewed"));
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
