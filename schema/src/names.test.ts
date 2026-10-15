import { assertEquals } from "jsr:@std/assert@^1";
import {
  isValidModId,
  isValidResourceName,
  proposeConstruction,
  titleCaseId,
  titleCaseWords,
  toResourceId,
} from "./names.ts";

Deno.test("titleCaseId: splits on underscores and hyphens", () => {
  assertEquals(titleCaseId("my_cool_mod"), "My Cool Mod");
  assertEquals(titleCaseId("big-station_v2"), "Big Station V2");
  assertEquals(titleCaseId("__a__"), "A");
  assertEquals(titleCaseId(""), "");
});

Deno.test("titleCaseWords: capitalizes each word of typed text", () => {
  assertEquals(titleCaseWords("side platform"), "Side Platform");
  assertEquals(titleCaseWords("  grand   hall  "), "Grand Hall");
  assertEquals(titleCaseWords("my_new_hall"), "My New Hall");
  assertEquals(titleCaseWords("side platform (v2)"), "Side Platform (V2)");
  assertEquals(titleCaseWords("MyHall"), "MyHall");
  assertEquals(titleCaseWords("   "), "");
});

Deno.test("proposeConstruction: new names get Title Case name and snake id", () => {
  const existing = [
    { id: "grand_hall", name: "Grand Hall" },
    { id: "side_platform", name: "Side Platform" },
  ];
  assertEquals(proposeConstruction("side hall", existing), {
    id: "side_hall",
    name: "Side Hall",
  });
  assertEquals(proposeConstruction("  my_new   hall ", existing), {
    id: "my_new_hall",
    name: "My New Hall",
  });
});

Deno.test("proposeConstruction: existing or unusable text proposes nothing", () => {
  const existing = [{ id: "grand_hall", name: "Grand Hall" }];
  assertEquals(proposeConstruction("grand hall", existing), null);
  assertEquals(proposeConstruction("GRAND_HALL", existing), null);
  assertEquals(proposeConstruction("Grand  Hall", existing), null);
  assertEquals(proposeConstruction("***", existing), null);
  assertEquals(proposeConstruction("   ", existing), null);
});

Deno.test("toResourceId: slugs a display name", () => {
  assertEquals(toResourceId("Grand Hall (v2)"), "grand_hall_v2");
  assertEquals(toResourceId("  --Ünï  "), "n");
  assertEquals(toResourceId("***"), "");
});

Deno.test("names: modId and resource name rules", () => {
  assertEquals(isValidModId("my_mod_2"), true);
  assertEquals(isValidModId("Enigma"), false);
  assertEquals(isValidResourceName("a-b_c"), true);
  assertEquals(isValidResourceName("a b"), false);
});
