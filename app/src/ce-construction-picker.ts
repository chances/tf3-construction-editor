import { css, html, LitElement } from "lit";
import { isValidResourceName, toResourceId } from "@cedit/schema";
import "./ce-empty-state.ts";
import { cardStyles } from "./card-styles.ts";
import { plusIcon, trashIcon } from "./icons.ts";
import { constructionsIllustration } from "./illustrations.ts";
import { observer } from "./observer.ts";
import { store } from "./state.ts";
import { sharedStyles } from "./styles.ts";

/** Wizard step 3: choose a construction */
export class CeConstructionPicker extends observer(LitElement) {
  static override styles = [
    sharedStyles,
    cardStyles,
    css`
      :host {
        display: block;
      }
      form {
        margin-block-start: 1rem;
      }
      .actions {
        display: flex;
        gap: 0.5rem;
        justify-content: space-between;
        margin-block-start: 1rem;
      }
      .actions .group {
        display: flex;
        gap: 0.5rem;
      }
    `,
  ];

  // The form lives in the store so a reload keeps what was typed.
  get name(): string {
    return store.draft.constructionName;
  }
  set name(value: string) {
    store.draft.constructionName = value;
  }
  get creating(): boolean {
    return store.draft.creatingConstruction;
  }
  set creating(value: boolean) {
    store.draft.creatingConstruction = value;
  }

  #focused = false;

  /** With no constructions, the name field is the only action: focus it. */
  override updated() {
    const empty = store.loaded?.constructions.length === 0;
    if (!empty) {
      this.#focused = false;
      return;
    }
    if (this.#focused) return;
    const input = this.renderRoot.querySelector<HTMLInputElement>("form input");
    if (!input) return;
    input.focus();
    this.#focused = true;
  }

  override render() {
    const loaded = store.loaded;
    if (!loaded) return null;
    const items = loaded.constructions;
    const hasItems = items.length > 0;
    const showForm = this.creating || !hasItems;
    return html`
      <h2>Choose a Construction</h2>
      <p class="muted">Open a construction, or create a new one.</p>
      ${hasItems && showForm ? null : hasItems
        ? html`
          <ul class="cards">
            <li>
              <button
                class="card new"
                @click=${() => (this.creating = true)}
              >
                ${plusIcon(20)}
                <strong>New Construction</strong>
              </button>
            </li>
            ${items.map(
              (c) =>
                html`
                  <li>
                    <button
                      class="card deletable"
                      title=${c.id}
                      @click=${() => store.openConstruction(c.id)}
                    >
                      <strong>${c.name}</strong>
                      <span class="muted">${c.id}</span>
                    </button>
                    <button
                      class="card-delete"
                      aria-label=${`Delete ${c.name}`}
                      title=${`Delete ${c.name}`}
                      @click=${() => store.requestDelete(c.id)}
                    >${trashIcon(14)}</button>
                  </li>
                `,
            )}
          </ul>
        `
        : html`
          <ce-empty-state
            heading="No Constructions"
            text="Give the first one a name below."
            .illustration=${constructionsIllustration}
          ></ce-empty-state>
        `}
      ${showForm ? this.#form(hasItems) : html`
        <div class="actions">
          <button @click=${() => store.goTo("details")}>Back</button>
        </div>
      `}
      ${store.message ? html`<p class="error">${store.message}</p>` : null}
    `;
  }

  #form(hasItems: boolean) {
    const id = toResourceId(this.name);
    const taken = store.loaded?.constructions.some((c) => c.id === id) ?? false;
    const ok = isValidResourceName(id) && !taken;
    return html`
      <form @submit=${this.#create}>
        <h2>New Construction</h2>
        <label class="field"><span>Name</span><input
            .value=${this.name}
            @input=${(
              e: Event,
            ) => (this.name = (e.target as HTMLInputElement).value)}
          /></label>
        <p class="muted">
          ${id === ""
            ? "File name appears here."
            : taken
            ? `A construction named ${id} already exists.`
            : `File name: ${id}`}
        </p>
        <div class="actions">
          <button type="button" @click=${() =>
            hasItems ? (this.creating = false) : store.goTo("details")}>
            ${hasItems ? "Cancel" : "Back"}
          </button>
          <button class="primary" ?disabled=${!ok}>Create Construction</button>
        </div>
      </form>
    `;
  }

  #create(event: Event) {
    event.preventDefault();
    const id = toResourceId(this.name);
    if (!isValidResourceName(id)) return;
    void store.createConstruction(id, this.name.trim());
    this.name = "";
    this.creating = false;
  }
}

customElements.define("ce-construction-picker", CeConstructionPicker);
