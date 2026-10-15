import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { assert, assertEquals } from "jsr:@std/assert@^1";

// External file loading is off so happy-dom never dispatches the Deno-native
// error event it cannot patch.
await GlobalRegistrator.register({
  settings: {
    disableJavaScriptFileLoading: true,
    disableJavaScriptEvaluation: true,
    disableCSSFileLoading: true,
    handleDisabledFileLoadingAsSuccess: true,
  },
});

// Deno dispatches its own `load` and `unload` events on `globalThis`, which is
// now happy-dom's window. happy-dom cannot patch a native `Event`, so those
// dispatches are swallowed.
const dispatchEvent = globalThis.dispatchEvent.bind(globalThis);
globalThis.dispatchEvent = (event: Event) => {
  try {
    return dispatchEvent(event);
  } catch {
    return true;
  }
};

const { CeRangeSlider } = await import("./ce-range-slider.ts");
type RangeChange = import("./ce-range-slider.ts").RangeChange;

interface Mounted {
  el: InstanceType<typeof CeRangeSlider>;
  events: RangeChange[];
  root: ShadowRoot;
}

/** The same bounds the Properties pane gives the slider. */
async function mount(
  props: { from?: number; to?: number } = {},
): Promise<Mounted> {
  const el = document.createElement(
    "ce-range-slider",
  ) as InstanceType<typeof CeRangeSlider>;
  el.min = 1850;
  el.max = 2050;
  el.from = props.from ?? 0;
  el.to = props.to;
  el.startLabel = "Always";
  el.foreverLabel = "Forever";
  el.fromLabel = "Year from";
  el.toLabel = "Year to";
  const events: RangeChange[] = [];
  el.addEventListener(
    "change",
    (e) => events.push((e as CustomEvent<RangeChange>).detail),
  );
  document.body.append(el);
  await el.updateComplete;
  return { el, events, root: el.shadowRoot! };
}

const labels = (m: Mounted) =>
  [...m.root.querySelectorAll("button.year")].map((b) => b.textContent!.trim());

const ranges = (
  m: Mounted,
) => [...m.root.querySelectorAll<HTMLInputElement>('input[type="range"]')];

async function openBox(m: Mounted, side: "from" | "to") {
  const index = side === "from" ? 0 : 1;
  m.root.querySelectorAll<HTMLButtonElement>("button.year")[index].click();
  await m.el.updateComplete;
  return m.root.querySelector<HTMLInputElement>(".year-edit input")!;
}

async function typeAndBlur(m: Mounted, input: HTMLInputElement, text: string) {
  input.value = text;
  input.dispatchEvent(new Event("blur"));
  await m.el.updateComplete;
}

async function release(m: Mounted, thumb: HTMLInputElement, value: number) {
  thumb.value = String(value);
  thumb.dispatchEvent(new Event("input", { bubbles: true }));
  thumb.dispatchEvent(new Event("change", { bubbles: true }));
  await m.el.updateComplete;
}

Deno.test("range slider: no start and no end read Always and Forever", async () => {
  const m = await mount({ from: 0, to: undefined });
  assertEquals(labels(m), ["Always", "Forever"]);
});

Deno.test("range slider: 1850 is a real year, not Always", async () => {
  const m = await mount({ from: 1850 });
  assertEquals(labels(m), ["1850", "Forever"]);
  const [low] = ranges(m);
  assertEquals(low.value, "1850");
  assertEquals(low.min, "1849");
});

Deno.test("range slider: 2050 is a real year, not Forever", async () => {
  const m = await mount({ from: 1900, to: 2050 });
  assertEquals(labels(m), ["1900", "2050"]);
  const [, high] = ranges(m);
  assertEquals(high.value, "2050");
  assertEquals(high.max, "2051");
});

Deno.test("range slider: the thumbs have one stop beyond each year", async () => {
  const m = await mount();
  const [low, high] = ranges(m);
  assertEquals([low.min, low.max], ["1849", "2051"]);
  assertEquals([high.min, high.max], ["1849", "2051"]);
  assertEquals([low.value, high.value], ["1849", "2051"]);
});

Deno.test("range slider: dragging the start to the bottom stop means Always", async () => {
  const m = await mount({ from: 1900, to: 1950 });
  await release(m, ranges(m)[0], 1849);
  assertEquals(m.events, [{ from: 0, to: 1950 }]);
});

Deno.test("range slider: one stop above the bottom is 1850", async () => {
  const m = await mount({ from: 0 });
  await release(m, ranges(m)[0], 1850);
  assertEquals(m.events, [{ from: 1850, to: undefined }]);
});

Deno.test("range slider: dragging the end to the top stop means Forever", async () => {
  const m = await mount({ from: 1900, to: 1950 });
  await release(m, ranges(m)[1], 2051);
  assertEquals(m.events, [{ from: 1900, to: undefined }]);
});

Deno.test("range slider: the end thumb cannot pass the start thumb", async () => {
  const m = await mount({ from: 1950, to: 1990 });
  await release(m, ranges(m)[1], 1900);
  assertEquals(m.events, [{ from: 1950, to: 1950 }]);
});

Deno.test("range slider: the Always box opens as 0 and has the year bounds", async () => {
  const m = await mount({ from: 0 });
  const input = await openBox(m, "from");
  assertEquals(input.value, "0");
  assertEquals([input.min, input.max, input.step], ["1850", "2050", "1"]);
  const prefix = m.root.querySelector<HTMLButtonElement>(
    ".year-edit button.prefix",
  )!;
  assert(prefix.getAttribute("aria-label")!.endsWith(" to Always"));
  assertEquals(prefix.getAttribute("title"), "Always");
});

