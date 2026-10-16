import {
  assert,
  assertEquals,
  assertRejects,
  assertThrows,
} from "jsr:@std/assert@^1";
import { join } from "jsr:@std/path@^1";
import {
  encodeScript,
  isFolderSetting,
  mergeConfig,
  parseDialogOutput,
  validateFolder,
  zenityArgs,
} from "./folder-dialog.ts";
import { UserError } from "./mods.ts";
import { withTempDir } from "./testing.ts";

Deno.test("folder dialog: only the two settings are accepted", () => {
  assert(isFolderSetting("installRoot"));
  assert(isFolderSetting("modsRoot"));
  assert(!isFolderSetting("port"));
  assert(!isFolderSetting(undefined));
});

Deno.test("folder dialog: output is the path, or null when cancelled", () => {
  assertEquals(parseDialogOutput("D:\\Games\\TF3\r\n"), "D:\\Games\\TF3");
  assertEquals(parseDialogOutput(""), null);
  assertEquals(parseDialogOutput("  \r\n"), null);
});

Deno.test("folder dialog: config merge keeps other keys", () => {
  const merged = mergeConfig('{"port": 9000}', "modsRoot", "D:\\mods");
  assertEquals(JSON.parse(merged), { port: 9000, modsRoot: "D:\\mods" });
  assert(merged.endsWith("\n"));
});

Deno.test("folder dialog: config merge starts from an empty file", () => {
  assertEquals(JSON.parse(mergeConfig("", "installRoot", "D:\\TF3")), {
    installRoot: "D:\\TF3",
  });
});

Deno.test("folder dialog: config merge replaces the old value", () => {
  assertEquals(
    JSON.parse(mergeConfig('{"modsRoot": "a"}', "modsRoot", "b")),
    { modsRoot: "b" },
  );
});

Deno.test("folder dialog: config merge refuses a file it cannot parse", () => {
  const error = assertThrows(
    () => mergeConfig("{nope", "modsRoot", "b"),
    UserError,
  );
  assert(error.message.includes("not valid JSON"), error.message);
  assertThrows(() => mergeConfig("[1]", "modsRoot", "b"), UserError);
});

Deno.test("folder dialog: the mods folder must be an existing directory", async () => {
  await withTempDir(async (dir) => {
    await validateFolder("modsRoot", dir);
    const missing = join(dir, "missing");
    const error = await assertRejects(
      () => validateFolder("modsRoot", missing),
      UserError,
    );
    assert(error.message.includes(missing), error.message);
  });
});

Deno.test("folder dialog: the install folder must contain base/content", async () => {
  await withTempDir(async (dir) => {
    const error = await assertRejects(
      () => validateFolder("installRoot", dir),
      UserError,
    );
    assert(error.message.includes("base/content"), error.message);
    await Deno.mkdir(join(dir, "base", "content"), { recursive: true });
    await validateFolder("installRoot", dir);
  });
});

Deno.test("folder dialog: an encoded script is UTF-16LE base64", () => {
  assertEquals(encodeScript("ab"), btoa("a\0b\0"));
});

Deno.test("folder dialog: zenity opens a folder picker at the start folder", () => {
  assertEquals(zenityArgs("Choose Mods Folder", "/home/a/mods"), [
    "--file-selection",
    "--directory",
    "--title=Choose Mods Folder",
    "--filename=/home/a/mods/",
  ]);
});

Deno.test("folder dialog: zenity omits the start folder when none is given", () => {
  assertEquals(zenityArgs("Choose", undefined), [
    "--file-selection",
    "--directory",
    "--title=Choose",
  ]);
});
