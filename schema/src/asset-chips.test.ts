import { assertEquals } from "jsr:@std/assert@^1";
import {
  assetChips,
  groupAssets,
  modelNames,
  pathChips,
  sourceChip,
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
    tags: ["Low-Poly", "State: Idle"],
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
    ["Built-in", "Animals", "Cows", "State: Idle", "Low-Poly", "High-Poly"],
  );
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
