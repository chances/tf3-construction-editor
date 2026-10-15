import { css, html, LitElement } from "lit";
import { errorIcon } from "./icons.ts";
import { sharedStyles } from "./styles.ts";

/**
 * Fills its container with an error icon, a heading that names what is wrong,
 * and the slotted explanation with the next step.
 */
export class CeErrorState extends LitElement {
  static override properties = {
    heading: { type: String },
  };
  static override styles = [
    sharedStyles,
    css`
      :host {
        align-content: center;
        background: var(--ce-surface);
        box-sizing: border-box;
        display: grid;
        gap: 0.75rem;
        justify-items: center;
        min-block-size: 0;
        padding: 1.5rem;
        text-align: center;
      }
      .icon {
        color: var(--ce-error);
        display: inline-flex;
      }
      h2 {
        color: var(--ce-text);
        font-size: 1.1rem;
        letter-spacing: normal;
        margin: 0;
        text-transform: none;
      }
      .text {
        color: var(--ce-muted);
        max-inline-size: min(60ch, 100%);
      }
      .text ::slotted(p) {
        margin: 0;
      }
    `,
  ];

  declare heading: string;

  constructor() {
    super();
    this.heading = "";
  }

  override render() {
    return html`
      <span class="icon" aria-hidden="true">${errorIcon(40)}</span>
      <h2>${this.heading}</h2>
      <div class="text"><slot></slot></div>
    `;
  }
}

customElements.define("ce-error-state", CeErrorState);