Deno.test("range slider: the clock button sets the start to Always", async () => {
  const m = await mount({ from: 1900, to: 1950 });
  await openBox(m, "from");
  m.root.querySelector<HTMLButtonElement>(".year-edit button.prefix")!
    .click();
  await m.el.updateComplete;
  assertEquals(m.events, [{ from: 0, to: 1950 }]);
  assertEquals(m.root.querySelector(".year-edit"), null);
});

Deno.test("range slider: an empty start box on blur means Always", async () => {
  const m = await mount({ from: 1900, to: 1950 });
  await typeAndBlur(m, await openBox(m, "from"), "");
  assertEquals(m.events, [{ from: 0, to: 1950 }]);
});

Deno.test("range slider: leaving the Always box unchanged shows Always and emits nothing", async () => {
  const m = await mount({ from: 0 });
  const input = await openBox(m, "from");
  await typeAndBlur(m, input, "0");
  assertEquals(labels(m), ["Always", "Forever"]);
  assertEquals(m.events, []);
});

Deno.test("range slider: typing a year in the Always box sets the start", async () => {
  const m = await mount({ from: 0 });
  await typeAndBlur(m, await openBox(m, "from"), "1920");
  assertEquals(m.events, [{ from: 1920, to: undefined }]);
});

Deno.test("range slider: a typed year below 1850 is held at 1850", async () => {
  const m = await mount({ from: 0 });
  await typeAndBlur(m, await openBox(m, "from"), "12");
  assertEquals(m.events, [{ from: 1850, to: undefined }]);
});

Deno.test("range slider: typing 0 over a year goes back to Always", async () => {
  const m = await mount({ from: 1900, to: 1950 });
  await typeAndBlur(m, await openBox(m, "from"), "0");
  assertEquals(m.events, [{ from: 0, to: 1950 }]);
});

Deno.test("range slider: the Forever box is empty and has the clock button", async () => {
  const m = await mount({ from: 1900 });
  const input = await openBox(m, "to");
  assertEquals(input.value, "");
  assertEquals(input.placeholder, "Forever");
  const prefix = m.root.querySelector<HTMLButtonElement>(
    ".year-edit button.prefix",
  )!;
  assert(prefix, "the prefix button is present");
  assert(prefix.getAttribute("aria-label")!.endsWith(" to Forever"));
  assertEquals(prefix.getAttribute("title"), "Forever");
});

Deno.test("range slider: the clock button sets the end to Forever", async () => {
  const m = await mount({ from: 1900, to: 1950 });
  await openBox(m, "to");
  m.root.querySelector<HTMLButtonElement>(".year-edit button.prefix")!
    .click();
  await m.el.updateComplete;
  assertEquals(m.events, [{ from: 1900, to: undefined }]);
});

Deno.test("range slider: an empty end box on blur means Forever", async () => {
  const m = await mount({ from: 1900, to: 1950 });
  await typeAndBlur(m, await openBox(m, "to"), "");
  assertEquals(m.events, [{ from: 1900, to: undefined }]);
});

Deno.test("range slider: down arrow in the empty end box starts at the last year", async () => {
  const m = await mount({ from: 1900 });
  const input = await openBox(m, "to");
  const down = new KeyboardEvent("keydown", {
    key: "ArrowDown",
    bubbles: true,
    cancelable: true,
  });
  input.dispatchEvent(down);
  assertEquals(input.value, "2050");
  assert(down.defaultPrevented, "the native step to 0 is cancelled");
});

Deno.test("range slider: down arrow in a filled end box is left alone", async () => {
  const m = await mount({ from: 1900, to: 1950 });
  const input = await openBox(m, "to");
  const down = new KeyboardEvent("keydown", {
    key: "ArrowDown",
    bubbles: true,
    cancelable: true,
  });
  input.dispatchEvent(down);
  assertEquals(input.value, "1950");
  assert(!down.defaultPrevented);
});

Deno.test("range slider: a typed end above 2050 is held at 2050, not Forever", async () => {
  const m = await mount({ from: 1900 });
  await typeAndBlur(m, await openBox(m, "to"), "3000");
  assertEquals(m.events, [{ from: 1900, to: 2050 }]);
});

Deno.test("range slider: Escape closes the box and emits nothing", async () => {
  const m = await mount({ from: 1900, to: 1950 });
  const input = await openBox(m, "to");
  input.value = "1999";
  input.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
  await m.el.updateComplete;
  input.dispatchEvent(new Event("blur"));
  await m.el.updateComplete;
  assertEquals(labels(m), ["1900", "1950"]);
  assertEquals(m.events, []);
});

Deno.test("range slider: a thumb press shows the grabbing state until release", async () => {
  const m = await mount({ from: 1900, to: 1950 });
  const slider = () => m.root.querySelector(".slider")!;
  assert(!slider().classList.contains("dragging"));
  ranges(m)[0].dispatchEvent(new Event("pointerdown", { bubbles: true }));
  await m.el.updateComplete;
  assert(slider().classList.contains("dragging"));
  globalThis.dispatchEvent(new Event("pointerup"));
  await m.el.updateComplete;
  assert(!slider().classList.contains("dragging"));
});

Deno.test("range slider: no box is a negative year", async () => {
  const m = await mount({ from: 1900 });
  const input = await openBox(m, "from");
  assert(Number(input.min) > 0, "the start box has a positive minimum");
  await typeAndBlur(m, input, "-5");
  assertEquals(m.events, [{ from: 1850, to: undefined }]);
});
