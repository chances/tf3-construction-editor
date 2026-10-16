import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { assertEquals } from "jsr:@std/assert@^1";

/**
 * Integration tests for the text fields that show a shortened path while
 * unfocused and the full path while focused: the Content Folder field and the
 * icon picker. Each test mounts the real element in happy-dom and drives it
 * with focus, blur, and change events.
 */

await GlobalRegistrator.register({
  settings: {
    disableJavaScriptFileLoading: true,
    disableJavaScriptEvaluation: true,
    disableCSSFileLoading: true,
    handleDisabledFileLoadingAsSuccess: true,
  },
});

// Deno dispatches its own `load` and `unload` events on `globalThis`, which is
// now happy-dom's window. happy-dom cannot patch a native `Event`.
const dispatchEvent = globalThis.dispatchEvent.bind(globalThis);
globalThis.dispatchEvent = (event: Event) => {
  try {
    return dispatchEvent(event);
  } catch {
    return true;
  }
};

await import("./ce-folder-field.ts");
await import("./ce-icon-picker.ts");

type Field = HTMLElement & {
  value: string;
  root?: string;
  label: string;
  dir?: string;
  updateComplete: Promise<boolean>;
};

const ROOT = "./content/";

/**
 * happy-dom has no layout, so the input's widths come from here. The text fits
 * when `scroll` is at most `client`.
 */
const layout = { scroll: 0, client: 100 };
for (
  const [name, read] of [
    ["scrollWidth", () => layout.scroll],
    ["clientWidth", () => layout.client],
  ] as const
) {
  Object.defineProperty(HTMLInputElement.prototype, name, {
    configurable: true,
    get: read,
  });
}

const settle = async (el: Field) => {
  await new Promise((r) => setTimeout(r, 0));
  await el.updateComplete;
};

async function mountFolder(value: string, overflowing = false) {
  layout.scroll = overflowing ? 500 : 50;
  const el = document.createElement("ce-folder-field") as Field;
  el.label = "Content Folder";
  el.root = ROOT;
  el.value = value;
  const changes: string[] = [];
  // Stands in for the Properties pane, which stores the value and passes it
  // back down.
  el.addEventListener("change", (e) => {
    const { value: next } = (e as CustomEvent<{ value: string }>).detail;
    changes.push(next);
    el.value = next;
  });
  document.body.append(el);
  await settle(el);
  return { el, changes, input: el.shadowRoot!.querySelector("input")! };
}

async function focus(f: { el: Field; input: HTMLInputElement }) {
  f.input.dispatchEvent(new Event("focus"));
  await f.el.updateComplete;
}

async function blur(f: { el: Field; input: HTMLInputElement }) {
  f.input.dispatchEvent(new Event("blur"));
  await f.el.updateComplete;
}

async function commit(
  f: { el: Field; input: HTMLInputElement },
  text: string,
) {
  f.input.value = text;
  f.input.dispatchEvent(new Event("change"));
  await f.el.updateComplete;
}

Deno.test("path fields: an unfocused Content Folder shortens its path only when it does not fit", async () => {
  const f = await mountFolder("stations/custom", true);
  assertEquals(f.input.value, "./…/custom");
});

Deno.test("path fields: an unfocused Content Folder that fits is never shortened", async () => {
  // Regression: a path such as ./content/constructions fits the input but was
  // shortened to ./…/constructions anyway.
  const f = await mountFolder("constructions");
  assertEquals(f.input.value, "./content/constructions");
  const deep = await mountFolder("stations/custom/deep");
  assertEquals(deep.input.value, "./content/stations/custom/deep");
});

Deno.test("path fields: a changed value is measured again", async () => {
  const f = await mountFolder("stations/custom", true);
  assertEquals(f.input.value, "./…/custom");
  layout.scroll = 50;
  f.el.value = "short";
  await settle(f.el);
  assertEquals(f.input.value, "./content/short");
});

Deno.test("path fields: a focused Content Folder shows the full path relative to the mod folder", async () => {
  const f = await mountFolder("stations/custom");
  await focus(f);
  // Regression: the focused text was relative to the content folder, which
  // dropped `./content`.
  assertEquals(f.input.value, "./content/stations/custom");
});

Deno.test("path fields: the path never names the mod folder", async () => {
  const f = await mountFolder("stations/custom");
  await focus(f);
  assertEquals(f.input.value.startsWith("./"), true);
});

Deno.test("path fields: a one segment folder that does not fit still leads with ./", async () => {
  const f = await mountFolder("constructions", true);
  assertEquals(f.input.value, "./…/constructions");
  await focus(f);
  assertEquals(f.input.value, "./content/constructions");
});

Deno.test("path fields: blurring returns a long Content Folder to the shortened path", async () => {
  const f = await mountFolder("stations/custom", true);
  await focus(f);
  assertEquals(f.input.value, "./content/stations/custom");
  await blur(f);
  await settle(f.el);
  assertEquals(f.input.value, "./…/custom");
});

Deno.test("path fields: a typed full path commits the folder under content", async () => {
  const f = await mountFolder("stations/custom");
  await focus(f);
  await commit(f, "./content/stations/other");
  assertEquals(f.changes, ["stations/other"]);
  assertEquals(f.el.value, "stations/other");
  assertEquals(f.input.value, "./content/stations/other");
});

Deno.test("path fields: a typed path without ./content/ commits as typed", async () => {
  const f = await mountFolder("stations/custom");
  await focus(f);
  await commit(f, "stations/other");
  assertEquals(f.changes, ["stations/other"]);
});

Deno.test("path fields: an unchanged Content Folder emits nothing", async () => {
  const f = await mountFolder("stations/custom");
  await focus(f);
  await commit(f, "./content/stations/custom");
  assertEquals(f.changes, []);
});

Deno.test("path fields: an empty Content Folder shows the content folder to type after", async () => {
  const f = await mountFolder("");
  await focus(f);
  assertEquals(f.input.value, ROOT);
});

Deno.test("path fields: the icon picker shows the image name unfocused and the full id focused", async () => {
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(
        JSON.stringify({ total: 1, exact: true, folders: [], entries: [] }),
      ),
    )) as typeof fetch;
  const el = document.createElement("ce-icon-picker") as Field;
  el.label = "Icon";
  el.dir = "my_mod";
  el.value = "/gui/icons/arrow.tga";
  document.body.append(el);
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector("input")!;
  assertEquals(input.value, "arrow");
  input.dispatchEvent(new Event("focus"));
  await el.updateComplete;
  assertEquals(input.value, "/gui/icons/arrow.tga");
});
