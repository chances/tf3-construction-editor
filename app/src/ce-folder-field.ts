import { css, html, LitElement } from "lit";
import { folderIcon } from "./icons.ts";
import { shortenFolder } from "./paths.ts";
import { sharedStyles } from "./styles.ts";

/**
 * Text field for a folder path under the mod's `content/`, with a button that
 * asks its owner to open the folder dialog by firing `choose`. Focused, it
 * shows the full path from the mod folder (`root` plus the value). Unfocused,
 * it shows the same path and shortens it from the middle only when the path
 * is wider than the input. Fires `change` with `{ value }`, the
 * folder without `root`, on a committed edit.
 */
export class CeFolderField extends LitElement {
  static override properties = {
    label: { type: String },
    value: { type: String },
    root: { type: String },
    choosing: { type: Boolean },
    focused: { state: true },
    overflows: { state: true },
  };
  static override styles = [
    sharedStyles,
    css`
      :host {
        display: block;
      }
      /* The label's field span rule would mute the wrapper's text. */
      .field > .input-suffix {
        color: var(--ce-text);
        font-size: 13px;
      }
      input {
        text-overflow: ellipsis;
      }
    `,
  ];

  declare label: string;
  /** The folder under `root`, as the document stores it. */
  declare value: string;
  /**
   * The path the folder sits under, relative to the mod folder and ending in
   * `/`, for example `./content/`. It leads the text shown in the field.
   */
  declare root: string;
  /** True while the folder dialog is open. The owner sets it. */
  declare choosing: boolean;
  declare focused: boolean;
  /** True when the full path is wider than the input, so it is shortened. */
  declare overflows: boolean;

  constructor() {
    super();
    this.label = "";
    this.value = "";
    this.root = "";
    this.choosing = false;
    this.focused = false;
    this.overflows = false;
  }

  #emit(value: string) {
    this.dispatchEvent(
      new CustomEvent("change", {
        detail: { value },
        bubbles: true,
        composed: true,
      }),
    );
  }

  /** The value as the field shows it focused: `root` plus the folder. */
  get #full() {
    return `${this.root}${this.value}`;
  }

  #resize: ResizeObserver | null = null;

  override connectedCallback() {
    super.connectedCallback();
    if (typeof ResizeObserver === "undefined") return;
    // A new width may fit the full path again, so measure from the full path.
    this.#resize = new ResizeObserver(() => {
      if (this.overflows) this.overflows = false;
    });
    this.#resize.observe(this);
  }

  override disconnectedCallback() {
    this.#resize?.disconnect();
    this.#resize = null;
    super.disconnectedCallback();
  }

  protected override willUpdate(changed: Map<string, unknown>) {
    if (changed.has("value") || changed.has("root")) this.overflows = false;
  }

  /**
   * An unfocused field shows the full path. When the full path is wider than
   * the input, the next render shortens it.
   */
  protected override updated() {
    if (this.focused || this.overflows) return;
    const input = this.renderRoot.querySelector("input");
    if (!input || input.scrollWidth <= input.clientWidth) return;
    // Set after this update finishes, so Lit does not warn about it.
    queueMicrotask(() => {
      this.overflows = true;
    });
  }

  override render() {
    const full = this.#full;
    const shown = !this.focused && this.overflows ? shortenFolder(full) : full;
    return html`
      <label class="field">
        <span>${this.label}</span>
        <span class="input-suffix">
          <input
            autocomplete="off"
            spellcheck="false"
            title=${this.focused ? "" : full}
            .value=${shown}
            @focus=${() => (this.focused = true)}
            @blur=${() => (this.focused = false)}
            @change=${(e: Event) => {
              // The shown text starts with `root`. The value does not.
              let next = (e.target as HTMLInputElement).value.trim();
              if (this.root !== "" && next.startsWith(this.root)) {
                next = next.slice(this.root.length);
              }
              if (next !== this.value) this.#emit(next);
            }}
          />
          <button
            type="button"
            class="icon"
            title=${this.choosing
              ? "The folder dialog is already open"
              : "Choose a Folder"}
            aria-label=${`Opens a dialog that sets the ${this.label}`}
            ?disabled=${this.choosing}
            @click=${(e: Event) => {
              e.preventDefault();
              this.dispatchEvent(new CustomEvent("choose"));
            }}
          >${folderIcon(14)}</button>
        </span>
      </label>
    `;
  }
}

customElements.define("ce-folder-field", CeFolderField);
