import { css, html, LitElement } from "lit";
import { chevronDownIcon, chevronUpIcon } from "./icons.ts";
import { sharedStyles } from "./styles.ts";

export interface SpinnerChange {
  /** `undefined` when the box is empty. */
  value: number | undefined;
}

/**
 * A number box with its own up and down buttons. The buttons sit a gap away
 * from the digits, which the native spin arrows do not allow. Fires `change`
 * with a `SpinnerChange` detail when a value is typed or stepped.
 */
export class CeSpinner extends LitElement {
  static override shadowRootOptions = {
    ...LitElement.shadowRootOptions,
    delegatesFocus: true,
  };
  static override properties = {
    value: { type: Number },
    step: { type: Number },
    min: { type: Number },
    max: { type: Number },
    label: { type: String },
    disabled: { type: Boolean, reflect: true },
    fill: { type: Boolean, reflect: true },
  };
  static override styles = [
    sharedStyles,
    css`
      :host {
        /* The inset from the box border to the digits. The buttons' glyph sits
          the same distance from the border on the other side. */
        --edge: 0.4rem;
        --glyph: 12px;
        align-items: center;
        display: inline-flex;
        gap: var(--edge);
      }
      :host([fill]) {
        display: flex;
        flex: 1;
        min-inline-size: 0;
      }
      /* A percentage width counts as zero for the box's minimum size, so the
        input's default width does not stop the box from shrinking. */
      :host([fill]) input {
        field-sizing: fixed;
        flex: 1;
        inline-size: 100%;
        min-inline-size: 0;
      }
      :host([disabled]) {
        opacity: 0.55;
      }
      input {
        appearance: textfield;
        background: transparent;
        border: 0;
        field-sizing: content;
        min-inline-size: 3ch;
        outline: 0;
        padding-inline: var(--edge);
      }
      input::-webkit-inner-spin-button,
      input::-webkit-outer-spin-button {
        appearance: none;
        margin: 0;
      }
      /* The host's container draws the one focus outline, so no part of the
        spinner draws its own. */
      input:focus-visible {
        outline: 0;
      }
      /* A chevron covers half of its icon box wide and a quarter high, so a
        quarter of its size sits empty at each side and three eighths above and
        below. The margins remove that overhang, and the glyphs sit --edge from
        the border on all three outer sides. */
      .steps {
        align-self: stretch;
        display: grid;
        grid-template-rows: 1fr 1fr;
        margin-inline-end: calc(var(--edge) - var(--glyph) * 0.25);
      }
      .steps svg {
        block-size: var(--glyph);
        inline-size: var(--glyph);
        margin-block: calc(var(--glyph) * -0.375);
        overflow: visible;
      }
      button.up {
        align-items: flex-start;
        padding-block-start: var(--edge);
      }
      button.down {
        align-items: flex-end;
        padding-block-end: var(--edge);
      }
      button:focus-visible {
        background: var(--ce-surface-2);
        color: inherit;
        outline: 0;
      }
      button {
        align-items: center;
        background: transparent;
        border: 0;
        border-radius: 3px;
        color: var(--ce-muted);
        display: inline-flex;
        justify-content: center;
        padding: 0;
      }
      button:hover:not(:disabled) {
        color: inherit;
      }
    `,
  ];

  declare value: number | undefined;
  /** `null` accepts any value; the buttons then move by 1. */
  declare step: number | null;
  declare min: number | undefined;
  declare max: number | undefined;
  declare label: string;
  declare disabled: boolean;
  /** Grows the box to the full width of its container, digits at the start. */
  declare fill: boolean;

  constructor() {
    super();
    this.value = undefined;
    this.step = 1;
    this.min = undefined;
    this.max = undefined;
    this.label = "";
    this.disabled = false;
    this.fill = false;
  }

  #emit(value: number | undefined) {
    this.dispatchEvent(
      new CustomEvent<SpinnerChange>("change", {
        detail: { value },
        bubbles: true,
        composed: true,
      }),
    );
  }

  #typed(e: Event) {
    // The native change event does not cross the shadow boundary, and this
    // element reports its own.
    e.stopPropagation();
    const raw = (e.target as HTMLInputElement).value.trim();
    if (raw === "") return this.#emit(undefined);
    const n = Number(raw);
    if (Number.isFinite(n)) this.#emit(n);
  }

  #bump(direction: 1 | -1) {
    const next = (this.value ?? 0) + direction * (this.step ?? 1);
    const rounded = Number(next.toFixed(10));
    const lower = this.min === undefined
      ? rounded
      : Math.max(rounded, this.min);
    this.#emit(this.max === undefined ? lower : Math.min(lower, this.max));
  }

  override render() {
    const atMax = this.value !== undefined && this.max !== undefined &&
      this.value >= this.max;
    const atMin = this.value !== undefined && this.min !== undefined &&
      this.value <= this.min;
    return html`
      <input
        type="number"
        part="input"
        step=${this.step ?? "any"}
        min=${this.min ?? ""}
        max=${this.max ?? ""}
        aria-label=${this.label}
        ?disabled=${this.disabled}
        .value=${this.value === undefined ? "" : String(this.value)}
        @change=${(e: Event) => this.#typed(e)}
      />
      <span class="steps">
        <button
          type="button"
          class="up"
          aria-label=${`Increase ${this.label} by ${this.step ?? 1}`}
          title=${`Increase ${this.label}`}
          ?disabled=${atMax || this.disabled}
          @click=${() => this.#bump(1)}
        >${chevronUpIcon(12)}</button>
        <button
          type="button"
          class="down"
          aria-label=${`Decrease ${this.label} by ${this.step ?? 1}`}
          title=${`Decrease ${this.label}`}
          ?disabled=${atMin || this.disabled}
          @click=${() => this.#bump(-1)}
        >${chevronDownIcon(12)}</button>
      </span>
    `;
  }
}

customElements.define("ce-spinner", CeSpinner);
