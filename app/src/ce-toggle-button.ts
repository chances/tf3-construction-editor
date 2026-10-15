import { css, html, LitElement } from "lit";
import { toggleIcons } from "./icons.ts";
import { sharedStyles } from "./styles.ts";

/**
 * A button that holds an on or off state. It sets `aria-pressed` and fires a
 * `change` event with the new state in `detail`. The `variant` holds one or
 * more words: "icon" draws only the icon, with `title` as its tooltip and
 * `label` as its accessible name, and "subtle" hides the background and border
 * until the button is hovered or focused.
 */
export class CeToggleButton extends LitElement {
  static override properties = {
    icon: { type: String },
    label: { type: String },
    pressed: { type: Boolean, reflect: true },
    variant: { type: String, reflect: true },
    disabled: { type: Boolean, reflect: true },
  };
  static override styles = [
    sharedStyles,
    css`
      :host {
        display: inline-flex;
      }
      button {
        align-items: center;
        display: inline-flex;
        gap: 0.4rem;
        justify-content: center;
      }
      /* Same box as the icon buttons beside it, such as the add button. */
      :host([variant~="icon"]) button {
        block-size: 1.5rem;
        box-sizing: border-box;
        inline-size: 1.5rem;
        line-height: 1;
        padding: 0;
      }
      button[aria-pressed="true"] {
        background: var(--ce-selected);
        border-color: var(--ce-accent);
      }
      /* A subtle toggle shows its state by its icon, not by its chrome. */
      button.subtle[aria-pressed="true"]:not(:hover):not(:focus-visible) {
        background: transparent;
        border-color: transparent;
      }
    `,
  ];

  declare icon: keyof typeof toggleIcons | "";
  declare label: string;
  declare pressed: boolean;
  declare variant: string;
  declare disabled: boolean;

  constructor() {
    super();
    this.icon = "";
    this.label = "";
    this.pressed = false;
    this.variant = "normal";
    this.disabled = false;
  }

  #toggle() {
    this.pressed = !this.pressed;
    this.dispatchEvent(
      new CustomEvent<boolean>("change", {
        detail: this.pressed,
        bubbles: true,
        composed: true,
      }),
    );
  }

  override render() {
    const draw = this.icon ? toggleIcons[this.icon] : undefined;
    const tokens = this.variant.split(/\s+/);
    const iconOnly = tokens.includes("icon");
    const icon = draw ? draw(iconOnly ? 12 : 16) : null;
    const name = this.label || (this.title ? `Toggle ${this.title}` : "");
    return html`
      <button
        type="button"
        part="button"
        class=${tokens.includes("subtle") ? "subtle" : ""}
        title=${this.title}
        aria-label=${name || undefined}
        aria-pressed=${String(this.pressed)}
        ?disabled=${this.disabled}
        @click=${this.#toggle}
      >
        ${icon}${iconOnly ? null : html`<slot></slot>`}
      </button>
    `;
  }
}

customElements.define("ce-toggle-button", CeToggleButton);
