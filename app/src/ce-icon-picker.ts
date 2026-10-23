import { css, html, LitElement } from "lit";
import { missingImageMessage } from "@cedit/schema";
import { api, gtexImageUrl, imageUrl } from "./api.ts";
import { folderIcon, imageIcon } from "./icons.ts";
import { basename, extname } from "@std/path/posix";
import {
  clipRect,
  placeList,
  type Placement,
  scrollParent,
} from "./popover-placement.ts";
import { sharedStyles } from "./styles.ts";

export type PickerKind = "image" | "gtex" | "street" | "track" | "edge-object";

/** What each kind of list holds, in the words of its messages. */
const NOUNS: Record<PickerKind, string> = {
  image: "images",
  gtex: "ground textures",
  street: "street types",
  track: "track types",
  "edge-object": "edge objects",
};

/** The kinds whose rows show a thumbnail. */
const PREVIEWED: ReadonlySet<PickerKind> = new Set(["image", "gtex"]);

const ROW_LIMIT = 50;
/** The tallest the list gets: 18rem at the default 16px root size. */
const LIST_HEIGHT = 288;
/** Gap between the list and the pane's side edges, in pixels. */
const PANE_EDGE = 8;

/**
 * Text field for an image path with a preview of the current value and a
 * type-ahead list of the game's images, each with a thumbnail. Any typed text
 * is a valid value. Fires `change` with `{ value }` on a pick or on blur.
 */
export class CeIconPicker extends LitElement {
  static override properties = {
    label: { type: String },
    value: { type: String },
    dir: { type: String },
    kind: { type: String },
    autoOpen: { type: Boolean },
    open: { state: true },
    text: { state: true },
    results: { state: true },
    folders: { state: true },
    active: { state: true },
    broken: { state: true },
    frame: { state: true },
    failed: { state: true },
    problem: { state: true },
    placement: { state: true },
  };
  static override styles = [
    sharedStyles,
    css`
      :host {
        display: block;
      }
      /* The box is a span inside the label, so the field label style (small
        and muted) reaches it. Reset to the app's body text. */
      .field > .box {
        /* The glyph keeps its full size. The field grows around it so the
          glyph sits the same distance from the top, bottom, and start edges. */
        --glyph: 24px;
        --edge: 4px;
        color: var(--ce-text);
        font-size: 13px;
        position: relative;
      }
      /* The 1px border is part of the box, so the offset is the edge plus the
        border, and the field height is the glyph plus two edges and two
        borders. */
      .preview {
        align-items: center;
        block-size: var(--glyph);
        color: var(--ce-muted);
        display: inline-grid;
        inline-size: var(--glyph);
        inset-block-start: calc(var(--edge) + 1px);
        inset-inline-start: calc(var(--edge) + 1px);
        justify-items: center;
        position: absolute;
      }
      img,
      .tile {
        block-size: 100%;
        inline-size: 100%;
        object-fit: contain;
      }
      .tile {
        align-items: center;
        background: var(--ce-surface-2);
        border-radius: 3px;
        color: var(--ce-muted);
        display: inline-grid;
        justify-items: center;
      }
      input {
        block-size: calc(var(--glyph) + 2 * var(--edge) + 2px);
        box-sizing: border-box;
        inline-size: 100%;
        padding-inline-start: calc(var(--edge) + var(--glyph) + 5px);
      }
      ul[role="listbox"] {
        background: var(--ce-surface);
        border: 1px solid var(--ce-border);
        border-radius: 6px;
        box-shadow: 0 6px 18px rgb(0 0 0 / 0.25);
        /* The height cap is the list's whole outer height, border and padding
          included, so it cannot grow past the room it was given. */
        box-sizing: border-box;
        list-style: none;
        margin: 0;
        max-block-size: 18rem;
        overflow: auto;
        padding: 0.25rem;
        /* Fixed, so the list spans the pane instead of the narrow input. The
          inline style sets the edges from the pane's visible box. */
        position: fixed;
        z-index: 10;
      }
      li[role="option"] {
        align-items: center;
        border-radius: 4px;
        cursor: pointer;
        display: grid;
        gap: 0.5rem;
        grid-template-columns: 40px minmax(0, 1fr);
        padding: 0.25rem;
      }
      li[role="option"].active {
        background: var(--ce-selected);
      }
      li .thumb {
        block-size: 40px;
        inline-size: 40px;
      }
      li .text {
        display: grid;
        min-inline-size: 0;
      }
      li .name,
      li .path {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      /* The label's field span rule mutes everything inside the box. */
      li .name {
        color: var(--ce-text);
      }
      li .path {
        color: var(--ce-muted);
        font-size: 11px;
      }
      /* A span child of the label, so it needs the label rule's weight. */
      .field > .problem {
        color: var(--ce-error);
        font-size: 11px;
        overflow-wrap: anywhere;
      }
      li.none {
        color: var(--ce-muted);
        cursor: default;
        display: block;
        padding: 0.4rem 0.5rem;
      }
      li.error {
        color: var(--ce-error);
        cursor: default;
        display: block;
        padding: 0.4rem 0.5rem;
      }
    `,
  ];

