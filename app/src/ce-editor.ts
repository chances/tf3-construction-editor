import { css, html, LitElement } from "lit";
import "./ce-assets.ts";
import "./ce-canvas.ts";
import "./ce-construction-switcher.ts";
import "./ce-inspector.ts";
import { redoIcon, trashIcon, undoIcon } from "./icons.ts";
import { observer } from "./observer.ts";
import { store } from "./state.ts";
import { sharedStyles } from "./styles.ts";

/**
 * The editor page: an Assets aside, the editor surface, and an Inspector aside.
 * The surface takes the remaining width.
 */
export class CeEditor extends observer(LitElement) {
  static override styles = [
    sharedStyles,
    css`
      :host {
        background: var(--ce-surface);
        block-size: 100%;
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
      }
      header {
        align-items: center;
        border-block-end: 1px solid var(--ce-border);
        display: flex;
        gap: 0.5rem;
        padding-block: 0.4rem;
        padding-inline: 0.75rem;
      }
      header nav {
        align-items: center;
        display: flex;
        flex: 1;
        gap: 0.4rem;
        min-inline-size: 0;
      }
      header nav .sep {
        color: var(--ce-muted);
      }
      /* The construction name and its delete button share a text baseline. */
      header nav .current {
        align-items: baseline;
        display: inline-flex;
        gap: 0.15rem;
        min-inline-size: 0;
      }
      header nav .trash {
        background: transparent;
        border: 1px solid transparent;
        color: var(--ce-muted);
        display: inline-flex;
        padding: 0.15rem;
      }
      header nav .trash:hover,
      header nav .trash:focus-visible {
        border-color: var(--ce-error);
        color: var(--ce-error);
      }
      .message {
        color: var(--ce-error);
      }
      button.icon-button {
        align-items: center;
        display: inline-flex;
        justify-content: center;
        padding-block: 0.3rem;
        padding-inline: 0.4rem;
      }
      .panes {
        display: grid;
        grid-template-columns:
          clamp(11rem, 22vw, 17rem) minmax(0, 1fr)
          clamp(13rem, 26vw, 20rem);
        min-block-size: 0;
      }
      aside {
        display: grid;
        grid-template-rows: minmax(0, 1fr);
        min-block-size: 0;
        min-inline-size: 0;
      }
      aside.assets {
        border-inline-end: 1px solid var(--ce-border);
      }
      aside.inspector {
        border-inline-start: 1px solid var(--ce-border);
      }
      ce-canvas {
        min-inline-size: 0;
      }
    `,
  ];

  override render() {
    const modName = store.loaded?.modInfo.name ?? "";
    const undoLabel = store.undoLabel ? `Undo ${store.undoLabel}` : "Undo";
    const redoLabel = store.redoLabel ? `Redo ${store.redoLabel}` : "Redo";
    const deleteLabel = `Delete ${store.doc?.description.name ?? ""}`;
    return html`
      <header>
        <nav aria-label="Breadcrumb">
          <button @click=${() => store.goTo("details")}>${modName}</button>
          <span class="sep" aria-hidden="true">/</span>
          <button @click=${() => store.goTo("constructions")}>
            Constructions
          </button>
          <span class="sep" aria-hidden="true">/</span>
          <span class="current">
            <ce-construction-switcher></ce-construction-switcher>
            <button
              class="trash"
              aria-label=${`Delete ${
                store.doc?.description.name ?? ""
              } construction`}
              title=${deleteLabel}
              @click=${() => store.doc && store.requestDelete(store.doc.id)}
            >
              ${trashIcon(14)}
            </button>
          </span>
        </nav>
        ${store.message
          ? html`<span class="message">${store.message}</span>`
          : null}
        <button
          class="icon-button"
          ?disabled=${!store.canUndo}
          aria-label=${undoLabel}
          title=${undoLabel}
          @click=${() => store.undo()}
        >
          ${undoIcon()}
        </button>
        <button
          class="icon-button"
          ?disabled=${!store.canRedo}
          aria-label=${redoLabel}
          title=${redoLabel}
          @click=${() => store.redo()}
        >
          ${redoIcon()}
        </button>
        <button
          class="primary"
          ?disabled=${!store.doc || store.busy}
          @click=${() => store.exportCurrent()}
        >Export</button>
      </header>
      <div class="panes">
        <aside class="assets" aria-label="Assets">
          <ce-assets></ce-assets>
        </aside>
        <ce-canvas></ce-canvas>
        <aside class="inspector" aria-label="Inspector">
          <ce-inspector></ce-inspector>
        </aside>
      </div>
    `;
  }
}

customElements.define("ce-editor", CeEditor);
