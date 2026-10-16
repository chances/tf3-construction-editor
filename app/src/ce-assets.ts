import { css, html, LitElement } from "lit";
import { ifDefined } from "lit/directives/if-defined.js";
import {
  CHIP_KINDS,
  type ChipKind,
  modelNames,
  zoneOfLabel,
} from "@cedit/schema";
import type { AssetFacet } from "./api.ts";
import { filterCount, isSelected } from "./asset-filters.ts";
import { cardStyles, chipStyles } from "./card-styles.ts";
import "./ce-error-state.ts";
import { filtersIcon, searchIcon, spinnerIcon, xIcon } from "./icons.ts";
import { observer } from "./observer.ts";
import { counted, nounForms } from "./plural.ts";
import { store } from "./state.ts";
import { sharedStyles } from "./styles.ts";
import { suggestTags } from "./tag-suggest.ts";

const MODEL = nounForms("model");
const FILTER = nounForms("filter");
/** One group of the filters overlay with its chips. */
interface FilterGroup {
  kind: ChipKind;
  label: string;
  facets: AssetFacet[];
}

/** Left aside: search the model index and add a model to the surface. */
export class CeAssets extends observer(LitElement) {
  static override styles = [
    sharedStyles,
    cardStyles,
    chipStyles,
    css`
      :host {
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        min-block-size: 0;
      }
      header {
        border-block-end: 1px solid var(--ce-border);
        padding: 0.75rem;
      }
      header h2 {
        margin-block-end: 0.5rem;
      }
      header .input-suffix {
        anchor-name: --assets-search;
      }
      header .input-suffix.open {
        border-end-end-radius: 0;
        border-end-start-radius: 0;
      }
      header .input-suffix > input {
        box-sizing: border-box;
      }
      button.filters {
        position: relative;
      }
      button.filters .badge {
        background: var(--ce-accent);
        border-radius: 999px;
        color: var(--ce-on-accent);
        font-size: 0.65rem;
        inset-block-start: -0.1rem;
        inset-inline-end: -0.1rem;
        line-height: 1;
        padding: 0.15rem 0.3rem;
        position: absolute;
      }
      .active {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
        margin-block-start: 0.5rem;
      }
      .active button.chip {
        align-items: center;
        display: inline-flex;
        gap: 0.3rem;
        line-height: 1.4;
      }
      .active button.chip svg {
        flex: none;
      }
      .body {
        overflow: auto;
        padding: 0.5rem 0.75rem;
      }
      ul.cards {
        grid-template-columns: minmax(0, 1fr);
        margin-block-end: 0;
      }
      li.asset {
        align-content: start;
        background: var(--ce-surface-2);
        border: 1px solid var(--ce-border);
        border-radius: 8px;
        gap: 0.25rem;
        padding: 0.75rem;
      }
      li.asset:hover,
      li.asset:focus-within {
        border-color: var(--ce-accent);
      }
      li.asset:has(button.item[aria-current="true"]) {
        background: var(--ce-selected);
        border-color: var(--ce-accent);
      }
      li.asset button.item {
        background: transparent;
        border: 0;
        display: grid;
        gap: 0.25rem;
        grid-template-columns: minmax(0, 1fr);
        padding: 0;
        text-align: start;
      }
      li.asset button.item strong {
        overflow-wrap: anywhere;
      }
      li.asset button.item span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
      }
      button.chip {
        background: transparent;
        padding-block: 0.05rem;
        padding-inline: 0.5rem;
      }
      button.chip:hover:not(:disabled) {
        border-color: var(--ce-accent);
      }
      button.chip[aria-pressed="true"] {
        background: var(--ce-selected);
        border-color: var(--ce-accent);
      }
      /* A thin rule and a dimmer count set the number apart from the tag name. */
      button.chip .count {
        border-inline-start: 1px solid
          color-mix(in srgb, currentColor 45%, transparent);
        margin-inline-start: 0.45rem;
        opacity: 0.75;
        padding-inline-start: 0.45rem;
      }
      button.chip.dim {
        opacity: 0.5;
      }
      .suggest {
        background: var(--ce-surface);
        border: 1px solid var(--ce-border);
        border-radius: 8px;
        border-start-end-radius: 0;
        border-start-start-radius: 0;
        box-shadow: 0 8px 24px rgb(0 0 0 / 0.3);
        box-sizing: border-box;
        color: var(--ce-text);
        inline-size: anchor-size(--assets-search inline);
        margin: 0;
        max-block-size: 100%;
        overflow: auto;
        padding: 0.25rem;
        position-anchor: --assets-search;
        position-area: block-end span-inline-end;
      }
      .suggest .group {
        color: var(--ce-muted);
        font-size: 11px;
        padding-block: 0.35rem 0.1rem;
        padding-inline: 0.4rem;
      }
      .suggest .option {
        border-radius: 4px;
        cursor: pointer;
        display: flex;
        gap: 0.5rem;
        justify-content: space-between;
        padding-block: 0.2rem;
        padding-inline: 0.4rem;
      }
      .suggest .option:hover,
      .suggest .option[aria-selected="true"] {
        background: var(--ce-surface-2);
      }
      .suggest .option.com {
        color: var(--ce-zone-com);
      }
      .suggest .option.ind {
        color: var(--ce-zone-ind);
      }
      .suggest .option.res {
        color: var(--ce-zone-res);
      }
      .suggest .count {
        color: var(--ce-muted);
      }
      .filters-overlay {
        background: var(--ce-surface);
        border: 1px solid var(--ce-border);
        border-radius: 8px;
        border-start-start-radius: 0;
        box-shadow: 0 8px 24px rgb(0 0 0 / 0.3);
        box-sizing: border-box;
        color: var(--ce-text);
        inline-size: 32rem;
        margin: 0;
        block-size: 21.5rem;
        max-block-size: 100%;
        max-inline-size: 100%;
        min-inline-size: anchor-size(--assets-search inline);
        overflow: hidden;
        padding: 0.75rem;
        position-anchor: --assets-search;
        position-area: block-end span-inline-end;
      }
      /* Display is set only when open, so the closed popover stays hidden. */
      .filters-overlay:popover-open {
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
      }
      .filters-overlay .loading {
        align-items: center;
        display: flex;
        gap: 0.4rem;
        justify-content: center;
        margin: 0;
        min-inline-size: 12rem;
        padding-block: 0.5rem;
      }
      /* Groups on the start side, the chips of the open group on the end side. */
      .filters-overlay .panes {
        border-block-start: 1px solid var(--ce-border);
        margin-inline: -0.75rem;
        margin-block-end: -0.75rem;
        display: grid;
        grid-template-columns: 10rem minmax(0, 1fr);
        min-block-size: 0;
      }
      .filters-overlay .groups {
        border-inline-end: 1px solid var(--ce-border);
        display: grid;
        align-content: start;
        overflow: auto;
      }
      .filters-overlay .groups button {
        align-items: center;
        background: transparent;
        border: 0;
        border-radius: 0;
        display: flex;
        gap: 0.5rem;
        justify-content: space-between;
        text-align: start;
      }
      .filters-overlay .groups button[aria-selected="true"] {
        background: var(--ce-selected);
        font-weight: 600;
      }
      .filters-overlay .groups .num {
        color: var(--ce-muted);
        font-size: 11px;
      }
      .filters-overlay .groups .badge {
        background: var(--ce-accent);
        border-radius: 999px;
        color: var(--ce-on-accent);
        font-size: 0.65rem;
        padding: 0.1rem 0.35rem;
      }
      .filters-overlay .values {
        display: grid;
        grid-template-rows: minmax(0, 1fr);
        min-block-size: 0;
        padding-inline-start: 0.5rem;
      }
      /* The find box and the clear button share the heading row at one height. */
      .filters-overlay hgroup .tools {
        align-items: center;
        display: flex;
        gap: 0.5rem;
        min-inline-size: 0;
      }
      .filters-overlay hgroup .tools .find {
        block-size: 1.5rem;
        box-sizing: border-box;
        inline-size: 11rem;
      }
      .filters-overlay hgroup .tools .find input {
        block-size: 100%;
        min-inline-size: 0;
        padding-block: 0;
      }
      .filters-overlay .values .chips {
        align-content: start;
        padding-block: 0.5rem;
        overflow: hidden auto;
      }
      .filters-overlay .values .none {
        color: var(--ce-muted);
        margin: 0;
      }
      .filters-overlay hgroup {
        align-items: center;
        display: flex;
        gap: 1rem;
        justify-content: space-between;
        margin-block-end: 0.75rem;
      }
      .filters-overlay hgroup h1 {
        color: var(--ce-muted);
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.06em;
        margin: 0;
        text-transform: uppercase;
      }
      /* As tall as the scene heading actions, so the heading does not grow. */
      .filters-overlay button.clear {
        align-items: center;
        block-size: 1.5rem;
        box-sizing: border-box;
        display: inline-flex;
        gap: 0.35rem;
        line-height: 1;
        padding-block: 0;
      }
      .choose {
        align-items: center;
        display: inline-flex;
        gap: 0.4rem;
      }
      .spin {
        animation: spin 0.9s linear infinite;
        display: inline-grid;
      }
      @media (prefers-reduced-motion: reduce) {
        .spin {
          animation-duration: 3s;
        }
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ];

  static override properties = {
    filtersOpen: { state: true },
    focused: { state: true },
    active: { state: true },
    dismissed: { state: true },
    filterGroup: { state: true },
    groupQuery: { state: true },
  };

  declare filtersOpen: boolean;
  /** True while the search box has focus. */
  declare focused: boolean;
  /** The highlighted suggestion, or -1 for none. */
  declare active: number;
  /** The text for which Escape closed the suggestions. */
  declare dismissed: string | null;
  /** The group open in the filters overlay, or null for the default. */
  declare filterGroup: ChipKind | null;
  /** The text typed into the find box of the open group. */
  declare groupQuery: string;

  constructor() {
    super();
    this.filterGroup = null;
    this.groupQuery = "";
    this.filtersOpen = false;
    this.focused = false;
    this.active = -1;
    this.dismissed = null;
  }

  #scrolledTo: string | null = null;

  /** The tags that match the word being typed, and whether the list is open. */
  #suggest() {
    const { suggestions, start } = suggestTags(
      store.assetQuery,
      store.assetFacets,
      store.assetFilters,
    );
    const open = this.focused && suggestions.length > 0 &&
      this.dismissed !== store.assetQuery;
    return { suggestions, start, open };
  }

  /** Selects a suggestion and removes the typed word from the text. */
  #accept(index: number) {
    const { suggestions, start } = this.#suggest();
    const s = suggestions[index];
    if (!s) return;
    store.applySuggestion(
      s.kind,
      s.label,
      store.assetQuery.slice(0, start).trimEnd(),
    );
    this.active = -1;
  }

  /** The chip groups that have chips, each with its chips. */
  #groups(): FilterGroup[] {
    return CHIP_KINDS.map(({ kind, label }) => ({
      kind,
      label,
      facets: store.assetFacets.filter((f) => f.kind === kind),
    })).filter((g) => g.facets.length > 0);
  }

  /** The open group: the one picked, else the first with a selection, else the first. */
  #openGroup(groups: FilterGroup[]) {
    return groups.find((g) => g.kind === this.filterGroup) ??
      groups.find((g) => (store.assetFilters[g.kind] ?? []).length > 0) ??
      groups[0];
  }

  async #pickGroup(kind: ChipKind) {
    this.filterGroup = kind;
    this.groupQuery = "";
    await this.updateComplete;
    this.renderRoot.querySelector<HTMLElement>(
      '[role="tab"][aria-selected="true"]',
    )?.focus();
  }

  #onGroupKeyDown(e: KeyboardEvent) {
    const groups = this.#groups();
    const at = groups.indexOf(this.#openGroup(groups));
    const step = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (step === 0) return;
    e.preventDefault();
    void this.#pickGroup(
      groups[(at + step + groups.length) % groups.length].kind,
    );
  }

  /** The find box for the chips of the open group, or nothing while loading. */
  #find() {
    const groups = this.#groups();
    if (store.assetFacetsLoading || groups.length === 0) return null;
    const open = this.#openGroup(groups);
    return html`
      <div class="input-suffix find">
        <label class="prefix" for="tag-find">${searchIcon(12)}</label>
        <input
          id="tag-find"
          type="search"
          placeholder=${`Find in ${open.label}`}
          aria-label=${`Find a tag in ${open.label}`}
          .value=${this.groupQuery}
          @input=${(e: Event) =>
            this.groupQuery = (e.target as HTMLInputElement).value}
        />
      </div>
    `;
  }

  /** The group list and the chips of the open group. */
  #panes() {
    if (store.assetFacetsLoading) {
      return html`
        <p class="loading muted" role="status">
          <span class="spin" aria-hidden="true">${spinnerIcon(16)}</span>
          Loading filters…
        </p>
      `;
    }
    const groups = this.#groups();
    if (groups.length === 0) {
      return html`<p class="loading muted">No filters are available.</p>`;
    }
    const open = this.#openGroup(groups);
    const term = this.groupQuery.trim().toLowerCase();
    const shown = open.facets
      .filter((f) => f.label.toLowerCase().includes(term))
      .sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { numeric: true })
      );
    return html`
      <div class="panes">
        <div
          class="groups"
          role="tablist"
          aria-orientation="vertical"
          aria-label="Filter groups"
          @keydown=${(e: KeyboardEvent) => this.#onGroupKeyDown(e)}
        >
          ${groups.map((g) => {
            const on = (store.assetFilters[g.kind] ?? []).length;
            return html`
              <button
                role="tab"
                id=${`group-${g.kind}`}
                aria-selected=${String(g === open)}
                aria-controls="values"
                tabindex=${g === open ? "0" : "-1"}
                @click=${() => this.#pickGroup(g.kind)}
              >
                <span>${g.label}</span>
                ${on > 0
                  ? html`<span class="badge">${on}</span>`
                  : html`<span class="num">${g.facets.length}</span>`}
              </button>
            `;
          })}
        </div>
        <div
          id="values"
          class="values"
          role="tabpanel"
          aria-labelledby=${`group-${open.kind}`}
        >
          ${shown.length === 0
            ? html`<p class="none">No tags match.</p>`
            : html`
              <div class="chips">
                ${shown.map((f) =>
                  html`
                    <button
                      class="chip ${(open.kind === "town"
                        ? zoneOfLabel(f.label)
                        : undefined) ?? ""}"
                      aria-pressed=${String(
                        isSelected(store.assetFilters, open.kind, f.label),
                      )}
                      @click=${() =>
                        store.toggleAssetFilter(open.kind, f.label)}
                    >
                      ${f.label}<span class="count">${f.count}</span>
                    </button>
                  `
                )}
              </div>
            `}
        </div>
      </div>
    `;
  }

  #onKeyDown(e: KeyboardEvent) {
    const { suggestions, open } = this.#suggest();
    if (!open) return;
    const n = suggestions.length;
    if (e.key === "ArrowDown") {
      this.active = (this.active + 1) % n;
    } else if (e.key === "ArrowUp") {
      this.active = this.active <= 0 ? n - 1 : this.active - 1;
    } else if (e.key === "Enter" && this.active >= 0) {
      this.#accept(this.active);
    } else if (e.key === "Tab" && !e.shiftKey) {
      this.#accept(this.active >= 0 ? this.active : 0);
    } else if (e.key === "Escape") {
      this.dismissed = store.assetQuery;
    } else return;
    e.preventDefault();
  }

  /** Scrolls the picked asset into view once, when a pick changes. */
  override updated() {
    const list = this.renderRoot.querySelector<HTMLElement>("#suggest");
    if (list) {
      const open = this.#suggest().open;
      const shown = list.matches(":popover-open");
      if (open && !shown) list.showPopover();
      else if (!open && shown) list.hidePopover();
    }
    const id = store.pickedAssetId;
    if (id === this.#scrolledTo) return;
    const item = this.renderRoot.querySelector(
      'button.item[aria-current="true"]',
    );
    if (!item) return;
    this.#scrolledTo = id;
    item.scrollIntoView({ block: "nearest" });
  }

  override render() {
    const notIndexed = store.installRoot === null && store.assets.length === 0;
    const selected = filterCount(store.assetFilters);
    const { suggestions, open: suggestOpen } = this.#suggest();
    const sections = [...new Set(suggestions.map((s) => s.kind))];
    return html`
      <header>
        <h2>Assets</h2>
        <div
          class=${this.filtersOpen || suggestOpen
            ? "input-suffix open"
            : "input-suffix"}
        >
          <label class="prefix" for="assets-search">${searchIcon(14)}</label>
          <input
            id="assets-search"
            type="search"
            role="combobox"
            placeholder="Search models"
            aria-label="Search models"
            aria-autocomplete="list"
            aria-controls="suggest"
            aria-expanded=${String(suggestOpen)}
            aria-activedescendant=${ifDefined(
              suggestOpen && this.active >= 0
                ? `suggest-${this.active}`
                : undefined,
            )}
            .value=${store.assetQuery}
            @input=${(e: Event) => {
              this.active = -1;
              store.searchAssets((e.target as HTMLInputElement).value);
            }}
            @keydown=${(e: KeyboardEvent) => this.#onKeyDown(e)}
            @focus=${() => {
              this.focused = true;
              if (store.assetFacets.length === 0) void store.loadAssetFacets();
            }}
            @blur=${() => (this.focused = false)}
          />
          <button
            class="icon filters"
            popovertarget="filters"
            title="Filters"
            aria-label=${selected > 0
              ? `Show or hide the model filters (${
                counted(selected, FILTER)
              } selected)`
              : "Show or hide the model filters"}
            aria-expanded=${String(this.filtersOpen)}
          >
            ${filtersIcon(16)}${selected > 0
              ? html`<span class="badge">${selected}</span>`
              : null}
          </button>
        </div>
        <div
          id="suggest"
          class="suggest"
          role="listbox"
          aria-label="Matching tags"
          popover="manual"
        >
          ${sections.map((kind) =>
            html`
              <div
                role="group"
                aria-label=${CHIP_KINDS.find((k) => k.kind === kind)!.label}
              >
                <div class="group" aria-hidden="true">${CHIP_KINDS.find((k) =>
                  k.kind === kind
                )!.label}</div>
                ${suggestions.map((s, i) =>
                  s.kind !== kind ? null : html`
                    <div
                      id=${`suggest-${i}`}
                      role="option"
                      class=${`option ${
                        (kind === "town" ? zoneOfLabel(s.label) : undefined) ??
                          ""
                      }`}
                      aria-selected=${String(i === this.active)}
                      @mousedown=${(e: Event) => e.preventDefault()}
                      @click=${() => this.#accept(i)}
                    >
                      <span>${s.label}</span>
                      <span class="count">${s.count}</span>
                    </div>
                  `
                )}
              </div>
            `
          )}
        </div>
        ${selected > 0
          ? html`
            <div class="active">
              ${CHIP_KINDS.flatMap(({ kind }) =>
                (store.assetFilters[kind] ?? []).map((label) =>
                  html`
                    <button
                      class="chip ${(kind === "town"
                        ? zoneOfLabel(label)
                        : undefined) ?? ""}"
                      title="Remove"
                      aria-label=${`Remove the ${label} filter`}
                      @click=${() => store.toggleAssetFilter(kind, label)}
                    >
                      ${label}${xIcon(12)}
                    </button>
                  `
                )
              )}
            </div>
          `
          : null}
        <div
          id="filters"
          class="filters-overlay"
          popover
          @toggle=${(e: ToggleEvent) => {
            this.filtersOpen = e.newState === "open";
            if (this.filtersOpen) void store.loadAssetFacets();
          }}
        >
          <hgroup>
            <h1>Filters</h1>
            <div class="tools">
              ${this.#find()}
              <button
                class="clear"
                ?disabled=${selected === 0}
                title=${selected === 0
                  ? "No filters are selected"
                  : "Clear every filter"}
                @click=${() => store.clearAssetFilters()}
              >
                ${xIcon(12)} Clear Filters
              </button>
            </div>
          </hgroup>
          ${this.#panes()}
        </div>
      </header>
      ${notIndexed
        ? html`
          <ce-error-state heading="Game Not Indexed">
            Set <code>installRoot</code> in
            <a
              href="/api/config/open"
              title="Open cedit.config.json"
              @click=${(e: Event) => {
                e.preventDefault();
                store.openConfigFile();
              }}
              ><code>cedit.config.json</code></a
            >
            to the Transport Fever 3 folder.
            ${store.message
              ? html`<p class="error">${store.message}</p>`
              : null}
            <button
              slot="actions"
              class="primary choose"
              ?disabled=${store.choosingFolder !== null}
              @click=${() => store.chooseFolder("installRoot")}
            >
              ${store.choosingFolder === "installRoot"
                ? html`<span class="spin" aria-hidden="true">${
                  spinnerIcon(
                    16,
                  )
                }</span>`
                : null}
              Select Install...
            </button>
          </ce-error-state>
        `
        : html`
          <div class="body">
            <p class="muted">
              ${store.assets.length} of ${counted(
                store.assetTotal,
                MODEL,
              )}.${store
                  .assets.length > 0
                ? " Select one to place it."
                : ""}
            </p>
            <ul class="cards">
              ${store.assets.map(
                (a) =>
                  html`
                    <li class="asset">
                      <button
                        class="item"
                        title=${a.id}
                        aria-current=${String(a.id === store.pickedAssetId)}
                        @click=${() => store.addModel(a.id)}
                      >
                        <strong>${modelNames(a.id).title}</strong>
                        <span class="muted">${a.variants.length > 1
                          ? modelNames(a.id).stem
                          : modelNames(a.id).base}</span>
                      </button>
                      <div class="chips">
                        ${a.chips.map(
                          (c) =>
                            html`
                              <button
                                class="chip ${c.zone ?? ""}"
                                title="Filter"
                                aria-label=${`Filter by ${c.label}`}
                                aria-pressed=${String(
                                  isSelected(
                                    store.assetFilters,
                                    c.kind!,
                                    c.label,
                                  ),
                                )}
                                @click=${() =>
                                  store.toggleAssetFilter(c.kind!, c.label)}
                              >
                                ${c.label}
                              </button>
                            `,
                        )}
                      </div>
                    </li>
                  `,
              )}
            </ul>
          </div>
        `}
    `;
  }
}

customElements.define("ce-assets", CeAssets);
