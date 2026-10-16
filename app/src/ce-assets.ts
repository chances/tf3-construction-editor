import { css, html, LitElement } from "lit";
import { assetChips, modelNames } from "@cedit/schema";
import { cardStyles } from "./card-styles.ts";
import "./ce-error-state.ts";
import { spinnerIcon } from "./icons.ts";
import { observer } from "./observer.ts";
import { counted, nounForms } from "./plural.ts";
import { store } from "./state.ts";
import { sharedStyles } from "./styles.ts";

const MODEL = nounForms("model");

/** Left aside: search the model index and add a model to the surface. */
export class CeAssets extends observer(LitElement) {
  static override styles = [
    sharedStyles,
    cardStyles,
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
      header input {
        box-sizing: border-box;
        inline-size: 100%;
      }
      .body {
        overflow: auto;
        padding: 0.5rem 0.75rem;
      }
      ul.cards {
        grid-template-columns: minmax(0, 1fr);
        margin-block-end: 0;
      }
      button.card.item[aria-current="true"] {
        background: var(--ce-selected);
        border-color: var(--ce-accent);
      }
      button.card span.chips {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
        overflow: visible;
        white-space: normal;
      }
      .chip {
        border: 1px solid var(--ce-muted);
        border-radius: 999px;
        color: var(--ce-muted);
        font-size: 0.75rem;
        padding-block: 0.05rem;
        padding-inline: 0.5rem;
      }
      .chip.com {
        color: var(--ce-zone-com);
      }
      .chip.ind {
        color: var(--ce-zone-ind);
      }
      .chip.res {
        color: var(--ce-zone-res);
      }
      .chip.com,
      .chip.ind,
      .chip.res {
        border-color: currentColor;
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

  #scrolledTo: string | null = null;

  /** Scrolls the picked asset into view once, when a pick changes. */
  override updated() {
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
    return html`
      <header>
        <h2>Assets</h2>
        <input
          type="search"
          placeholder="Search models"
          aria-label="Search models"
          .value=${store.assetQuery}
          @input=${(e: Event) =>
            store.searchAssets((e.target as HTMLInputElement).value)}
        />
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
                    <li>
                      <button
                        class="card item"
                        title=${a.id}
                        aria-current=${String(a.id === store.pickedAssetId)}
                        @click=${() => store.addModel(a.id)}
                      >
                        <strong>${modelNames(a.id).title}</strong>
                        <span class="muted">${a.variants.length > 1
                          ? modelNames(a.id).stem
                          : modelNames(a.id).base}</span>
                        <span class="chips">
                          ${assetChips(a, a.variants).map(
                            (c) =>
                              html`<span class="chip ${
                                c.zone ?? ""
                              }">${c.label}</span>`,
                          )}
                        </span>
                      </button>
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
