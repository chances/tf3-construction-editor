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

const { CeSpinner } = await import("./ce-spinner.ts");
type SpinnerChange = import("./ce-spinner.ts").SpinnerChange;

interface Mounted {
  el: InstanceType<typeof CeSpinner>;
  events: (number | undefined)[];
  root: ShadowRoot;
}

async function mount(
  props: { value?: number; min?: number; max?: number; step?: number } = {},
): Promise<Mounted> {
  const el = document.createElement(
    "ce-spinner",
  ) as InstanceType<typeof CeSpinner>;
  el.label = "Layer tag";
  el.value = props.value;
  el.min = props.min;
  el.max = props.max;
  if (props.step !== undefined) el.step = props.step;
  const events: (number | undefined)[] = [];
  el.addEventListener(
    "change",
    (e) => events.push((e as CustomEvent<SpinnerChange>).detail.value),
  );
  document.body.append(el);
  await el.updateComplete;
  return { el, events, root: el.shadowRoot! };
}

const button = (m: Mounted, which: "up" | "down") =>
  m.root.querySelector<HTMLButtonElement>(`button.${which}`)!;

Deno.test("spinner: shows the value in the number box", async () => {
  const m = await mount({ value: 4 });
  assertEquals(m.root.querySelector<HTMLInputElement>("input")!.value, "4");
});

Deno.test("spinner: the step buttons are labelled and titled with the field", async () => {
  const m = await mount({ value: 4 });
  for (
    const [which, text] of [["up", "Increase Layer tag"], [
      "down",
      "Decrease Layer tag",
    ]] as const
  ) {
    assertEquals(button(m, which).getAttribute("aria-label"), text);
    assertEquals(button(m, which).getAttribute("title"), text);
  }
});

Deno.test("spinner: up and down step by the step size", async () => {
  const m = await mount({ value: 4, step: 5 });
  button(m, "up").click();
  button(m, "down").click();
  assertEquals(m.events, [9, -1]);
});

Deno.test("spinner: stepping an empty box starts from zero", async () => {
  const m = await mount();
  button(m, "up").click();
  assertEquals(m.events, [1]);
});

Deno.test("spinner: stepping stays inside min and max", async () => {
  const low = await mount({ value: 0, min: 0, max: 3 });
  assert(button(low, "down").disabled, "down is disabled at the minimum");
  const high = await mount({ value: 3, min: 0, max: 3 });
  assert(button(high, "up").disabled, "up is disabled at the maximum");
  const empty = await mount({ min: 2, max: 3 });
  button(empty, "down").click();
  assertEquals(empty.events, [2]);
});

Deno.test("spinner: a fractional step does not drift", async () => {
  const m = await mount({ value: 0.1, step: 0.2 });
  button(m, "up").click();
  assertEquals(m.events, [0.3]);
});

Deno.test("spinner: a null step accepts any value and the buttons move by 1", async () => {
  const m = await mount({ value: 0.5 });
  m.el.step = null;
  await m.el.updateComplete;
  assertEquals(
    m.root.querySelector<HTMLInputElement>("input")!.getAttribute("step"),
    "any",
  );
  button(m, "up").click();
  assertEquals(m.events, [1.5]);
});

Deno.test("spinner: disabled disables the box and both buttons", async () => {
  const m = await mount({ value: 4 });
  m.el.disabled = true;
  await m.el.updateComplete;
  assert(m.root.querySelector<HTMLInputElement>("input")!.disabled);
  assert(button(m, "up").disabled);
  assert(button(m, "down").disabled);
});

Deno.test("spinner: typing a number reports it once", async () => {
  const m = await mount({ value: 4 });
  const input = m.root.querySelector<HTMLInputElement>("input")!;
  input.value = "12";
  input.dispatchEvent(new Event("change", { bubbles: true }));
  assertEquals(m.events, [12]);
});

Deno.test("spinner: emptying the box reports undefined", async () => {
  const m = await mount({ value: 4 });
  const input = m.root.querySelector<HTMLInputElement>("input")!;
  input.value = "";
  input.dispatchEvent(new Event("change", { bubbles: true }));
  assertEquals(m.events, [undefined]);
});
