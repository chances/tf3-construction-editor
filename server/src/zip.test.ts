import { assertEquals, assertRejects } from "jsr:@std/assert@^1";
import { join } from "jsr:@std/path@^1";
import { withTempDir, writeZip } from "./testing.ts";
import { ZipArchive, ZipError } from "./zip.ts";

Deno.test("zip: reads stored and deflated entries", async () => {
  await withTempDir(async (dir) => {
    const files = {
      "a/one.mdl": "x".repeat(5000),
      "a/two.txt": "short",
    };
    for (const level of [0, 6] as const) {
      const path = join(dir, `l${level}.zip`);
      await writeZip(path, files, level);
      const zip = await ZipArchive.open(path);
      assertEquals(
        zip.entries.map((e) => e.name).sort(),
        Object.keys(files).sort(),
      );
      assertEquals(await zip.readText("a/one.mdl"), files["a/one.mdl"]);
      assertEquals(await zip.readText("a/two.txt"), "short");
    }
  });
});

Deno.test("zip: a non-zip file is rejected with a clear error", async () => {
  await withTempDir(async (dir) => {
    const path = join(dir, "bad.zip");
    await Deno.writeTextFile(path, "this is not a zip file at all, no way");
    await assertRejects(() => ZipArchive.open(path), ZipError);
  });
});
