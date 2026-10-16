import { assertEquals } from "jsr:@std/assert@^1";
import type { AssetFacet } from "./api.ts";
import { scopeOfPrefix, suggestTags, trailingWord } from "./tag-suggest.ts";

const facets: AssetFacet[] = [
  { kind: "vehicle", label: "Train", count: 70 },
  { kind: "vehicle", label: "Tram", count: 55 },
  { kind: "vehicle", label: "Truck", count: 48 },
  { kind: "folder", label: "Tracks", count: 35 },
  { kind: "infrastructure", label: "Track", count: 35 },
  { kind: "infrastructure", label: "Traffic Light", count: 29 },
  { kind: "station", label: "Rail", count: 271 },
  { kind: "folder", label: "Trains", count: 12 },
];

const labels = (text: string, selected = {}) =>
  suggestTags(text, facets, selected).suggestions.map((s) => s.label);

Deno.test("trailingWord is the text after the last space", () => {
  assertEquals(trailingWord("big tr"), { word: "tr", start: 4 });
  assertEquals(trailingWord("tr"), { word: "tr", start: 0 });
  assertEquals(trailingWord("tr "), { word: "", start: 3 });
  assertEquals(trailingWord(""), { word: "", start: 0 });
});

Deno.test("a typed word suggests matching tags, best match then model count", () => {
  assertEquals(labels("tr"), [
    "Train",
    "Tram",
    "Truck",
    "Track",
    "Tracks",
    "Traffic Light",
    "Trains",
  ]);
});

Deno.test("a word inside a label ranks above a plain substring", () => {
  assertEquals(labels("light"), ["Traffic Light"]);
  assertEquals(labels("ai"), ["Rail", "Train", "Trains"]);
});

Deno.test("matching ignores case and nothing is suggested for no word", () => {
  assertEquals(labels("TRAM"), ["Tram"]);
  assertEquals(labels(""), []);
  assertEquals(labels("tram "), []);
});

Deno.test("a group prefix limits suggestions to that group", () => {
  assertEquals(labels("vehicle:tr"), ["Train", "Tram", "Truck"]);
  assertEquals(labels("veh:tr"), ["Train", "Tram", "Truck"]);
  assertEquals(labels("vehicle:"), ["Train", "Tram", "Truck"]);
  assertEquals(labels("infrastructure:tra"), ["Track", "Traffic Light"]);
});

Deno.test("an unknown prefix is matched as plain text", () => {
  assertEquals(scopeOfPrefix("nothing"), null);
  assertEquals(labels("nothing:tr"), []);
});

Deno.test("selected tags are left out", () => {
  assertEquals(labels("tr", { vehicle: ["Train"] }).includes("Train"), false);
});

Deno.test("start says where the typed word begins", () => {
  assertEquals(suggestTags("big vehicle:tr", facets, {}).start, 4);
});

Deno.test("the list is capped", () => {
  assertEquals(suggestTags("t", facets, {}, 3).suggestions.length, 3);
});