  declare label: string;
  declare value: string;
  declare dir: string;
  /**
   * `image` lists the game's images. `gtex` lists its ground textures.
   * `street`, `track`, and `edge-object` list those types and have no preview.
   */
  declare kind: PickerKind;
  /** Focuses the field when it first renders, which opens the list. */
  declare autoOpen: boolean;
  declare open: boolean;
  declare text: string;
  declare results: { id: string }[];
  /** Folders that complete the typed path. They sit above the images. */
  declare folders: string[];
  declare active: number;
  /** Ids whose thumbnail failed to load, so they show the tile. */
  declare broken: Set<string>;
  declare failed: string;
  /** Why the committed value is not an indexed image. Empty means it is. */
  declare problem: string;
  /** Which side of the field the list opens on, and its tallest height. */
  declare placement: Placement;

  /** Fixed-position edges of the list, in viewport pixels. */
  declare frame: { left: number; width: number; edge: number };

  #sequence = 0;
  #checked = 0;
  #committed = false;

  constructor() {
    super();
    this.label = "";
    this.value = "";
    this.dir = "";
    this.kind = "image";
    this.autoOpen = false;
    this.open = false;
    this.text = "";
    this.results = [];
    this.folders = [];
    this.active = -1;
    this.broken = new Set();
    this.failed = "";
    this.problem = "";
    this.placement = { up: false, maxHeight: LIST_HEIGHT };
    this.frame = { left: 0, width: 0, edge: 0 };
  }

