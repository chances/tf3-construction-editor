import { assertEquals } from "jsr:@std/assert@^1";
import type { AssetFacet } from "./api.ts";
import {
  canonicalFilters,
  filterCount,
  filtersFromSearch,
  isSelected,
  queryFromSearch,
  searchWithState,
} from "./asset-filters.ts";

Deno.test("filtersFromSearch reads comma separated labels per group", () => {
  assertEquals(
    filtersFromSearch(
      "?domain=animals,game+mechanics&variant=animated&x=1",
    ),
    { domain: ["animals", "game mechanics"], variant: ["animated"] },
  );
  assertEquals(filtersFromSearch("?domain=game%20mechanics"), {
    domain: ["game mechanics"],
  });
  assertEquals(filtersFromSearch(""), {});
  assertEquals(filtersFromSearch("?domain=,animals,,animals"), {
    domain: ["animals"],
  });
});

Deno.test("searchWithFilters writes one comma joined parameter per group", () => {
  assertEquals(
    searchWithState("", { domain: ["Animals", "Game Mechanics"] }, ""),
    "domain=animals,game+mechanics",
  );
  assertEquals(
    searchWithState("?x=1&folder=Old", {
      folder: ["Cows"],
      source: ["Mod"],
    }, ""),
    "x=1&source=mod&folder=cows",
  );
  assertEquals(searchWithState("?folder=Old", {}, ""), "");
});

Deno.test("the search text is the q parameter", () => {
  assertEquals(queryFromSearch("?q=big+cow&x=1"), "big cow");
  assertEquals(queryFromSearch("?x=1"), "");
  assertEquals(searchWithState("", {}, "big cow"), "q=big+cow");
  assertEquals(
    searchWithState("?q=old&x=1", { domain: ["Animals"] }, "cow"),
    "q=cow&x=1&domain=animals",
  );
  assertEquals(searchWithState("?q=old&x=1", {}, ""), "x=1");
});

Deno.test("filters survive a round trip through the query string", () => {
  const filters = { mod: ["a b&c+d"], variant: ["state: idle", "i/o"] };
  assertEquals(
    filtersFromSearch(searchWithState("", filters, "")),
    filters,
  );
  assertEquals(filterCount(filters), 3);
});

Deno.test("selection ignores case and canonicalFilters restores the chip spelling", () => {
  const facets: AssetFacet[] = [
    { kind: "domain", label: "Game Mechanics", count: 10 },
    { kind: "domain", label: "Animals", count: 19 },
  ];
  const filters = { domain: ["game mechanics", "unknown"] };
  assertEquals(isSelected(filters, "domain", "Game Mechanics"), true);
  assertEquals(isSelected(filters, "domain", "Animals"), false);
  assertEquals(canonicalFilters(filters, facets), {
    domain: ["Game Mechanics", "unknown"],
  });
});
