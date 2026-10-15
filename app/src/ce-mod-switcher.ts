import { css, html, LitElement } from "lit";
import { chevronDownIcon } from "./icons.ts";
import { observer } from "./observer.ts";
import { store } from "./state.ts";
import { sharedStyles } from "./styles.ts";

/**
 * The mod in the breadcrumb. It reads as a label with a dropdown arrow, shows
 * an outline on focus, and turns into a typeahead list of mods when activated.
 */
export class CeModSwitcher extends observer(LitElement) {
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
        grid-area: 1 / 1;
        overflow: hidden;
        font-weight: 600;
        padding-inline: 0.75rem;
        visibility: hidden;
        white-space: nowrap;
      }
      .sizer span {
        display: block;
      }
      input {
        box-sizing: border-box;
        grid-area: 1 / 1;
        inline-size: 100%;
        min-inline-size: 8rem;
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
      li .name {
        white-space: nowrap;
      }
      li[role="option"] {
        border-radius: 4px;
        cursor: pointer;
        display: grid;
        padding-block: 0.3rem;
        padding-inline: 0.5rem;
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

  /** The display name of a mod, taken from the open mod when it is the one. */
  #nameOf(m: { dirName: string; name?: string }): string {
    return m.dirName === store.loaded?.dirName
      ? store.loaded.modInfo.name || m.name || m.dirName
      : m.name || m.dirName;
  }

  /** Mods that match the typed text. */
  get #matches() {
    const items = store.mods.map((m) => ({
      dirName: m.dirName,
      name: this.#nameOf(m),
    }));
    const q = this.query.trim().toLowerCase();
    return q === ""
      ? items
      : items.filter((m) =>
        m.name.toLowerCase().includes(q) || m.dirName.toLowerCase().includes(q)
      );
  }

  override render() {
    const name = store.loaded?.modInfo.name ?? "";
    if (!this.open) {
      return html`
        <button
          class="label"
          type="button"
          aria-haspopup="listbox"
          aria-expanded="false"
          title="Switch Mod"
          @click=${this.#open}
          @keydown=${this.#labelKey}
        >
          <span class="text">${name}</span>
          <span class="chevron">${chevronDownIcon(14)}</span>
        </button>
      `;
    }
    const options = this.#matches;
    const active = Math.min(this.active, Math.max(0, options.length - 1));
    return html`
      <div class="sizer" aria-hidden="true">
        ${store.mods.map((m) => html`<span>${this.#nameOf(m)}</span>`)}
      </div>
      <input
        type="text"
        role="combobox"
        aria-label="Switch Mod"
        aria-expanded="true"
        aria-controls="mods"
        aria-autocomplete="list"
        aria-activedescendant=${options.length > 0 ? `opt-${active}` : ""}
        placeholder=${name}
        .value=${this.query}
        @input=${this.#input}
        @keydown=${this.#inputKey}
        @focusout=${this.#focusOut}
      />
      <ul id="mods" role="listbox" aria-label="Mods">
        ${options.length === 0
          ? html`<li class="none">No mods match.</li>`
          : options.map(
            (o, i) =>
              html`
                <li
                  id=${`opt-${i}`}
                  role="option"
                  class=${i === active ? "active" : ""}
                  aria-selected=${String(o.dirName === store.loaded?.dirName)}
                  @pointerdown=${(e: Event) => e.preventDefault()}
                  @pointerenter=${() => (this.active = i)}
                  @click=${() => this.#pick(o.dirName)}
                >
                  <span class="name">${o.name}</span>
                  <span class="id">${o.dirName}</span>
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
    const options = this.#matches;
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
      if (row) this.#pick(row.dirName);
    } else if (event.key === "Escape") {
      event.preventDefault();
      void this.#close(true);
    }
  }

  #focusOut(event: FocusEvent) {
    const next = event.relatedTarget as Node | null;
    if (!next || !this.renderRoot.contains(next)) void this.#close();
  }

  #pick(dirName: string) {
    const current = store.loaded?.dirName;
    void this.#close(true);
    if (dirName !== current) void store.openMod(dirName);
  }
}

customElements.define("ce-mod-switcher", CeModSwitcher);