  /** What the list holds, in the words of its messages. */
  get #noun(): string {
    return NOUNS[this.kind];
  }

  /** The list of the picker's kind, as `{ total, entries }`. */
  async #fetchList(
    query: string,
    limit: number,
  ): Promise<{ total: number; entries: { id: string }[]; folders?: string[] }> {
    switch (this.kind) {
      case "gtex":
        return await api.gtex(this.dir, query, limit);
      case "street":
        return await api.edgeTypes(this.dir, "STREET", query, limit);
      case "track":
        return await api.edgeTypes(this.dir, "TRACK", query, limit);
      case "edge-object":
        return await api.edgeObjects(this.dir, query, limit);
      default:
        return await api.images(this.dir, query, limit);
    }
  }

  async #search(query: string) {
    const ticket = ++this.#sequence;
    try {
      const found = await this.#fetchList(query, ROW_LIMIT);
      if (ticket !== this.#sequence) return;
      this.results = found.entries;
      this.folders = found.folders ?? [];
      this.failed = "";
      this.active = this.folders.length + found.entries.length > 0 ? 0 : -1;
    } catch (error) {
      if (ticket !== this.#sequence) return;
      this.results = [];
      this.folders = [];
      this.active = -1;
      this.failed = `Could not list ${this.#noun}. ${(error as Error).message}`;
    }
  }

  #emit(value: string) {
    this.dispatchEvent(
      new CustomEvent("change", {
        detail: { value },
        bubbles: true,
        composed: true,
      }),
    );
  }

  #show(id: string, size: number) {
    if (id === "" || this.broken.has(id) || !PREVIEWED.has(this.kind)) {
      return html`<span class="tile" aria-hidden="true">${
        imageIcon(
          size > 30 ? 20 : 14,
        )
      }</span>`;
    }
    return html`
      <img
        alt=""
        loading="lazy"
        width=${size}
        height=${size}
        src=${this.kind === "gtex"
          ? gtexImageUrl(this.dir, id, size * 2)
          : imageUrl(this.dir, id, size * 2)}
        @error=${() => {
          this.broken = new Set(this.broken).add(id);
        }}
      />
    `;
  }

  #openList() {
    if (this.open) return;
    this.open = true;
    this.#committed = false;
    void this.#search(this.text);
  }

  /** Completes the text to a folder and lists what is inside it. */
  #drill(folder: string) {
    this.text = folder;
    this.#committed = false;
    this.open = true;
    void this.#search(folder);
  }

  #pick(id: string) {
    this.#committed = true;
    this.open = false;
    this.text = id;
    if (id !== this.value) this.#emit(id);
  }

  #close(commitText: boolean) {
    if (!this.open && !commitText) return;
    this.open = false;
    if (commitText && !this.#committed) {
      this.#committed = true;
      const next = this.text.trim();
      if (next !== this.value) this.#emit(next);
      this.text = next;
    }
  }

  #key(event: KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!this.open) return this.#openList();
      const last = this.folders.length + this.results.length - 1;
      if (last < 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      this.active = Math.min(last, Math.max(0, this.active + step));
      this.renderRoot.querySelector(".active")?.scrollIntoView?.({
        block: "nearest",
      });
    } else if (event.key === "Tab") {
      // Tab completes a suggested folder. On an image it leaves the field.
      const folder = this.open ? this.folders[this.active] : undefined;
      if (folder !== undefined) {
        event.preventDefault();
        this.#drill(folder);
      }
    } else if (event.key === "Enter") {
      event.preventDefault();
      const folder = this.open ? this.folders[this.active] : undefined;
      const row = this.open
        ? this.results[this.active - this.folders.length]
        : undefined;
      if (folder !== undefined) this.#drill(folder);
      else if (row) this.#pick(row.id);
      else this.#close(true);
    } else if (event.key === "Escape" && this.open) {
      event.preventDefault();
      this.#committed = true;
      this.open = false;
      this.text = this.value;
    }
  }

  protected override willUpdate(changed: Map<string, unknown>) {
    if (changed.has("value") && !this.open) this.text = this.value;
    if ((changed.has("value") || changed.has("dir")) && this.dir !== "") {
      void this.#validate(this.value);
    }
  }

  /**
   * Checks the committed value against the image index. A value that is not an
   * indexed image sets `problem`. An empty value, an unreadable index, and an
   * index with no images (the game is not set up) never raise one.
   */
  async #validate(value: string) {
    const ticket = ++this.#checked;
    const id = value.trim();
    if (id === "") {
      this.problem = "";
      return;
    }
    try {
      if (this.kind !== "image") {
        const found = await this.#fetchList(id, 5);
        if (ticket !== this.#checked) return;
        const exact = found.entries.some((e) =>
          e.id.toLowerCase() === id.toLowerCase()
        );
        // An index with no entry of this kind means the game is not set up.
        this.problem = found.total === 0 || exact
          ? ""
          : `${id} is not in the ${this.#noun} of the game, this mod, or its dependencies. Pick one from the list.`;
        return;
      }
      const found = await api.images(this.dir, id, 1);
      if (ticket !== this.#checked) return;
      // A server that predates `exact` cannot tell, so it raises no error.
      this.problem = found.total === 0 || found.exact !== false
        ? ""
        : missingImageMessage(id);
    } catch {
      if (ticket === this.#checked) this.problem = "";
    }
  }

  /**
   * Keeps the list inside the scrolling pane: its far edge never goes past the
   * pane's visible edge, so it opens upward or shrinks when the room is short.
   */
  #place = () => {
    const box = this.renderRoot.querySelector(".box");
    if (!box) return;
    const anchor = box.getBoundingClientRect();
    const next = placeList(anchor, clipRect(box), LIST_HEIGHT);
    // The list fills the scrolling pane's width, not the input's.
    const pane = scrollParent(box)?.getBoundingClientRect();
    const left = Math.round((pane?.left ?? anchor.left) + PANE_EDGE);
    const width = Math.max(
      0,
      Math.round((pane?.width ?? anchor.width) - 2 * PANE_EDGE),
    );
    const edge = next.up
      ? Math.round(globalThis.innerHeight - anchor.top + 4)
      : Math.round(anchor.bottom + 4);
    const old = this.placement;
    if (
      next.up !== old.up || next.maxHeight !== old.maxHeight ||
      left !== this.frame.left || width !== this.frame.width ||
      edge !== this.frame.edge
    ) {
      this.placement = next;
      this.frame = { left, width, edge };
    }
  };

  #unwatch: (() => void) | null = null;

  #watch() {
    if (this.#unwatch) return;
    const box = this.renderRoot.querySelector(".box");
    const parent = box ? scrollParent(box) : null;
    parent?.addEventListener("scroll", this.#place, { passive: true });
    globalThis.addEventListener("resize", this.#place);
    this.#unwatch = () => {
      parent?.removeEventListener("scroll", this.#place);
      globalThis.removeEventListener("resize", this.#place);
      this.#unwatch = null;
    };
  }

  protected override updated(changed: Map<string, unknown>) {
    if (changed.has("autoOpen") && this.autoOpen) {
      // Focusing the field opens the list. The owner learns the request is met.
      this.renderRoot.querySelector("input")?.focus();
      this.dispatchEvent(
        new CustomEvent("opened", { bubbles: true, composed: true }),
      );
    }
    if (!changed.has("open")) return;
    if (this.open) {
      this.#place();
      this.#watch();
    } else {
      this.#unwatch?.();
    }
  }

  override disconnectedCallback() {
    this.#unwatch?.();
    super.disconnectedCallback();
  }

  override render() {
    const shown = this.open
      ? this.text
      : basename(this.value, extname(this.value));
    return html`
      <label class="field">
        <span>${this.label}</span>
        <span class="box">
          <span class="preview">${this.#show(this.value, 24)}</span>
          <input
            role="combobox"
            aria-expanded=${this.open ? "true" : "false"}
            aria-controls="list"
            aria-autocomplete="list"
            aria-invalid=${!this.open && this.problem ? "true" : "false"}
            aria-describedby=${!this.open && this.problem ? "problem" : ""}
            autocomplete="off"
            spellcheck="false"
            placeholder=${`Search ${this.#noun}`}
            .value=${shown}
            @focus=${() => this.#openList()}
            @input=${(e: Event) => {
              this.text = (e.target as HTMLInputElement).value;
              this.#committed = false;
              if (!this.open) this.open = true;
              void this.#search(this.text);
            }}
            @keydown=${(e: KeyboardEvent) => this.#key(e)}
            @blur=${() => this.#close(true)}
          />
          ${this.open ? this.#list() : null}
        </span>
        ${!this.open && this.problem
          ? html`<span class="problem" id="problem" role="alert">${this.problem}</span>`
          : null}
      </label>
    `;
  }

  /** One suggestion: a thumbnail or folder tile, the name, and the full path. */
  #row(
    index: number,
    id: string,
    thumb: unknown,
    name: string,
    onPick: () => void,
    selected: boolean,
  ) {
    return html`
      <li
        role="option"
        aria-selected=${selected ? "true" : "false"}
        class=${[
          index === this.active ? "active" : "",
          id.endsWith("/") ? "folder" : "",
        ].filter(Boolean).join(" ")}
        title=${id}
        @mousedown=${(e: Event) => e.preventDefault()}
        @click=${onPick}
        @mousemove=${() => (this.active = index)}
      >
        <span class="thumb">${thumb}</span>
        <span class="text">
          <span class="name">${name}</span>
          <span class="path">${id}</span>
        </span>
      </li>
    `;
  }

  #list() {
    const folders = this.folders.map((folder, i) =>
      this.#row(
        i,
        folder,
        html`<span class="tile" aria-hidden="true">${folderIcon(20)}</span>`,
        `${basename(folder)}/`,
        () => this.#drill(folder),
        false,
      )
    );
    const images = this.results.map((row, i) =>
      this.#row(
        this.folders.length + i,
        row.id,
        this.#show(row.id, 40),
        this.kind === "image"
          ? basename(row.id)
          : basename(row.id, extname(row.id)),
        () => this.#pick(row.id),
        row.id === this.value,
      )
    );
    const empty = this.folders.length + this.results.length === 0;
    return html`
      <ul
        id="list"
        role="listbox"
        aria-label=${this.label}
        class=${this.placement.up ? "up" : ""}
        style=${[
          `max-block-size: ${this.placement.maxHeight}px`,
          `inset-inline-start: ${this.frame.left}px`,
          `inline-size: ${this.frame.width}px`,
          this.placement.up
            ? `inset-block-end: ${this.frame.edge}px`
            : `inset-block-start: ${this.frame.edge}px`,
        ].join("; ")}
      >
        ${this.failed
          ? html`<li class="error">${this.failed}</li>`
          : empty
          ? html`<li class="none">No ${this.#noun} match.</li>`
          : [...folders, ...images]}
      </ul>
    `;
  }
}

customElements.define("ce-icon-picker", CeIconPicker);
