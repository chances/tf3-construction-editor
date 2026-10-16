import { css, html, LitElement } from "lit";
import { warningIcon } from "./icons.ts";
import { observer } from "./observer.ts";
import { counted, nounForms } from "./plural.ts";
import { store } from "./state.ts";
import { sharedStyles } from "./styles.ts";

const MODEL = nounForms("model");

/**
 * The app's one modal. It asks before a construction or layer is deleted: it
 * names the item, says what is removed, and puts focus on the safe choice.
 * It also reports an unreachable server. `Escape` and Cancel dismiss it. A
 * click on the backdrop or on empty space does nothing.
 */
export class CeConfirmDialog extends observer(LitElement) {
  static override styles = [
    sharedStyles,
    css`
      dialog {
        background: var(--ce-surface);
        border: 1px solid var(--ce-border);
        border-radius: 8px;
        box-shadow: 0 12px 32px rgb(0 0 0 / 0.4);
        color: var(--ce-text);
        inline-size: min(26rem, calc(100vw - 2rem));
        padding: 1.25rem;
      }
      dialog::backdrop {
        background: rgb(0 0 0 / 0.55);
      }
      h2 {
        color: var(--ce-text);
        font-size: 1.05rem;
        letter-spacing: normal;
        margin: 0 0 0.5rem;
        text-transform: none;
      }
      /* An error dialog's title leads with the warning triangle in the error
        color. The title text keeps the normal text color. */
      h2.alert {
        align-items: center;
        display: flex;
        gap: 0.5rem;
      }
      h2.alert svg {
        color: var(--ce-error);
        flex: none;
      }
      p {
        margin: 0 0 0.5rem;
      }
      .actions {
        display: flex;
        gap: 0.5rem;
        justify-content: flex-end;
        margin-block-start: 1rem;
      }
      button.danger {
        background: var(--ce-error);
        border-color: var(--ce-error);
        color: var(--ce-surface);
        font-weight: 600;
      }
    `,
  ];

  override updated() {
    const dialog = this.renderRoot.querySelector("dialog");
    if (!dialog) return;
    const wanted = store.serverUnreachable || store.pendingDelete !== null ||
      store.pendingLayerDelete !== null;
    if (wanted && !dialog.open) dialog.showModal();
    else if (!wanted && dialog.open) dialog.close();
  }

  override render() {
    const target = store.pendingDelete;
    const layer = store.pendingLayerDelete;
    return html`
      <dialog
        aria-labelledby="title"
        aria-describedby="body"
        @cancel=${(e: Event) => {
          e.preventDefault();
          if (store.serverUnreachable) store.dismissUnreachable();
          else store.cancelDelete();
        }}
      >
        ${store.serverUnreachable
          ? html`
            <h2 id="title" class="alert">
              ${warningIcon(18)}Server Unreachable
            </h2>
            <p id="body">
              The editor could not reach its server, so nothing can be loaded
              or saved right now.
            </p>
            <p class="muted">
              Changes you make stay in this window until the server answers.
            </p>
            <div class="actions">
              <button autofocus @click=${() => store.dismissUnreachable()}>
                Dismiss
              </button>
              <button class="primary" @click=${() => store.retryServer()}>
                Retry
              </button>
            </div>
          `
          : layer
          ? html`
            <h2 id="title">Delete Layer</h2>
            <p id="body">
              Delete <strong>${layer.name}</strong>${layer.models === 0
                ? "?"
                : html`
                  and the ${counted(layer.models, MODEL)} on it?
                `}
            </p>
            <p class="muted">Undo brings the layer back.</p>
            <div class="actions">
              <button autofocus @click=${() => store.cancelDelete()}>
                Cancel
              </button>
              <button
                class="danger"
                @click=${() => store.confirmDeleteLayer()}
              >
                Delete
              </button>
            </div>
          `
          : target
          ? html`
            <h2 id="title">Delete Construction</h2>
            <p id="body">
              Delete <strong>${target.name}</strong>
              (<code>${target.id}</code>)? This removes its construction file
              and the exported <code>.con.lua</code> and
              <code>.script.tl</code> files this editor wrote.
            </p>
            <p class="muted">This cannot be undone.</p>
            <div class="actions">
              <button autofocus @click=${() => store.cancelDelete()}>
                Cancel
              </button>
              <button class="danger" @click=${() => store.confirmDelete()}>
                Delete
              </button>
            </div>
          `
          : null}
      </dialog>
    `;
  }
}

customElements.define("ce-confirm-dialog", CeConfirmDialog);
