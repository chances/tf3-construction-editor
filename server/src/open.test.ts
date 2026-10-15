import { assertEquals } from "jsr:@std/assert@^1";
import { openCommand } from "./open.ts";

Deno.test("open: each platform uses its own opener", () => {
  assertEquals(openCommand("windows", "C:\\a\\cedit.config.json"), {
    command: "explorer.exe",
    args: ["C:\\a\\cedit.config.json"],
  });
  assertEquals(openCommand("darwin", "/a/cedit.config.json"), {
    command: "open",
    args: ["/a/cedit.config.json"],
  });
  assertEquals(openCommand("linux", "/a/cedit.config.json"), {
    command: "xdg-open",
    args: ["/a/cedit.config.json"],
  });
});
