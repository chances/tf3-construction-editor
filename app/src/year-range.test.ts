import { assertEquals } from "jsr:@std/assert@^1";
import { applyTypedYear } from "./year-range.ts";

const bounds = { min: 1850, max: 2050 };

Deno.test("year range: typing 0 or nothing in the start box means always", () => {
  assertEquals(
    applyTypedYear({ from: 1900, to: 1950 }, "from", "0", bounds),
    { from: 0, to: 1950 },
  );
  assertEquals(
    applyTypedYear({ from: 1900, to: undefined }, "from", "  ", bounds),
    { from: 0, to: undefined },
  );
});

Deno.test("year range: an empty end box means forever", () => {
  assertEquals(
    applyTypedYear({ from: 1900, to: 1950 }, "to", "", bounds),
    { from: 1900, to: undefined },
  );
});

Deno.test("year range: typed years are held inside the bounds", () => {
  assertEquals(
    applyTypedYear({ from: 0, to: undefined }, "from", "12", bounds),
    { from: 1850, to: undefined },
  );
  assertEquals(
    applyTypedYear({ from: 0, to: undefined }, "to", "3000", bounds),
    { from: 0, to: 2050 },
  );
  assertEquals(
    applyTypedYear({ from: 0, to: undefined }, "to", "1999.6", bounds),
    { from: 0, to: 2000 },
  );
});

Deno.test("year range: the other end follows so the range never inverts", () => {
  assertEquals(
    applyTypedYear({ from: 1900, to: 1950 }, "from", "1960", bounds),
    { from: 1960, to: 1960 },
  );
  assertEquals(
    applyTypedYear({ from: 1900, to: 1950 }, "to", "1880", bounds),
    { from: 1880, to: 1880 },
  );
});

Deno.test("year range: an always start is not pulled up by the end", () => {
  assertEquals(
    applyTypedYear({ from: 0, to: undefined }, "to", "1900", bounds),
    { from: 0, to: 1900 },
  );
});
