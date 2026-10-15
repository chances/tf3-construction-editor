import { css, html, LitElement } from "lit";
import { proposeConstruction } from "@cedit/schema";
import { chevronDownIcon, plusIcon, trashIcon } from "./icons.ts";
import { observer } from "./observer.ts";
import { store } from "./state.ts";
import { sharedStyles } from "./styles.ts";

/** One row of the dropdown: an existing construction, or the one to create. */
type Option = { kind: "existing" | "new"; id: string; name: string };

/**
 * The current construction in the breadcrumb. It reads as a label with a
 * dropdown arrow, shows an outline on focus, and turns into a typeahead list of
 * the mod's constructions when activated.
 */
export class CeConstructionSwitcher extends observer(LitElement) {
  static override properties = {
    open: { state: true },
    query: { state: true },
    active: { state: true },
  };
  static override styles = [
    sharedStyles,
    css`
      :host {
        display: inline-grid;
        max-inline-size: 60vw;
        min-inline-size: 0;
        position: relative;
      }
      button.label {
        align-items: center;
        background: transparent;
        border: 1px solid transparent;
        border-radius: 4px;
        display: inline-flex;
        font-weight: 600;
        gap: 0.25rem;
        max-inline-size: 100%;
        padding-block: 0.2rem;
        padding-inline: 0.4rem;
      }
      button.label .text {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      button.label .chevron {
        display: inline-grid;
      }
      button.label:focus-visible {
        border-color: var(--ce-border);
      }
      /* Sizes the input to the widest name; takes no height of its own. */
      .sizer {
        block-size: 0;
        font-weight: 600;
        grid-area: 1 / 1;
        overflow: hidden;
        padding-inline: 0.75rem;
        visibility: hidden;
        white-space: nowrap;
      }
      .sizer span {
        display: block;
      }
      /* Room for the row's delete button and the new row's plus icon. */
      .sizer span.existing {
        padding-inline-end: 2.2rem;
      }
      .sizer span.new {
        padding-inline-start: 1.5rem;
      }
      input {
        box-sizing: border-box;
        font-weight: 600;
        grid-area: 1 / 1;
        inline-size: 100%;
        min-inline-size: 8rem;
      }
      li .name,
      li.new .new-label {
        white-space: nowrap;
      }
      ul[role="listbox"] {
        background: var(--ce-surface);
        border: 1px solid var(--ce-border);
        border-radius: 6px;
        box-shadow: 0 6px 18px rgb(0 0 0 / 0.25);
        box-sizing: border-box;
        inline-size: 100%;
        inset-block-start: calc(100% + 0.25rem);
        inset-inline-start: 0;
        list-style: none;
        margin: 0;
        max-block-size: 16rem;
        min-inline-size: 8rem;
        overflow: auto;
        padding: 0.25rem;
        position: absolute;
        z-index: 10;
      }
      li[role="option"] {
        align-items: center;
        border-radius: 4px;
        cursor: pointer;
        display: grid;
        gap: 0.5rem;
        grid-template-columns: minmax(0, 1fr) auto;
        padding-block: 0.3rem;
        padding-inline: 0.5rem;
      }
      li .body {
        display: grid;
        min-inline-size: 0;
      }
      button.row-delete {
        background: transparent;
        border: 1px solid transparent;
        color: var(--ce-muted);
        display: inline-grid;
        padding: 0.2rem;
        place-items: center;
      }
      button.row-delete:hover {
        border-color: var(--ce-error);
        color: var(--ce-error);
      }
      li[role="option"][aria-selected="true"] {
        font-weight: 600;
      }
      li[role="option"].active {
        background: var(--ce-selected);
      }
      li .id {
        color: var(--ce-muted);
        font-size: 11px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      li.new .new-label {
        align-items: center;
        color: var(--ce-accent);
        display: inline-flex;
        gap: 0.35rem;
      }
      li.none {
        color: var(--ce-muted);
        cursor: default;
        padding: 0.4rem 0.5rem;
      }
    `,
  ];

  declare open: boolean;
  declare query: string;
  declare active: number;

  constructor() {
    super();
    this.open = false;
    this.query = "";
    this.active = 0;
  }

