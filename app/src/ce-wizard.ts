import { css, html, LitElement } from "lit";
import { isModDetailsComplete } from "@cedit/schema";
import "./ce-loading.ts";
import "./ce-mod-picker.ts";
import "./ce-mod-details.ts";
import "./ce-construction-picker.ts";
import { observer } from "./observer.ts";
import { store } from "./state.ts";
import type { View } from "./store.ts";
import { sharedStyles } from "./styles.ts";

const STEPS: { view: View; label: string }[] = [
  { view: "mods", label: "Choose a Mod" },
  { view: "details", label: "Mod Details" },
  { view: "constructions", label: "Construction" },
];

/** One step at a time: choose a mod, describe it, then pick a construction. */
export class CeWizard extends observer(LitElement) {
  static override styles = [
    sharedStyles,
    css`
      :host {
        box-sizing: border-box;
        display: grid;
        justify-items: center;
        overflow: auto;
        padding-block: 2rem;
        padding-inline: 1rem;
      }
      main {
        inline-size: min(36rem, 100%);
      }
      h1 {
        font-size: 1.25rem;
        margin-block: 0 1rem;
      }
      ol {
        display: flex;
        gap: 0.5rem;
        list-style: none;
        margin: 0 0 1.5rem;
        padding: 0;
      }
      ol li {
        border-block-end: 3px solid var(--ce-border);
        color: var(--ce-muted);
        flex: 1;
        padding-block-end: 0.35rem;
      }
      ol li[aria-current="step"] {
        border-color: var(--ce-accent);
        color: var(--ce-text);
        font-weight: 600;
      }
      ol li button {
        background: none;
        border: 0;
        color: inherit;
        font: inherit;
        padding: 0;
        text-align: start;
      }
      ol li button:not(:disabled) {
        cursor: pointer;
      }
      ol li button:not(:disabled):hover {
        color: var(--ce-text);
      }
      .card {
        background: var(--ce-surface);
        border: 1px solid var(--ce-border);
        border-radius: 8px;
        padding: 1.25rem;
      }
    `,
  ];

  override render() {
    // Loading is an implicit step between wizard steps. The stepper points at
    // the step being loaded, and the card shows the spinner in place of the form.
    const loading = !store.ready || store.loadingVisible;
    const heading = loading ? (store.loadingTarget ?? store.view) : store.view;
    const stepView: View = heading === "editor" ? "constructions" : heading;
    const current = STEPS.findIndex((s) => s.view === stepView);
    // An existing mod that already has its details can skip to step 3.
    const detailsComplete = store.loaded
      ? isModDetailsComplete(store.loaded.modInfo)
      : false;
    return html`
      <main>
        <h1>Construction Editor</h1>
        <ol aria-label="Steps">
          ${STEPS.map(
            (step, i) =>
              html`
                <li aria-current=${i === current ? "step" : "false"}>
                  <button
                    ?disabled=${loading || !store.loaded || i === current ||
                      (i > current && !(step.view === "constructions" &&
                        detailsComplete))}
                    @click=${() => store.goTo(step.view)}
                  >${i + 1}. ${step.label}</button>
                </li>
              `,
          )}
        </ol>
        <div class="card">
          ${loading
            ? html`<ce-loading></ce-loading>`
            : store.view === "mods"
            ? html`<ce-mod-picker></ce-mod-picker>`
            : store.view === "details"
            ? html`<ce-mod-details></ce-mod-details>`
            : html`<ce-construction-picker></ce-construction-picker>`}
        </div>
      </main>
    `;
  }
}

customElements.define("ce-wizard", CeWizard);
