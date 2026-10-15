import {
  type ConstructionDoc,
  lintConstruction,
  parseConstruction,
  SchemaError,
} from "@cedit/schema";
import { type AssetEntry, indexBaseGame } from "./assets.ts";
import type { ServerConfig } from "./config.ts";
import {
  type ConfigSnapshot,
  ConfigWatcher,
  snapshotOf,
} from "./config-watch.ts";
import { LuaParseError } from "./luatab.ts";
import {
  type FolderPicker,
  isFolderSetting,
  mergeConfig,
  pickFolder,
  validateFolder,
} from "./folder-dialog.ts";
import { ImageFormatError, UnsupportedImageError } from "./image/types.ts";
import { clampThumbnailSize, makeThumbnail } from "./image/thumbnail.ts";
import { buildImageIndex, type ImageEntry, indexBaseImages } from "./images.ts";
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
  if (error instanceof UnsupportedImageError) {
    return json({ error: error.message }, 415);
  }
  if (
    error instanceof MdlError || error instanceof MshError ||
    error instanceof ImageFormatError ||
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
  ["POST", "/api/config/choose", "chooseFolder"],
  ["GET", "/api/events", "events"],
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
  ["GET", "/api/mods/:dir/images", "images"],
  ["GET", "/api/mods/:dir/image", "image"],
].map(([method, path, name]) => ({
  method,
  pattern: new URLPattern({ pathname: path }),
  name,
}));

/** A short stable hash for `ETag` values. */
function hashText(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
}

const KEEPALIVE_MS = 25_000;

/**
 * A server-sent event stream. It sends the current folders when it opens, then
 * a `config` event each time the config file changes a folder.
 */
function eventStream(
  req: Request,
  config: ServerConfig,
  watcher: ConfigWatcher,
): Response {
  const encoder = new TextEncoder();
  let stop = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, data: ConfigSnapshot) =>
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      send("config", snapshotOf(config));
      const unsubscribe = watcher.subscribe((snapshot) =>
        send("config", snapshot)
      );
      const timer = setInterval(
        () => controller.enqueue(encoder.encode(": keepalive\n\n")),
        KEEPALIVE_MS,
      );
      stop = () => {
        clearInterval(timer);
        unsubscribe();
      };
      req.signal.addEventListener("abort", stop);
    },
    cancel() {
      stop();
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
    },
  });
}

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
  pick: FolderPicker = pickFolder,
) {
  let baseEntries: Promise<AssetEntry[]> | undefined;
  const base = () =>
    baseEntries ??= config.installRoot === null
      ? Promise.resolve([])
      : indexBaseGame(config.installRoot);
  const outlines = new Map<string, Promise<Point2[][] | { error: string }>>();

  let baseImages: Promise<ImageEntry[]> | undefined;
  const images = () =>
    baseImages ??= config.installRoot === null
      ? Promise.resolve([])
      : indexBaseImages(config.installRoot);
  /** Encoded thumbnails by archive, entry, and size. Oldest leaves first. */
  const thumbnails = new Map<string, Uint8Array>();
  const THUMBNAIL_CACHE = 512;

  /** Applies edits to `cedit.config.json` while the server runs. */
  const watcher = new ConfigWatcher(config, () => {
    baseEntries = undefined;
    baseImages = undefined;
  });

  async function imageIndexFor(dir: string) {
    const loaded = await loadMod(config.modsRoot, dir);
    return await buildImageIndex(
      await images(),
      config.modsRoot,
      dir,
      loaded.mod,
    );
  }

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
        case "chooseFolder": {
          // The picked folder is validated before `cedit.config.json` is
          // written, so a rejected folder never reaches the file. A new
          // install folder drops the cached base indexes so models and
          // images re-index on the next request.
          const body = await req.json().catch(() => ({}));
          const setting = body?.setting;
          if (!isFolderSetting(setting)) {
            throw new UserError(
              'The setting must be "installRoot" or "modsRoot".',
            );
          }
          const picked = await pick({
            title: setting === "installRoot"
              ? "Choose the Transport Fever 3 Folder"
              : "Choose the Mods Folder",
            start: config[setting] ?? undefined,
          });
          if (picked === null) return json({ cancelled: true });
          await validateFolder(setting, picked);
          let text = "";
          try {
            text = await Deno.readTextFile(config.configFile);
          } catch (error) {
            if (!(error instanceof Deno.errors.NotFound)) throw error;
          }
          await Deno.writeTextFile(
            config.configFile,
            mergeConfig(text, setting, picked),
          );
          config[setting] = picked;
          if (setting === "installRoot") {
            baseEntries = undefined;
            baseImages = undefined;
          }
          return json({
            installRoot: config.installRoot,
            modsRoot: config.modsRoot,
          });
        }
        case "events":
          return eventStream(req, config, watcher);
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
          const images = await imageIndexFor(p.dir);
          return json(
            lintConstruction(doc, {
              resolveModel: (id) => index.has(id),
              // With no images indexed the game is not set up, so the index
              // cannot say whether an icon exists.
              resolveImage: (id) =>
                images.size === 0 ? null : images.get(id) !== undefined,
            }),
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
        case "images": {
          const index = await imageIndexFor(p.dir);
          const limit = Math.min(
            Number(url.searchParams.get("limit") ?? 50),
            100,
          );
          return json({
            total: index.size,
            /** True when the query is exactly the id of an indexed image. */
            exact: index.get((url.searchParams.get("q") ?? "").trim()) !==
              undefined,
            folders: index.folders(url.searchParams.get("q") ?? ""),
            entries: index.search(url.searchParams.get("q") ?? "", limit).map(
              (e) => ({
                id: e.id,
                source: e.source,
                modId: e.modId,
                format: e.format,
              }),
            ),
          });
        }
        case "image": {
          const id = url.searchParams.get("id");
          if (!id) throw new UserError("The id query parameter is required.");
          const size = clampThumbnailSize(
            Number(url.searchParams.get("size") ?? 64),
          );
          const index = await imageIndexFor(p.dir);
          const entry = index.get(id);
          if (!entry) {
            throw new Deno.errors.NotFound(
              `The image ${id} is not in the base game, the mod ${p.dir}, or its dependencies.`,
            );
          }
          const key = `${entry.zip ?? ""}|${entry.entry}|${size}`;
          const tag = `"${hashText(key)}"`;
          if (req.headers.get("if-none-match") === tag) {
            return new Response(null, { status: 304 });
          }
          let png = thumbnails.get(key);
          if (png) {
            thumbnails.delete(key);
          } else {
            try {
              png = await makeThumbnail(
                await index.readBytes(entry),
                entry.entry,
                size,
              );
            } catch (error) {
              if (error instanceof UnsupportedImageError) {
                throw new UnsupportedImageError(
                  `The image ${id} cannot be previewed. ${error.message}`,
                );
              }
              throw error;
            }
          }
          thumbnails.set(key, png);
          if (thumbnails.size > THUMBNAIL_CACHE) {
            thumbnails.delete(thumbnails.keys().next().value!);
          }
          return new Response(png as BodyInit, {
            headers: {
              "content-type": "image/png",
              "cache-control": "max-age=3600",
              etag: tag,
            },
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
