import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { assert, assertEquals } from "jsr:@std/assert@^1";

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

const { CeIconPicker } = await import("./ce-icon-picker.ts");

const IMAGES = [
  { id: "/gui/icons/arrow.tga", source: "base", format: "tga" },
  { id: "/gui/icons/arrow_big.dds", source: "base", format: "dds" },
  { id: "/mod/own.png", source: "mod", format: "png" },
];

interface Mounted {
  el: InstanceType<typeof CeIconPicker>;
  root: ShadowRoot;
  changes: string[];
  requests: string[];
}

/** Stubs the images route. `fail` makes it answer with a 500 and a reason. */
async function mount(
  props: {
    value?: string;
    fail?: boolean;
    entries?: unknown[];
    /** Size of the whole index. Zero means the game is not set up. */
    total?: number;
    /** Folders the stub offers for a query. None unless the text has a `/`. */
    foldersFor?: (query: string) => string[];
  } = {},
): Promise<Mounted> {
  const requests: string[] = [];
  globalThis.fetch = ((input: string | URL | Request) => {
    const url = String(input);
    requests.push(url);
    if (props.fail) {
      return Promise.resolve(
        new Response(JSON.stringify({ error: "The server is not running." }), {
          status: 500,
        }),
      );
    }
    const raw = new URL(url, "http://localhost").searchParams.get("q") ?? "";
    const q = raw.toLowerCase();
    const entries = (props.entries ?? IMAGES).filter((e) =>
      (e as { id: string }).id.toLowerCase().includes(q)
    );
    const folders = q.includes("/") ? props.foldersFor?.(q) ?? [] : [];
    return Promise.resolve(
      new Response(
        JSON.stringify({
          total: props.total ?? IMAGES.length,
          exact: IMAGES.some((e) => e.id === raw.trim()),
          folders,
          entries,
        }),
      ),
    );
  }) as typeof fetch;

  const el = document.createElement(
    "ce-icon-picker",
  ) as InstanceType<typeof CeIconPicker>;
  el.label = "Icon";
  el.dir = "demo_mod";
  el.value = props.value ?? "";
  const changes: string[] = [];
  // Stands in for the Properties pane, which stores the value and passes it
  // back down.
  el.addEventListener("change", (e) => {
    const { value } = (e as CustomEvent<{ value: string }>).detail;
    changes.push(value);
    el.value = value;
  });
  document.body.append(el);
  await el.updateComplete;
  return { el, root: el.shadowRoot!, changes, requests };
}

const input = (m: Mounted) => m.root.querySelector<HTMLInputElement>("input")!;
const rows = (m: Mounted) => [...m.root.querySelectorAll("li[role=option]")];
const settle = async (m: Mounted) => {
  await new Promise((r) => setTimeout(r, 0));
  await m.el.updateComplete;
};

async function focus(m: Mounted) {
  input(m).dispatchEvent(new Event("focus"));
  await settle(m);
}

async function type(m: Mounted, text: string) {
  input(m).value = text;
  input(m).dispatchEvent(new Event("input", { bubbles: true }));
  await settle(m);
}

const key = (m: Mounted, name: string) =>
  input(m).dispatchEvent(
    new KeyboardEvent("keydown", {
      key: name,
      bubbles: true,
      cancelable: true,
    }),
  );

Deno.test("icon picker: focusing lists images with name, folder, and thumbnail", async () => {
  const m = await mount();
  await focus(m);
  assertEquals(rows(m).length, 3);
  const first = rows(m)[0];
  assertEquals(first.querySelector(".name")!.textContent, "arrow.tga");
  assertEquals(
    first.querySelector(".path")!.textContent,
    "/gui/icons/arrow.tga",
  );
  const src = first.querySelector("img")!.getAttribute("src")!;
  assert(
    src.startsWith("/api/mods/demo_mod/image?id=%2Fgui%2Ficons%2Farrow.tga"),
  );
});

Deno.test("icon picker: the current value shows a preview thumbnail", async () => {
  const m = await mount({ value: "/gui/icons/arrow.tga" });
  const src = m.root.querySelector(".preview img")!.getAttribute("src")!;
  assert(src.includes("arrow.tga"));
});

Deno.test("icon picker: an empty value shows the placeholder tile", async () => {
  const m = await mount();
  assert(m.root.querySelector(".preview .tile"));
  assertEquals(m.root.querySelector(".preview img"), null);
});

