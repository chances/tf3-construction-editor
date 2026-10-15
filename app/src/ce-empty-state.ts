import { css, html, LitElement, type TemplateResult } from "lit";
import { sharedStyles } from "./styles.ts";

/** Fills its container with an illustration, a heading, and a muted hint. */
export class CeEmptyState extends LitElement {
  static override properties = {
    heading: { type: String },
    text: { type: String },
    illustration: { attribute: false },
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
      h2 {
        color: var(--ce-text);
        font-size: 1.1rem;
        letter-spacing: normal;
        margin: 0;
        text-transform: none;
      }
      p {
        color: var(--ce-muted);
        margin: 0;
        max-inline-size: 28ch;
      }
    `,
  ];

  declare heading: string;
  declare text: string;
  declare illustration: TemplateResult | undefined;

  constructor() {
    super();
    this.heading = "";
    this.text = "";
  }

  override render() {
    return html`
      ${this.illustration ?? null}
      <h2>${this.heading}</h2>
      <p>${this.text}</p>
      <slot></slot>
    `;
  }
}

customElements.define("ce-empty-state", CeEmptyState);
