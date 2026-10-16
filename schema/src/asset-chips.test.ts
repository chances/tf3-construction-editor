import { assertEquals } from "jsr:@std/assert@^1";
import {
  assetChips,
  groupAssets,
  matchesFilters,
  modelNames,
  pathChips,
  singleUseChips,
  sourceChip,
  zoneOfLabel,
} from "./asset-chips.ts";

Deno.test("sourceChip names the base game Built-in", () => {
  assertEquals(sourceChip("base"), { label: "Built-in" });
  assertEquals(sourceChip("mod"), { label: "Mod" });
});

Deno.test("pathChips gives a zone chip and a generic chip for buildings", () => {
  assertEquals(pathChips("/building/com/awnings/b_awin_l_04.mdl"), [
    { label: "Commercial", zone: "com" },
    { label: "Awnings" },
  ]);
  assertEquals(pathChips("/models/buildings/res/house_small/a.mdl"), [
    { label: "Residential", zone: "res" },
    { label: "House Smalls" },
  ]);
  assertEquals(pathChips("/building/ind/x.mdl"), [
    { label: "Industrial", zone: "ind" },
  ]);
});

Deno.test("modelNames title cases the base name and keeps it as subtext", () => {
  assertEquals(modelNames("/building/com/awnings/b_awin_l_04.mdl"), {
    title: "B Awin L 4",
    base: "b_awin_l_04",
    stem: "b_awin_l_04",
    tags: [],
  });
});

Deno.test("modelNames moves variant suffixes into tags", () => {
  assertEquals(modelNames("/vehicle/train_low_idle.mdl"), {
    title: "Train",
    base: "train_low_idle",
    stem: "train",
    tags: ["Low-Poly", "State: Idle", "Animated"],
  });
  assertEquals(modelNames("/animal/cr_fish/cr_fish_01.mdl"), {
    title: "Fish 1",
    base: "cr_fish_01",
    stem: "cr_fish_01",
    tags: ["Critter"],
  });
  assertEquals(modelNames("/a/crane_high.mdl").tags, ["High-Poly"]);
  assertEquals(modelNames("/a/crane_hi.mdl").tags, ["High-Poly"]);
  assertEquals(modelNames("/a/stop_tram.mdl").tags, ["Tram"]);
  assertEquals(modelNames("/a/box_cargo.mdl"), {
    title: "Box",
    base: "box_cargo",
    stem: "box_cargo",
    tags: ["Cargo"],
  });
  assertEquals(modelNames("/a/terminal_input.mdl").tags, ["I/O"]);
  assertEquals(modelNames("/a/terminal_output_sm.mdl").tags, []);
  assertEquals(modelNames("/a/high.mdl"), {
    title: "High",
    base: "high",
    stem: "high",
    tags: [],
  });
});

Deno.test("modelNames drops leading zeros from numbers in the title only", () => {
  assertEquals(modelNames("/a/fish_03.mdl").title, "Fish 3");
  assertEquals(modelNames("/a/fish_03.mdl").base, "fish_03");
  assertEquals(modelNames("/a/pole_00.mdl").title, "Pole 0");
  assertEquals(modelNames("/a/tank_11x21.mdl").title, "Tank 11x21");
  assertEquals(pathChips("/a/flower_01/x.mdl"), [
    { label: "As" },
    { label: "Flower 1" },
  ]);
});

Deno.test("modelNames drops prod from the title and keeps the stem", () => {
  assertEquals(modelNames("/animal/cow/cow_2_prod_high.mdl"), {
    title: "Cow 2",
    base: "cow_2_prod_high",
    stem: "cow_2",
    tags: ["High-Poly"],
  });
  assertEquals(modelNames("/animal/cow/cow_prod_low.mdl").title, "Cow");
});

