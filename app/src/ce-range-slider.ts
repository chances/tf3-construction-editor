import { css, html, LitElement } from "lit";
import { historyIcon } from "./icons.ts";
import { sharedStyles } from "./styles.ts";
import { applyTypedYear } from "./year-range.ts";

/**
 * Offset in percent along the rail. The native thumb's centre travels inside
 * the input by half a thumb at each end, so the rail is inset by 8px to match.
 */
const rail = (percent: number) =>
  `calc(8px + (100% - 16px) * ${percent / 100})`;

export interface RangeChange {
  /** `0` when the start thumb sits at the minimum stop. */
  from: number;
  /** `undefined` when the end thumb sits at the maximum stop (forever). */
  to: number | undefined;
}

/**
 * Two-thumb range slider over the whole years `min..max`. One stop below `min`
 * is the start label ("always") and reports `from: 0`. One stop above `max` is
 * labelled `foreverLabel` and reports `to: undefined`, so a range can run
 * forever from its start. Fires `change` with a `RangeChange` detail when a
 * thumb is released.
 */
export class CeRangeSlider extends LitElement {
  static override properties = {
    min: { type: Number },
    max: { type: Number },
    from: { type: Number },
    to: { type: Number },
    startLabel: { type: String },
    foreverLabel: { type: String },
    fromLabel: { type: String },
    toLabel: { type: String },
    low: { state: true },
    high: { state: true },
    editing: { state: true },
  };
  static override styles = [
    sharedStyles,
    css`
      :host {
        display: block;
      }
      .readout {
        align-items: center;
        display: flex;
        justify-content: space-between;
        margin-block-end: 0.25rem;
      }
      /* A label that becomes a number box on hover, like the breadcrumb. */
      button.year {
        background: transparent;
        border: 1px solid transparent;
        border-radius: 4px;
        color: inherit;
        font: inherit;
        min-inline-size: 3.5rem;
        padding-block: 0.1rem;
        padding-inline: 0.4rem;
      }
      button.year:hover,
      button.year:focus-visible {
        border-color: var(--ce-border);
      }
      .year-edit {
        position: relative;
      }
      .year-edit input[type="number"] {
        box-sizing: border-box;
        font: inherit;
        inline-size: 6.5rem;
        padding-block: 0.1rem;
        padding-inline: 0.4rem;
      }
      .year-edit.has-prefix input[type="number"] {
        padding-inline-start: 1.7rem;
      }
      .year-edit button.prefix {
        align-items: center;
        background: transparent;
        border: 0;
        color: var(--ce-muted);
        display: inline-flex;
        inset-block: 2px;
        inset-inline-start: 3px;
        padding: 0 0.2rem;
        position: absolute;
      }
      .year-edit button.prefix:hover,
      .year-edit button.prefix:focus-visible {
        color: var(--ce-accent, currentColor);
      }
      .slider {
        block-size: 1.5rem;
        position: relative;
      }
      .track,
      .fill {
        block-size: 4px;
        border-radius: 2px;
        inset-block-start: 50%;
        position: absolute;
        translate: 0 -50%;
      }
      .track {
        background: var(--ce-border);
        inset-inline: 8px;
      }
      .fill {
        background: var(--ce-accent, currentColor);
      }
      input[type="range"] {
        appearance: none;
        background: transparent;
        block-size: 100%;
        border: 0;
        border-radius: 0;
        inline-size: 100%;
        inset: 0;
        margin: 0;
        outline: none;
        padding: 0;
        pointer-events: none;
        position: absolute;
      }
      input[type="range"]::-webkit-slider-thumb {
        appearance: none;
        background: var(--ce-surface);
        block-size: 16px;
        border: 2px solid var(--ce-accent, currentColor);
        border-radius: 50%;
        box-sizing: border-box;
        cursor: grab;
        inline-size: 16px;
        pointer-events: auto;
      }
      input[type="range"]::-moz-range-thumb {
        background: var(--ce-surface);
        block-size: 16px;
        border: 2px solid var(--ce-accent, currentColor);
        border-radius: 50%;
        box-sizing: border-box;
        cursor: grab;
        inline-size: 16px;
        pointer-events: auto;
      }
      input[type="range"]:focus-visible::-webkit-slider-thumb {
        outline: 2px solid var(--ce-accent, currentColor);
        outline-offset: 2px;
      }
      input[type="range"]:focus-visible::-moz-range-thumb {
        outline: 2px solid var(--ce-accent, currentColor);
        outline-offset: 2px;
      }
    `,
  ];

  declare min: number;
  declare max: number;
  declare from: number;
  declare to: number | undefined;
  declare startLabel: string;
  declare foreverLabel: string;
  declare fromLabel: string;
  declare toLabel: string;
  /** Thumb positions while a drag is in progress, in `min..max`. */
  declare low: number | null;
  declare high: number | null;
  /** The year label that is currently a number box. */
  declare editing: "from" | "to" | null;

  constructor() {
    super();
    this.min = 0;
    this.max = 100;
    this.from = 0;
    this.to = undefined;
    this.startLabel = "Start";
    this.foreverLabel = "Forever";
    this.fromLabel = "From";
    this.toLabel = "To";
    this.low = null;
    this.high = null;
    this.editing = null;
  }