Deno.test("icon picker: typing asks the server for matches", async () => {
  const m = await mount();
  await focus(m);
  await type(m, "big");
  assert(m.requests.at(-1)!.includes("q=big"));
  assertEquals(rows(m).map((r) => r.querySelector(".name")!.textContent), [
    "arrow_big.dds",
  ]);
});

Deno.test("icon picker: arrow keys move and Enter picks the active row", async () => {
  const m = await mount();
  await focus(m);
  key(m, "ArrowDown");
  await m.el.updateComplete;
  key(m, "Enter");
  await m.el.updateComplete;
  assertEquals(m.changes, ["/gui/icons/arrow_big.dds"]);
  assertEquals(rows(m).length, 0);
});

Deno.test("icon picker: clicking a row picks it", async () => {
  const m = await mount();
  await focus(m);
  (rows(m)[2] as HTMLElement).click();
  await m.el.updateComplete;
  assertEquals(m.changes, ["/mod/own.png"]);
});

Deno.test("icon picker: Escape closes the list without a change", async () => {
  const m = await mount({ value: "/gui/icons/arrow.tga" });
  await focus(m);
  await type(m, "zzz");
  key(m, "Escape");
  await m.el.updateComplete;
  input(m).dispatchEvent(new Event("blur"));
  await m.el.updateComplete;
  assertEquals(m.changes, []);
  assertEquals(input(m).value, "arrow");
});

Deno.test("icon picker: typed text that matches nothing is still a value", async () => {
  const m = await mount();
  await focus(m);
  await type(m, "/my/own/icon.tga");
  assertEquals(rows(m).length, 0);
  assertEquals(
    m.root.querySelector("li.none")!.textContent,
    "No images match.",
  );
  input(m).dispatchEvent(new Event("blur"));
  await m.el.updateComplete;
  assertEquals(m.changes, ["/my/own/icon.tga"]);
});

Deno.test("icon picker: blurring without a change emits nothing", async () => {
  const m = await mount({ value: "/gui/icons/arrow.tga" });
  await focus(m);
  input(m).dispatchEvent(new Event("blur"));
  await m.el.updateComplete;
  assertEquals(m.changes, []);
});

Deno.test("icon picker: a thumbnail that fails to load shows the tile", async () => {
  const m = await mount({ value: "/gui/icons/arrow.tga" });
  const img = m.root.querySelector(".preview img")!;
  img.dispatchEvent(new Event("error"));
  await m.el.updateComplete;
  assertEquals(m.root.querySelector(".preview img"), null);
  assert(m.root.querySelector(".preview .tile"));
});

Deno.test("icon picker: a failed search says what failed and why", async () => {
  const m = await mount({ fail: true });
  await focus(m);
  const message = m.root.querySelector("li.error")!.textContent!;
  assert(message.includes("Could not list images."));
  assert(message.includes("The server is not running."));
});

/**
 * Mounts a picker in a scrolling pane with fixed geometry, since happy-dom
 * has no layout. `pane` is the visible area, `box` is the field.
 */
async function mountInPane(
  pane: { top: number; bottom: number },
  box: { top: number; bottom: number },
) {
  const scroller = document.createElement("div");
  scroller.style.overflowY = "auto";
  const rect = (r: { top: number; bottom: number }) => () => ({
    ...r,
    left: 0,
    right: 200,
    width: 200,
    height: r.bottom - r.top,
  });
  scroller.getBoundingClientRect = rect(pane) as never;
  document.body.append(scroller);
  const m = await mount();
  scroller.append(m.el);
  await m.el.updateComplete;
  const boxEl = m.root.querySelector(".box")!;
  const place = { current: box };
  boxEl.getBoundingClientRect = (() => rect(place.current)()) as never;
  return { ...m, scroller, place };
}

const listbox = (m: Mounted) =>
  m.root.querySelector<HTMLElement>("ul[role=listbox]")!;
const listHeight = (m: Mounted) =>
  Number(
    /max-block-size:\s*(\d+)px/.exec(listbox(m).getAttribute("style")!)![1],
  );

Deno.test("icon picker: with room below the list opens down at full height", async () => {
  const m = await mountInPane({ top: 0, bottom: 800 }, {
    top: 100,
    bottom: 130,
  });
  await focus(m);
  assert(!listbox(m).classList.contains("up"));
  assertEquals(listHeight(m), 288);
});

