import { css, html, LitElement } from "lit";
import { spinnerIcon } from "./icons.ts";
import { observer } from "./observer.ts";
import { store } from "./state.ts";

/**
 * Blanks the page with a large centered spinner while data loads, and says
 * what the app is doing and which steps it is waiting on.
 */
export class CeLoading extends observer(LitElement) {
  static override styles = css`
    :host {
      align-content: center;
      box-sizing: border-box;
      color: var(--ce-text);
      display: grid;
      gap: 0.75rem;
      justify-items: center;
      padding: 0.5rem 0;
      text-align: center;
    }
    .spinner {
      animation: spin 0.9s linear infinite;
      color: var(--ce-accent);
      display: grid;
    }
    @media (prefers-reduced-motion: reduce) {
      .spinner {
        animation-duration: 3s;
      }
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
    h2 {
      font: 600 1.1rem/1.3 system-ui, sans-serif;
      margin: 0;
    }
    ul {
      color: var(--ce-muted);
      display: grid;
      font: 13px/1.4 system-ui, sans-serif;
      gap: 0.35rem;
      list-style: none;
      margin: 0;
      max-inline-size: 36rem;
      padding: 0;
    }
    li {
      display: grid;
      gap: 0.15rem;
    }
    li p {
      margin: 0;
    }
  `;

  override connectedCallback() {
    super.connectedCallback();
    this.setAttribute("role", "status");
    this.setAttribute("aria-live", "polite");
    this.setAttribute("aria-busy", "true");
  }

  override render() {
    const tasks = store.loadingTasks;
    return html`
      <span class="spinner">${spinnerIcon(56)}</span>
      ${store.loadingTitle
        ? html`<h2>${store.loadingTitle}</h2>`
        : html`<h2>Loading</h2>`}
      ${tasks.length > 0
        ? html`<ul>${
          tasks.map(
            (t) =>
              html`
                <li>
                              <p>${t.text}</p>
                              ${t.note
                                ? html`<p class="note">${t.note}</p>`
                                : null}
                            </li>
              `,
          )
        }</ul>`
        : null}
    `;
  }
}

customElements.define("ce-loading", CeLoading);
