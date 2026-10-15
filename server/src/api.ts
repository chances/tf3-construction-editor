import {
  type ConstructionDoc,
  lintConstruction,
  parseConstruction,
  SchemaError,
} from "@cedit/schema";
import { type AssetEntry, indexBaseGame } from "./assets.ts";
import type { ServerConfig } from "./config.ts";
import { LuaParseError } from "./luatab.ts";
import { MdlError } from "./mdl.ts";
import { MshError } from "./msh.ts";
import { openInDefaultApp } from "./open.ts";
import {
  buildAssetIndex,
  createConstruction,
  createMod,
  deleteConstruction,
  exportConstruction,
  listMods,
  loadMod,
  readConstruction,
  saveMod,
  UserError,
  writeConstruction,
} from "./mods.ts";
import type { Point2 } from "./silhouette.ts";
import { ZipError } from "./zip.ts";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function errorResponse(error: unknown): Response {
  if (error instanceof UserError || error instanceof SchemaError) {
    return json({ error: error.message }, 400);
  }
  if (error instanceof Deno.errors.NotFound) {
    return json({ error: error.message }, 404);
  }
  if (
    error instanceof MdlError || error instanceof MshError ||
    error instanceof LuaParseError ||
    error instanceof ZipError
  ) {
    return json({ error: error.message }, 422);
  }
  console.error(error);
  return json({ error: (error as Error).message ?? "Server error." }, 500);
}

const ROUTES: { method: string; pattern: URLPattern; name: string }[] = [
  ["GET", "/api/config", "config"],
  ["POST", "/api/config/open", "openConfig"],
  ["GET", "/api/mods", "listMods"],
  ["POST", "/api/mods", "createMod"],
  ["GET", "/api/mods/:dir", "loadMod"],
  ["PUT", "/api/mods/:dir", "saveMod"],
  ["POST", "/api/mods/:dir/constructions", "createConstruction"],
  ["GET", "/api/mods/:dir/constructions/:id", "readConstruction"],
  ["PUT", "/api/mods/:dir/constructions/:id", "writeConstruction"],
  ["DELETE", "/api/mods/:dir/constructions/:id", "deleteConstruction"],
  ["POST", "/api/mods/:dir/constructions/:id/export", "export"],
  ["POST", "/api/mods/:dir/lint", "lint"],
  ["GET", "/api/mods/:dir/assets", "assets"],
  ["GET", "/api/mods/:dir/model", "model"],
].map(([method, path, name]) => ({
  method,
  pattern: new URLPattern({ pathname: path }),
  name,
}));

/** Creates the config file with `{}` when it is missing. */
async function ensureConfigFile(path: string): Promise<boolean> {
  try {
    await Deno.writeTextFile(path, "{}\n", { createNew: true });
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.AlreadyExists) return false;
    throw error;
  }
}

export function createHandler(
  config: ServerConfig,
  open: (path: string) => Promise<void> = openInDefaultApp,
) {
  let baseEntries: Promise<AssetEntry[]> | undefined;
  const base = () =>
    baseEntries ??= config.installRoot === null
      ? Promise.resolve([])
      : indexBaseGame(config.installRoot);
  const outlines = new Map<string, Promise<Point2[][] | { error: string }>>();

  async function indexFor(dir: string) {
    const loaded = await loadMod(config.modsRoot, dir);
    return {
      loaded,
      index: await buildAssetIndex(
        await base(),
        config.modsRoot,
        dir,
        loaded.mod,
      ),
    };
  }

  async function dispatch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    for (const route of ROUTES) {
      if (route.method !== req.method) continue;
      const match = route.pattern.exec(url);
      if (!match) continue;
      const p = match.pathname.groups as Record<string, string>;
      switch (route.name) {
        case "config":
          return json({
            installRoot: config.installRoot,
            modsRoot: config.modsRoot,
          });
        case "openConfig": {
          const created = await ensureConfigFile(config.configFile);
          await open(config.configFile);
          return json({ path: config.configFile, created });
        }
        case "listMods":
          return json(await listMods(config.modsRoot));
        case "createMod": {
          const body = await req.json();
          return json(
            await createMod(
              config.modsRoot,
              String(body.modId),
              String(body.name ?? ""),
            ),
            201,
          );
        }
        case "loadMod":
          return json(await loadMod(config.modsRoot, p.dir));
        case "saveMod": {
          const body = await req.json();
          await saveMod(config.modsRoot, p.dir, body.mod, body.modInfo);
          return json(await loadMod(config.modsRoot, p.dir));
        }
        case "createConstruction": {
          const body = await req.json();
          return json(
            await createConstruction(
              config.modsRoot,
              p.dir,
              String(body.id),
              typeof body.name === "string" ? body.name : undefined,
            ),
            201,
          );
        }
        case "readConstruction":
          return json(await readConstruction(config.modsRoot, p.dir, p.id));
        case "writeConstruction": {
          const doc = parseConstruction(await req.json());
          if (doc.id !== p.id) {
            throw new UserError("The body id does not match the URL.");
          }
          await writeConstruction(config.modsRoot, p.dir, doc);
          return json(doc);
        }
        case "deleteConstruction":
          return json(await deleteConstruction(config.modsRoot, p.dir, p.id));
        case "export": {
          const { index } = await indexFor(p.dir);
          return json(
            await exportConstruction(config.modsRoot, p.dir, p.id, index),
          );
        }
        case "lint": {
          const doc: ConstructionDoc = parseConstruction(await req.json());
          const { index } = await indexFor(p.dir);
          return json(
            lintConstruction(doc, { resolveModel: (id) => index.has(id) }),
          );
        }
        case "assets": {
          const { index } = await indexFor(p.dir);
          const q = url.searchParams.get("q") ?? "";
          const limit = Math.min(
            Number(url.searchParams.get("limit") ?? 100),
            500,
          );
          return json({
            total: index.size,
            entries: index.search(q, limit).map((e) => ({
              id: e.id,
              source: e.source,
              modId: e.modId,
            })),
          });
        }
        case "model": {
          const id = url.searchParams.get("id");
          if (!id) throw new UserError("The id query parameter is required.");
          const { index } = await indexFor(p.dir);
          const summary = await index.readModel(id);
          const key = await index.cacheKey(id);
          let outline = outlines.get(key);
          if (!outline) {
            outline = index.readOutline(id).catch((error: Error) => ({
              error: error.message,
            }));
            outlines.set(key, outline);
          }
          const result = await outline;
          return json(
            Array.isArray(result)
              ? { ...summary, outline: result }
              : { ...summary, outlineError: result.error },
          );
        }
      }
    }
    return json(
      {
        error: `The server has no route for ${req.method} ${url.pathname}. ` +
          "The app may be newer than the running server, so restart the " +
          "server with `deno task dev`.",
      },
      404,
    );
  }

  return async (req: Request): Promise<Response> => {
    try {
      return await dispatch(req);
    } catch (error) {
      return errorResponse(error);
    }
  };
}