Deno.test("icon picker: near the bottom of the pane the list opens upward", async () => {
  const m = await mountInPane({ top: 0, bottom: 300 }, {
    top: 240,
    bottom: 270,
  });
  await focus(m);
  assert(listbox(m).classList.contains("up"));
  assert(listHeight(m) <= 240 - 4, "stays below the top edge of the pane");
});

Deno.test("icon picker: the list never extends past the pane's bottom edge", async () => {
  const pane = { top: 0, bottom: 360 };
  for (const top of [20, 100, 200, 280, 330]) {
    const box = { top, bottom: top + 30 };
    const m = await mountInPane(pane, box);
    await focus(m);
    const height = listHeight(m);
    const up = listbox(m).classList.contains("up");
    if (up) {
      assert(box.top - 4 - height >= pane.top, `top edge, field at ${top}`);
    } else {
      assert(
        box.bottom + 4 + height <= pane.bottom,
        `bottom edge, field at ${top}`,
      );
    }
  }
});

Deno.test("icon picker: an upward list stays below the pane's pinned heading", async () => {
  const m = await mountInPane(
    { top: 0, bottom: 400 },
    { top: 300, bottom: 330 },
  );
  const heading = document.createElement("h2");
  heading.style.position = "sticky";
  heading.getBoundingClientRect = (() => ({
    top: 0,
    bottom: 40,
    left: 0,
    right: 200,
    width: 200,
    height: 40,
  })) as never;
  m.scroller.prepend(heading);
  await focus(m);
  assert(listbox(m).classList.contains("up"));
  // 300 (field top) - 40 (heading bottom) - 4 (gap) - 8 (edge) = 248.
  assertEquals(listHeight(m), 248);
});

Deno.test("icon picker: the height cap is the outer height, border and padding included", () => {
  const css = CeIconPicker.styles.flat().map((s) =>
    (s as { cssText?: string }).cssText ?? ""
  ).join("\n");
  const rule = /ul\[role="listbox"\]\s*\{[^}]*\}/.exec(css)![0];
  assert(rule.includes("box-sizing: border-box"), rule);
});

Deno.test("icon picker: scrolling the pane moves an open list to stay inside", async () => {
  const m = await mountInPane({ top: 0, bottom: 400 }, {
    top: 100,
    bottom: 130,
  });
  await focus(m);
  assert(!listbox(m).classList.contains("up"));
  // The pane scrolls and the field ends up at the pane's bottom edge.
  m.place.current = { top: 360, bottom: 390 };
  m.scroller.dispatchEvent(new Event("scroll"));
  await m.el.updateComplete;
  assert(listbox(m).classList.contains("up"));
  assert(listHeight(m) <= 360 - 4);
});

const FOLDERS: Record<string, string[]> = {
  "/gui/": ["/gui/builtin/", "/gui/menu/"],
  "/gui/builtin/": ["/gui/builtin/combobox/"],
};
const foldersFor = (q: string) => FOLDERS[q] ?? [];

const tab = (m: Mounted) => {
  const event = new KeyboardEvent("keydown", {
    key: "Tab",
    bubbles: true,
    cancelable: true,
  });
  input(m).dispatchEvent(event);
  return event;
};

Deno.test("icon picker: no folders are offered until a slash is typed", async () => {
  const m = await mount({ foldersFor });
  await focus(m);
  await type(m, "arrow");
  assertEquals(m.root.querySelectorAll("li.folder").length, 0);
});

Deno.test("icon picker: typing a slash lists folders above the images", async () => {
  const m = await mount({ foldersFor });
  await focus(m);
  await type(m, "/gui/");
  const names = rows(m).map((r) => r.querySelector(".name")!.textContent);
  assertEquals(names.slice(0, 2), ["builtin/", "menu/"]);
  assertEquals(
    rows(m)[0].querySelector(".path")!.textContent,
    "/gui/builtin/",
  );
  assert(rows(m)[0].querySelector(".tile"), "a folder shows a tile");
  assertEquals(rows(m)[0].querySelector("img"), null);
});

Deno.test("icon picker: Tab completes the active folder and lists inside it", async () => {
  const m = await mount({ foldersFor });
  await focus(m);
  await type(m, "/gui/");
  const event = tab(m);
  await settle(m);
  assert(event.defaultPrevented, "Tab stays in the field");
  assertEquals(m.el.text, "/gui/builtin/");
  assert(m.requests.at(-1)!.includes("q=%2Fgui%2Fbuiltin%2F"));
  assertEquals(m.changes, [], "a folder is not a value");
  assertEquals(
    rows(m)[0].querySelector(".name")!.textContent,
    "combobox/",
  );
});

