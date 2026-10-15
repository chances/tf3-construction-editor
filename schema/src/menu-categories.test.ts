import { assert, assertEquals } from "jsr:@std/assert@^1";
import { newConstruction } from "./defaults.ts";
import {
  isMenuCategory,
  MENU_CATEGORIES,
  menuLabel,
} from "./menu-categories.ts";

Deno.test("menu categories: ids are unique and snake case", () => {
  const ids = MENU_CATEGORIES.map((c) => c.id);
  assertEquals(new Set(ids).size, ids.length);
  for (const id of ids) assert(/^[a-z][a-z_]*$/.test(id), id);
});

Deno.test("menu categories: every menu has a display label", () => {
  for (const c of MENU_CATEGORIES) {
    assert(menuLabel(c.menu) !== c.menu, `${c.menu} has no label`);
  }
});

Deno.test("menu categories: a new construction uses a shipped category", () => {
  assert(isMenuCategory(newConstruction("hall").menuCategory.category));
});

Deno.test("menu categories: shipped ids are known, others are not", () => {
  assert(isMenuCategory("road_buildings"));
  assert(isMenuCategory("street_constructions"));
  assert(!isMenuCategory("misc"));
});
