import { css, html, LitElement } from "lit";
import "./ce-error-state.ts";
import { spinnerIcon } from "./icons.ts";
import { observer } from "./observer.ts";
import { counted } from "./plural.ts";
import { store } from "./state.ts";
import { sharedStyles } from "./styles.ts";

const MODEL = { one: "model", other: "models" };

/** Left aside: search the model index and add a model to the surface. */
export class CeAssets extends observer(LitElement) {
  static override styles = [
    sharedStyles,
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
      .source {
        color: var(--ce-muted);
        display: block;
        font-size: 11px;
      }
      ul.list li button.item {
        white-space: normal;
        word-break: break-all;
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
            <ul class="list">
              ${store.assets.map(
                (a) =>
                  html`
                    <li>
                      <button
                        class="item"
                        aria-current=${String(a.id === store.pickedAssetId)}
                        @click=${() => store.addModel(a.id)}
                      >
                        ${a.id}
                        <span class="source"
                          >${a.source}${a.modId ? ` ${a.modId}` : ""}</span
                        >
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