Deno.test("icon picker: arrow keys pick which folder Tab completes", async () => {
  const m = await mount({ foldersFor });
  await focus(m);
  await type(m, "/gui/");
  key(m, "ArrowDown");
  await m.el.updateComplete;
  tab(m);
  await settle(m);
  assertEquals(m.el.text, "/gui/menu/");
});

Deno.test("icon picker: Tab on an image row leaves the field as usual", async () => {
  const m = await mount({ foldersFor });
  await focus(m);
  await type(m, "arrow");
  const event = tab(m);
  assert(!event.defaultPrevented);
});

Deno.test("icon picker: Enter on a folder completes it and does not commit", async () => {
  const m = await mount({ foldersFor });
  await focus(m);
  await type(m, "/gui/");
  key(m, "Enter");
  await settle(m);
  assertEquals(m.el.text, "/gui/builtin/");
  assertEquals(m.changes, []);
  assert(m.root.querySelector("ul[role=listbox]"), "the list stays open");
});

Deno.test("icon picker: clicking a folder completes it", async () => {
  const m = await mount({ foldersFor });
  await focus(m);
  await type(m, "/gui/");
  (rows(m)[1] as HTMLElement).click();
  await settle(m);
  assertEquals(m.el.text, "/gui/menu/");
  assertEquals(m.changes, []);
});

Deno.test("icon picker: arrow keys continue from the folders into the images", async () => {
  const m = await mount({ foldersFor });
  await focus(m);
  await type(m, "/gui/");
  // Two folders, so the third press lands on the first image.
  for (let i = 0; i < 2; i++) {
    key(m, "ArrowDown");
    await m.el.updateComplete;
  }
  key(m, "Enter");
  await settle(m);
  assertEquals(m.changes.length, 1);
  assert(m.changes[0].startsWith("/"), m.changes[0]);
});

const problem = (m: Mounted) =>
  m.root.querySelector(".problem")?.textContent?.trim() ?? null;

Deno.test("icon picker: a value that is not an indexed image shows an error", async () => {
  const m = await mount({ value: "/gui/icons/missing.tga" });
  await settle(m);
  assert(problem(m)!.includes("/gui/icons/missing.tga"));
  assert(problem(m)!.includes("not an image"));
  assertEquals(
    input(m).getAttribute("aria-invalid"),
    "true",
  );
});

Deno.test("icon picker: an indexed image shows no error", async () => {
  const m = await mount({ value: "/gui/icons/arrow.tga" });
  await settle(m);
  assertEquals(problem(m), null);
});

Deno.test("icon picker: an empty field shows no error", async () => {
  const m = await mount({ value: "" });
  await settle(m);
  assertEquals(problem(m), null);
});

Deno.test("icon picker: no error while the user is typing a path", async () => {
  const m = await mount({ value: "/gui/icons/arrow.tga", foldersFor });
  await settle(m);
  await focus(m);
  await type(m, "/gui/");
  assertEquals(problem(m), null);
  tab(m);
  await settle(m);
  assertEquals(m.el.text, "/gui/builtin/");
  assertEquals(problem(m), null, "still completing a folder");
});

Deno.test("icon picker: blurring in the middle of a folder shows the error", async () => {
  const m = await mount({ foldersFor });
  await focus(m);
  await type(m, "/gui/");
  tab(m);
  await settle(m);
  input(m).dispatchEvent(new Event("blur"));
  await settle(m);
  await settle(m);
  assertEquals(m.changes, ["/gui/builtin/"]);
  assert(problem(m)!.includes("/gui/builtin/"));
  assert(problem(m)!.includes("is a folder, not an image"));
});

Deno.test("icon picker: picking an image clears the error", async () => {
  const m = await mount({ value: "/gui/icons/missing.tga" });
  await settle(m);
  assert(problem(m));
  m.el.value = "/gui/icons/arrow.tga";
  await settle(m);
  await settle(m);
  assertEquals(problem(m), null);
});

Deno.test("icon picker: no error when the game has no indexed images", async () => {
  const m = await mount({ value: "/anything.tga", total: 0 });
  await settle(m);
  assertEquals(problem(m), null);
});

Deno.test("icon picker: clearing the text commits an empty value", async () => {
  const m = await mount({ value: "/gui/icons/arrow.tga" });
  await focus(m);
  await type(m, "");
  input(m).dispatchEvent(new Event("blur"));
  await m.el.updateComplete;
  assertEquals(m.changes, [""]);
});