  /** The stop below the first year. It means "always" (no start bound). */
  get #floor(): number {
    return this.min - 1;
  }

  /** The stop above the last year. It means "forever" (no end bound). */
  get #ceil(): number {
    return this.max + 1;
  }

  get #low(): number {
    if (this.low !== null) return this.low;
    if (this.from <= 0) return this.#floor;
    return Math.min(Math.max(this.from, this.min), this.max);
  }

  get #high(): number {
    if (this.high !== null) return this.high;
    if (this.to === undefined) return this.#ceil;
    return Math.min(Math.max(this.to, this.min), this.max);
  }

  #label(position: number, isHigh: boolean): string {
    if (isHigh && position >= this.#ceil) return this.foreverLabel;
    if (!isHigh && position <= this.#floor) return this.startLabel;
    return String(position);
  }

  #drag(isHigh: boolean, e: Event) {
    const value = Number((e.target as HTMLInputElement).value);
    if (isHigh) this.high = Math.max(value, this.#low);
    else this.low = Math.min(value, this.#high);
  }

  #emit(from: number, to: number | undefined) {
    this.dispatchEvent(
      new CustomEvent<RangeChange>("change", {
        detail: { from, to },
        bubbles: true,
        composed: true,
      }),
    );
  }

  #commitTyped(side: "from" | "to", raw: string) {
    const next = applyTypedYear({ from: this.from, to: this.to }, side, raw, {
      min: this.min,
      max: this.max,
    });
    if (next.from !== this.from || next.to !== this.to) {
      this.#emit(next.from, next.to);
    }
  }

  #stopEditing() {
    this.editing = null;
  }

  #yearCell(side: "from" | "to", label: string) {
    if (this.editing !== side) {
      const name = side === "from" ? this.fromLabel : this.toLabel;
      return html`
        <button
          class="year"
          aria-label=${`${name}: ${label}`}
          title=${`Edit ${name}`}
          @click=${() => (this.editing = side)}
        >${label}</button>
      `;
    }
    const value = side === "from"
      ? String(this.from)
      : this.to === undefined
      ? ""
      : String(this.to);
    const commit = (e: Event) => {
      if (this.editing !== side) return;
      const raw = (e.target as HTMLInputElement).value;
      this.#stopEditing();
      this.#commitTyped(side, raw);
    };
    // The prefix button sets the open end of its side: always or forever.
    const openLabel = side === "from" ? this.startLabel : this.foreverLabel;
    return html`
      <span class="year-edit has-prefix">
        <button
          class="prefix"
          aria-label=${openLabel}
          title=${openLabel}
          @mousedown=${(e: Event) => e.preventDefault()}
          @click=${() => {
            this.#stopEditing();
            this.#commitTyped(side, "");
          }}
        >${historyIcon(14)}</button>
        <input
          type="number"
          min=${this.min}
          max=${this.max}
          step="1"
          aria-label=${side === "from" ? this.fromLabel : this.toLabel}
          placeholder=${side === "to" ? this.foreverLabel : ""}
          .value=${value}
          @blur=${commit}
          @keydown=${(e: KeyboardEvent) => {
            const input = e.target as HTMLInputElement;
            if (e.key === "Enter") input.blur();
            else if (e.key === "Escape") this.#stopEditing();
            else if (
              e.key === "ArrowDown" && side === "to" && input.value === ""
            ) {
              // Forever sits above the last year, so stepping down starts there.
              e.preventDefault();
              input.value = String(this.max);
              input.select();
            }
          }}
        />
      </span>
    `;
  }

  protected override updated(changed: Map<string, unknown>) {
    if (changed.has("editing") && this.editing !== null) {
      const input = this.renderRoot.querySelector<HTMLInputElement>(
        ".year-edit input",
      );
      input?.focus();
      input?.select();
    }
  }

  #commit() {
    const low = this.#low;
    const high = this.#high;
    this.low = null;
    this.high = null;
    const detail: RangeChange = {
      from: low <= this.#floor ? 0 : low,
      to: high >= this.#ceil ? undefined : high,
    };
    this.dispatchEvent(
      new CustomEvent<RangeChange>("change", {
        detail,
        bubbles: true,
        composed: true,
      }),
    );
  }

  override render() {
    const low = this.#low;
    const high = this.#high;
    const span = this.#ceil - this.#floor || 1;
    const start = ((low - this.#floor) / span) * 100;
    const end = ((high - this.#floor) / span) * 100;
    return html`
      <div class="readout">
        ${this.#yearCell("from", this.#label(low, false))}
        ${this.#yearCell("to", this.#label(high, true))}
      </div>
      <div class="slider">
        <div class="track"></div>
        <div
          class="fill"
          style="inset-inline-start: ${rail(start)}; inset-inline-end: ${rail(
            100 - end,
          )}"
        ></div>
        <input
          type="range"
          aria-label=${this.fromLabel}
          aria-valuetext=${this.#label(low, false)}
          min=${this.#floor}
          max=${this.#ceil}
          step="1"
          .value=${String(low)}
          @input=${(e: Event) => this.#drag(false, e)}
          @change=${(e: Event) => {
            e.stopPropagation();
            this.#commit();
          }}
        />
        <input
          type="range"
          aria-label=${this.toLabel}
          aria-valuetext=${this.#label(high, true)}
          min=${this.#floor}
          max=${this.#ceil}
          step="1"
          .value=${String(high)}
          @input=${(e: Event) => this.#drag(true, e)}
          @change=${(e: Event) => {
            e.stopPropagation();
            this.#commit();
          }}
        />
      </div>
    `;
  }
}

customElements.define("ce-range-slider", CeRangeSlider);