Deno.test("a bird name puts Bird in a parenthetical suffix", () => {
  assertEquals(modelNames("/animal/bird_crane/bird_crane.mdl"), {
    title: "Crane (Bird)",
    base: "bird_crane",
    stem: "bird_crane",
    tags: [],
  });
  assertEquals(modelNames("/a/bird.mdl").title, "Bird");
  assertEquals(pathChips("/animal/bird_eagle/bird_eagle.mdl"), [
    { label: "Animals" },
    { label: "Eagles (Bird)" },
  ]);
});

Deno.test("groupAssets merges the variant files of one model", () => {
  const entries = [
    "/animal/cow/cow.mdl",
    "/animal/cow/cow_2.mdl",
    "/animal/cow/cow_2_idle.mdl",
    "/animal/cow/cow_2_prod_low.mdl",
    "/animal/cow/cow_2_prod_high.mdl",
    "/animal/cow/cow_idle.mdl",
    "/stations/terminal_input.mdl",
    "/stations/terminal_output.mdl",
  ].map((id) => ({ id }));
  const groups = groupAssets(entries);
  assertEquals(groups.map((g) => g.entry.id), [
    "/animal/cow/cow.mdl",
    "/animal/cow/cow_2_prod_high.mdl",
    "/stations/terminal_input.mdl",
    "/stations/terminal_output.mdl",
  ]);
  assertEquals(groups[1].variants.length, 4);
  assertEquals(
    assetChips({ id: groups[1].entry.id, source: "base" }, [
      ...groups[1].variants.map((v) => v.id),
    ]).map((c) => c.label),
    [
      "Built-in",
      "Animals",
      "Cows",
      "State: Idle",
      "Animated",
      "Low-Poly",
      "High-Poly",
    ],
  );
});

Deno.test("zoneOfLabel maps a zone chip label back to its zone", () => {
  assertEquals(zoneOfLabel("Commercial"), "com");
  assertEquals(zoneOfLabel("Industrial"), "ind");
  assertEquals(zoneOfLabel("Residential"), "res");
  assertEquals(zoneOfLabel("Animals"), undefined);
});

Deno.test("every state variant adds the Animated tag", () => {
  assertEquals(modelNames("/a/door_open.mdl").tags, [
    "State: Open",
    "Animated",
  ]);
  assertEquals(modelNames("/a/door_closed.mdl").tags, [
    "State: Closed",
    "Animated",
  ]);
  assertEquals(modelNames("/a/door.mdl").tags, []);
});

Deno.test("assetChips gives each chip its filter kind", () => {
  const chips = assetChips(
    { id: "/animal/cow/cow_idle.mdl", source: "dependency", modId: "m_1" },
  );
  assertEquals(chips.map((c) => [c.kind, c.label]), [
    ["source", "Dependency"],
    ["mod", "m_1"],
    ["domain", "Animals"],
    ["folder", "Cows"],
    ["variant", "State: Idle"],
    ["variant", "Animated"],
  ]);
});

Deno.test("the first folders become domain and type sections", () => {
  const kinds = (id: string) =>
    assetChips({ id, source: "base" }).slice(1).map((c) => [c.kind, c.label]);
  assertEquals(kinds("/vehicle/train/loco/a.mdl"), [
    ["domain", "Vehicles"],
    ["vehicle", "Train"],
    ["folder", "Locos"],
  ]);
  assertEquals(kinds("/stations/air/heliport/a.mdl"), [
    ["domain", "Stations"],
    ["station", "Air"],
    ["folder", "Heliports"],
  ]);
  assertEquals(kinds("/infrastructure/traffic_light/a.mdl"), [
    ["domain", "Infrastructure"],
    ["infrastructure", "Traffic Light"],
  ]);
  assertEquals(kinds("/industries/coal_mine/a.mdl"), [
    ["domain", "Industries"],
    ["industry", "Coal Mine"],
  ]);
  assertEquals(kinds("/cargos/cement/a.mdl"), [
    ["domain", "Cargo"],
    ["cargo", "Cement"],
  ]);
});

