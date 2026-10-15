import { assertEquals } from "jsr:@std/assert@^1";
import {
  emptyPersisted,
  loadPersisted,
  parsePersisted,
  savePersisted,
  STORAGE_KEY,
  type StorageLike,
} from "./persist.ts";

function memoryStorage(initial: Record<string, string> = {}): StorageLike & {
  data: Map<string, string>;
} {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

Deno.test("persist: a saved state loads back unchanged", () => {
  const storage = memoryStorage();
  const state = emptyPersisted();
  state.view = "editor";
  state.modDir = "my_mod";
  state.constructionId = "hall";
  state.selection = { sub: 1, model: 2 };
  state.activeSub = 1;
  state.inspectTarget = "model";
  state.assetQuery = "cube";
  state.snap = { grid: 0.5, vertex: false, edge: true, angle: null };
  state.zBand = { min: -1, max: 4 };
  state.canvas = { cx: 12, cy: -3, scale: 25 };
  state.draft.modId = "new_mod";
  state.draft.creatingMod = true;
  assertEquals(savePersisted(storage, state), true);
  assertEquals(loadPersisted(storage), state);
});

Deno.test("persist: pending edits survive a round trip", () => {
  const storage = memoryStorage();
  const state = emptyPersisted();
  state.pending.mod = { modId: "m", revision: 3 };
  savePersisted(storage, state);
  assertEquals(loadPersisted(storage)?.pending.mod, {
    modId: "m",
    revision: 3,
  });
});

Deno.test("persist: missing storage entry gives null", () => {
  assertEquals(loadPersisted(memoryStorage()), null);
});

Deno.test("persist: unreadable or other-version data gives null", () => {
  assertEquals(parsePersisted("{not json"), null);
  assertEquals(parsePersisted(JSON.stringify({ version: 99 })), null);
  assertEquals(parsePersisted(JSON.stringify([1, 2])), null);
});

Deno.test("persist: wrong field types fall back to defaults", () => {
  const raw = JSON.stringify({
    version: 1,
    view: "nowhere",
    modDir: 7,
    selection: { sub: "a" },
    activeSub: -5,
    snap: { grid: "big", vertex: "yes" },
    canvas: { scale: 9999, cx: "left" },
    draft: { modId: 4, creatingMod: "true" },
  });
  const parsed = parsePersisted(raw)!;
  const base = emptyPersisted();
  assertEquals(parsed.view, "mods");
  assertEquals(parsed.modDir, null);
  assertEquals(parsed.selection, null);
  assertEquals(parsed.activeSub, 0);
  assertEquals(parsed.snap, base.snap);
  assertEquals(parsed.canvas, { cx: 0, cy: 0, scale: 200 });
  assertEquals(parsed.draft, base.draft);
});

Deno.test("persist: a storage that throws never breaks load or save", () => {
  const broken: StorageLike = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("full");
    },
  };
  assertEquals(loadPersisted(broken), null);
  assertEquals(savePersisted(broken, emptyPersisted()), false);
});

Deno.test("persist: null grid and angle mean off, not default", () => {
  const storage = memoryStorage({
    [STORAGE_KEY]: JSON.stringify({
      version: 1,
      snap: { grid: null, vertex: true, edge: true, angle: null },
    }),
  });
  const parsed = loadPersisted(storage)!;
  assertEquals(parsed.snap.grid, null);
  assertEquals(parsed.snap.angle, null);
});
