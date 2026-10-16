import { css, html, LitElement } from "lit";
import { errorIcon, warningIcon } from "./icons.ts";
import { observer } from "./observer.ts";
import { counted, nounForms, plural } from "./plural.ts";
import { store } from "./state.ts";
import { sharedStyles } from "./styles.ts";

const ERROR = nounForms("Error");
const WARNING = nounForms("Warning");
const FILE = nounForms("file");

/** Footer pane: lint errors and warnings, plus the last export result. */
export class CeProblems extends observer(LitElement) {
  static override styles = [
    sharedStyles,
    css`
      :host {
        display: grid;
        grid-template-rows: auto minmax(0, auto);
        min-block-size: 0;
      }
      /* The title sits at one end and its supplement (the chips, or None) at
        the other. */
      hgroup {
        align-items: baseline;
        display: flex;
        gap: 0.5rem;
        justify-content: space-between;
        padding: 0.5rem 0.75rem 0;
      }
      hgroup h2,
      hgroup .supplement {
        margin: 0;
      }
      hgroup .supplement {
        align-items: baseline;
        display: flex;
        gap: 0.5rem;
      }
      .chip {
        align-items: center;
        border: 1px solid currentColor;
        border-radius: 999px;
        display: inline-flex;
        font-size: 0.8rem;
        gap: 0.3rem;
        padding-block: 0.05rem;
        padding-inline: 0.5rem;
        position: relative;
      }
      .chip.error {
        color: var(--ce-error);
      }
      .chip.warning {
        color: var(--ce-warning);
      }
      .visually-hidden {
        block-size: 1px;
        clip-path: inset(50%);
        inline-size: 1px;
        overflow: hidden;
        position: absolute;
        white-space: nowrap;
      }
      .body {
        overflow: auto;
        padding: 0.5rem 0.75rem;
      }
      ul {
        margin: 0;
        padding-inline-start: 1.1rem;
      }
      li {
        margin-block-end: 0.25rem;
      }
    `,
  ];

  override render() {
    const outcome = store.exportOutcome;
    const errors = store.issues.filter((i) => i.severity === "error").length;
    const warnings = store.issues.length - errors;
    return html`
      <hgroup>
        <h2>Problems</h2>
        ${errors === 0 && warnings === 0 ? null : html`
          <p class="supplement">
          ${errors > 0
            ? html`
              <span
                class="chip error"
                title=${counted(errors, ERROR)}
              >${errorIcon(14)}<span class="count">${errors}</span><span
                                class="visually-hidden"
                              >${plural(errors, ERROR)}</span></span>
            `
            : null}
          ${warnings > 0
            ? html`
              <span
                class="chip warning"
                title=${counted(warnings, WARNING)}
              >${warningIcon(14)}<span class="count">${warnings}</span><span
                                class="visually-hidden"
                              >${plural(warnings, WARNING)}</span></span>
            `
            : null}
          </p>
        `}
      </hgroup>
      <div class="body">
        ${outcome?.refused.length
          ? html`
            <p class="error">Export refused:</p>
            <ul>${outcome.refused.map(
              (r) => html`<li class="error">${r.path}: ${r.reason}</li>`,
            )}</ul>
          `
          : null}
        ${outcome?.ok
          ? html`
            <p>Wrote ${counted(outcome.written.length, FILE)}:</p>
            <ul>${outcome.written.map((w) => html`<li>${w}</li>`)}</ul>
          `
          : null}
        ${store.issues.length === 0
          ? html`<p class="muted">No problems found.</p>`
          : html`<ul>${
            store.issues.map(
              (i) =>
                html`<li class=${i.severity}><strong>${i.severity}</strong>
                ${i.path}: ${i.message}</li>`,
            )
          }</ul>`}
      </div>
    `;
  }
}

customElements.define("ce-problems", CeProblems);