Deno.test("building era and level folders become town chips", () => {
  assertEquals(
    assetChips({ id: "/buildings/b/c2/a.mdl", source: "base" }).slice(1)
      .map((c) => [c.kind, c.label, c.zone]),
    [
      ["domain", "Buildings", undefined],
      ["town", "Era B", undefined],
      ["town", "Commercial", "com"],
      ["town", "Level: 2", undefined],
    ],
  );
  assertEquals(zoneOfLabel("Level: 2"), undefined);
  assertEquals(zoneOfLabel("Era A"), undefined);
});

Deno.test("the landmarks domain is a town chip", () => {
  assertEquals(
    assetChips({ id: "/landmarks/lighthouse/a.mdl", source: "base" }).slice(1)
      .map((c) => [c.kind, c.label]),
    [["town", "Landmarks"], ["folder", "Lighthouses"]],
  );
});

Deno.test("a leading assets folder stays a category and is skipped by the domain", () => {
  assertEquals(
    assetChips({ id: "/assets/stations/street/a.mdl", source: "base" }).slice(1)
      .map((c) => [c.kind, c.label]),
    [
      ["domain", "Stations"],
      ["station", "Street"],
      ["folder", "Assets"],
    ],
  );
});

Deno.test("a folder chip with a footprint is a size chip", () => {
  const chips = assetChips({
    id: "/building/com/shop_3x4/a.mdl",
    source: "base",
  });
  assertEquals(chips.map((c) => [c.kind, c.label]), [
    ["source", "Built-in"],
    ["domain", "Buildings"],
    ["town", "Commercial"],
    ["size", "Shop 3x4s"],
  ]);
});

Deno.test("size chips drop the folder index after the size", () => {
  const sizes = (id: string) =>
    assetChips({ id, source: "base" }).filter((c) => c.kind === "size")
      .map((c) => c.label);
  assertEquals(sizes("/building/res/1x1_01/a.mdl"), ["1x1"]);
  assertEquals(sizes("/building/res/1x1_02/b.mdl"), ["1x1"]);
  assertEquals(sizes("/building/res/house_3x4_12/c.mdl"), ["House 3x4"]);
});

Deno.test("singleUseChips finds chips only one model has", () => {
  const lists = [
    assetChips({ id: "/animal/cougar/a.mdl", source: "base" }),
    assetChips({ id: "/animal/cow/b.mdl", source: "base" }),
    assetChips({ id: "/animal/cow/c.mdl", source: "base" }),
  ];
  assertEquals(
    [...singleUseChips(lists)].sort(),
    ["folder:Cougars"],
  );
  assertEquals([...singleUseChips(lists.slice(0, 1))], []);
});

Deno.test("matchesFilters ORs within a kind and ANDs across kinds", () => {
  const chips = assetChips(
    { id: "/animal/cow/cow_idle.mdl", source: "base" },
  );
  assertEquals(matchesFilters(chips, {}), true);
  assertEquals(matchesFilters(chips, { folder: ["Cows", "Birds"] }), true);
  assertEquals(
    matchesFilters(chips, { folder: ["Cows"], variant: ["Animated"] }),
    true,
  );
  assertEquals(
    matchesFilters(chips, { folder: ["Cows"], variant: ["High-Poly"] }),
    false,
  );
  assertEquals(matchesFilters(chips, { source: ["Mod"] }), false);
  assertEquals(matchesFilters(chips, { folder: ["cows"] }), true);
});

Deno.test("pathChips pluralizes every other folder", () => {
  assertEquals(pathChips("/animal/horse.mdl"), [{ label: "Animals" }]);
  assertEquals(pathChips("/animal/cr_fish/cr_fish_01.mdl"), [
    { label: "Animals" },
    { label: "Critter" },
    { label: "Fish" },
  ]);
  assertEquals(pathChips("/vehicle/train/a.mdl"), [
    { label: "Vehicles" },
    { label: "Trains" },
  ]);
});
