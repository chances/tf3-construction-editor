/**
 * Runs `silhouette` over every installed base game model and writes one row of
 * jaggedness statistics per model as JSON.
 *
 * Usage, from the repo root: `deno run -A scripts/survey-silhouettes.ts <out.json>`
 * The install folder comes from `CEDIT_INSTALL_ROOT` or `cedit.config.json`.
 */
import { AssetIndex, indexBaseGame } from "../server/src/assets.ts";
import { loadConfig } from "../server/src/config.ts";
import { silhouette } from "../server/src/silhouette.ts";

const root = loadConfig().installRoot;
const out = Deno.args[0];
if (!root || !out) {
  console.error("Usage: survey-silhouettes.ts <out.json> (needs installRoot)");
  Deno.exit(1);
}
const entries = await indexBaseGame(root);
const index = new AssetIndex(entries);
const ids = entries.map((e) => e.id).filter((id) => id.endsWith(".mdl"));

type Row = {
  id: string;
  tris: number;
  loops: number;
  verts: number;
  shortEdges: number;
  jag: number;
  jagRatio: number;
  ms: number;
};
const rows: Row[] = [];
let failed = 0;
const started = performance.now();
for (let k = 0; k < ids.length; k++) {
  const id = ids[k];
  try {
    const tris = await index.readTriangles(id);
    if (tris.length === 0) continue;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const t of tris) {
      for (let i = 0; i < 6; i += 2) {
        minX = Math.min(minX, t[i]);
        maxX = Math.max(maxX, t[i]);
        minY = Math.min(minY, t[i + 1]);
        maxY = Math.max(maxY, t[i + 1]);
      }
    }
    const cell = Math.max(maxX - minX, maxY - minY) / 160;
    const t0 = performance.now();
    const loops = silhouette(tris);
    const ms = performance.now() - t0;
    let verts = 0, shortEdges = 0, jag = 0;
    for (const loop of loops) {
      const n = loop.length;
      verts += n;
      const edge = (i: number) => {
        const a = loop[i % n], b = loop[(i + 1) % n];
        return [b[0] - a[0], b[1] - a[1]];
      };
      const turn = (i: number) => {
        const e0 = edge(i + n - 1), e1 = edge(i);
        return Math.sign(e0[0] * e1[1] - e0[1] * e1[0]);
      };
      for (let i = 0; i < n; i++) {
        const e = edge(i);
        if (Math.hypot(e[0], e[1]) < 3 * cell) shortEdges++;
        const l0 = Math.hypot(...(edge(i + n - 1) as [number, number]));
        const l1 = Math.hypot(e[0], e[1]);
        if (l0 < 6 * cell && l1 < 6 * cell) {
          const s = turn(i);
          if (s !== 0 && (s !== turn(i + 1) || s !== turn(i + n - 1))) jag++;
        }
      }
    }
    rows.push({
      id,
      tris: tris.length,
      loops: loops.length,
      verts,
      shortEdges,
      jag,
      jagRatio: verts ? jag / verts : 0,
      ms,
    });
  } catch {
    failed++;
  }
  if (k % 200 === 0) {
    console.log(
      k,
      ids.length,
      Math.round((performance.now() - started) / 1000) + "s",
    );
  }
}
await Deno.writeTextFile(out, JSON.stringify({ failed, rows }));
console.log("done", rows.length, "failed", failed);