  /** Constructions that match the typed text, current one named from the doc. */
  get #matches() {
    return this.#matchesFor(this.query);
  }

  #matchesFor(query: string) {
    const items = (store.loaded?.constructions ?? []).map((c) => ({
      id: c.id,
      name: c.id === store.doc?.id
        ? store.doc.description.name || c.name
        : c.name,
    }));
    const q = query.trim().toLowerCase();
    return q === ""
      ? items
      : items.filter((c) =>
        c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
      );
  }

  /**
   * A new construction proposed from the typed text, or null when the text is
   * empty, cannot make a file name, or already names a construction.
   */
  get #draft(): { id: string; name: string } | null {
    return proposeConstruction(
      this.query,
      store.loaded?.constructions ?? [],
    );
  }

  /** The list rows: the new-construction row first, then the matches. */
  get #options(): Option[] {
    const draft = this.#draft;
    const rows: Option[] = this.#matches.map((c) => ({
      kind: "existing",
      ...c,
    }));
    return draft ? [{ kind: "new", ...draft }, ...rows] : rows;
  }

  override render() {
    const name = store.doc?.description.name ?? "";
    if (!this.open) {
      return html`
        <button
          class="label"
          type="button"
          aria-haspopup="listbox"
          aria-expanded="false"
          title="Switch Construction"
          @click=${this.#open}
          @keydown=${this.#labelKey}
        >
          <span class="text">${name}</span>
          <span class="chevron">${chevronDownIcon(14)}</span>
        </button>
      `;
    }
    const options = this.#options;
    const active = Math.min(this.active, Math.max(0, options.length - 1));
    return html`
      <div class="sizer" aria-hidden="true">
        <span class="new">New Construction</span>
        ${this.#matchesFor("").map((c) =>
          html`<span class="existing">${c.name}</span>`
        )}
      </div>
      <input
        type="text"
        role="combobox"
        aria-label="Switch Construction"
        aria-expanded="true"
        aria-controls="constructions"
        aria-autocomplete="list"
        aria-activedescendant=${options.length > 0 ? `opt-${active}` : ""}
        placeholder=${name}
        .value=${this.query}
        @input=${this.#input}
        @keydown=${this.#inputKey}
        @focusout=${this.#focusOut}
      />
      <ul id="constructions" role="listbox" aria-label="Constructions">
        ${options.length === 0
          ? html`<li class="none">No constructions yet.</li>`
          : options.map(
            (o, i) =>
              html`
                <li
                  id=${`opt-${i}`}
                  role="option"
                  class=${`${i === active ? "active" : ""} ${o.kind}`}
                  aria-selected=${String(
                    o.kind === "existing" && o.id === store.doc?.id,
                  )}
                  @pointerdown=${(e: Event) => e.preventDefault()}
                  @pointerenter=${() => (this.active = i)}
                  @click=${() => this.#pick(o)}
                >
                  ${o.kind === "new"
                    ? html`
                      <span class="body">
                        <span class="new-label">
                          ${plusIcon(14)} <strong>New Construction</strong>
                        </span>
                        <span class="id">${o.name} (${o.id})</span>
                      </span>
                    `
                    : html`
                      <span class="body">
                        <span class="name">${o.name}</span>
                        <span class="id">${o.id}</span>
                      </span>
                      <button
                        type="button"
                        class="row-delete"
                        tabindex="-1"
                        aria-label=${`Delete the construction ${o.name} after you confirm`}
                        title=${`Delete ${o.name}`}
                        @pointerdown=${(e: Event) => e.stopPropagation()}
                        @click=${(e: Event) => {
                          e.stopPropagation();
                          this.#delete(o);
                        }}
                      >${trashIcon(14)}</button>
                    `}
                </li>
              `,
          )}
      </ul>
    `;
  }

  async #open() {
    this.query = "";
    this.active = 0;
    this.open = true;
    await this.updateComplete;
    this.renderRoot.querySelector<HTMLInputElement>("input")?.focus();
  }

  async #close(refocus = false) {
    this.open = false;
    this.query = "";
    if (refocus) {
      await this.updateComplete;
      this.renderRoot.querySelector<HTMLButtonElement>("button.label")?.focus();
    }
  }

  #labelKey(event: KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      void this.#open();
    }
  }

  #input(event: Event) {
    this.query = (event.target as HTMLInputElement).value;
    this.active = 0;
  }

  #inputKey(event: KeyboardEvent) {
    const options = this.#options;
    const count = options.length;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      this.active = count === 0 ? 0 : (this.active + 1) % count;
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      this.active = count === 0 ? 0 : (this.active - 1 + count) % count;
    } else if (event.key === "Home") {
      event.preventDefault();
      this.active = 0;
    } else if (event.key === "End") {
      event.preventDefault();
      this.active = Math.max(0, count - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const row = options[Math.min(this.active, count - 1)];
      if (row) this.#pick(row);
    } else if (event.key === "Escape") {
      event.preventDefault();
      void this.#close(true);
    }
  }

  #focusOut(event: FocusEvent) {
    const next = event.relatedTarget as Node | null;
    if (!next || !this.renderRoot.contains(next)) void this.#close();
  }

  #delete(option: Option) {
    void this.#close(true);
    store.requestDelete(option.id);
  }

  #pick(option: Option) {
    const current = store.doc?.id;
    void this.#close(true);
    if (option.kind === "new") {
      void store.createConstruction(option.id, option.name);
    } else if (option.id !== current) {
      void store.openConstruction(option.id);
    }
  }
}

customElements.define("ce-construction-switcher", CeConstructionSwitcher);
