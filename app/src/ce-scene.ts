import { css, html, LitElement } from "lit";
import { observer } from "./observer.ts";
import { store } from "./state.ts";
import { sharedStyles } from "./styles.ts";

function baseName(id: string): string {
  return id.slice(id.lastIndexOf("/") + 1);
}

/** Scene tree: the construction, its layers, and the models on each layer. */
export class CeScene extends observer(LitElement) {
  static override styles = [
    sharedStyles,
    css`
      :host {
        display: block;
      }
      ul.tree,
      ul.tree ul {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      ul.tree ul {
        padding-inline-start: 1rem;
      }
      .row {
        align-items: center;
        display: flex;
        gap: 0.25rem;
      }
      button.item {
        background: transparent;
        border: 0;
        border-radius: 3px;
        overflow: hidden;
        text-align: start;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      ul.tree li > button.item {
        inline-size: 100%;
      }
      button.item:hover {
        background: var(--ce-surface-2);
      }
      button.item[aria-current="true"] {
        background: var(--ce-selected);
      }
      .row > input {
        flex: none;
      }
      .row button.item {
        flex: 1;
        min-inline-size: 0;
      }
      .root > .row button.item,
      .layer > .row button.item {
        font-weight: 600;
      }
      .layer > .row button.item {
        align-items: center;
        display: flex;
        gap: 0.5rem;
        justify-content: space-between;
      }
      .layer .name {
        min-inline-size: 0;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .layer .tag {
        background: var(--ce-surface-2);
        border: 1px solid var(--ce-border);
        border-radius: 999px;
        color: var(--ce-muted);
        flex: none;
        font-size: 11px;
        font-variant-numeric: tabular-nums;
        font-weight: 400;
        padding-inline: 0.5rem;
      }
      .add {
        margin-block-start: 0.5rem;
      }
    `,
  ];

  override render() {
    const doc = store.doc;
    if (!doc) return null;
    const inspect = store.inspectTarget;
    return html`
      <ul class="tree">
        <li class="root">
          <div class="row">
            <button
              class="item"
              aria-current=${String(inspect === "construction")}
              @click=${() => store.select(null)}
            >${doc.description.name}</button>
          </div>
          <ul>
            ${doc.subconstructions.map(
              (sub, si) =>
                html`
                  <li class="layer">
                    <div class="row">
                      <input
                        type="checkbox"
                        title="Toggle layer visibility"
                        aria-label=${`${sub.hidden ? "Show" : "Hide"} layer`}
                        .checked=${!sub.hidden}
                        @change=${(e: Event) =>
                          store.setHidden(
                            si,
                            !(e.target as HTMLInputElement).checked,
                          )}
                      />
                      <button
                        class="item"
                        aria-current=${String(
                          inspect === "layer" && store.activeSub === si,
                        )}
                        @click=${() => store.selectLayer(si)}
                      >
                        <span class="name">${sub.label ??
                          `Layer ${si + 1}`}</span>${sub.tag !== undefined
                          ? html`<span class="tag" title="Tag ${sub.tag}">${sub.tag}</span>`
                          : null}
                      </button>
                    </div>
                    <ul>
                                        ${sub.models.map(
                                          (m, mi) =>
                                            html`<li><button
                          class="item"
                          title=${m.id}
                          aria-current=${
                                              String(
                                                store.selection?.sub === si &&
                                                  store.selection.model === mi,
                                              )
                                            }
                          @click=${() => store.select({ sub: si, model: mi })}
                        >${baseName(m.id)}</button></li>`,
                                        )}
                                      </ul>
                  </li>
                `,
            )}
          </ul>
        </li>
      </ul>
      <button class="add" @click=${() => store.addSubconstruction()}>
        Add Subconstruction
      </button>
    `;
  }
}

customElements.define("ce-scene", CeScene);
