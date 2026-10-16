import { css, html, LitElement } from "lit";
import { isValidModId, titleCaseId } from "@cedit/schema";
import "./ce-empty-state.ts";
import { folderIcon, plusIcon, spinnerIcon } from "./icons.ts";
import { modsIllustration } from "./illustrations.ts";
import { observer } from "./observer.ts";
import { store } from "./state.ts";
import { cardStyles } from "./card-styles.ts";
import { sharedStyles } from "./styles.ts";

/** Wizard step 1: choose a mod, or create one. */
export class CeModPicker extends observer(LitElement) {
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
        margin-block-start: 1rem;
      }
      div.folder {
        align-items: center;
        color: var(--ce-muted);
        display: flex;
        font-size: 13px;
        font-weight: 600;
        gap: 0.5rem;
        margin-block: 0;
      }
      div.folder .path {
        min-inline-size: 0;
        overflow-wrap: anywhere;
      }
      button.icon-button {
        align-items: center;
        aspect-ratio: 1;
        block-size: 1.7rem;
        display: inline-flex;
        flex: none;
        justify-content: center;
        padding: 0;
      }
      .spin {
        animation: spin 0.9s linear infinite;
        display: inline-grid;
      }
      @media (prefers-reduced-motion: reduce) {
        .spin {
          animation-duration: 3s;
        }
      }
      /* A span child of the label, so it needs the label rule's weight. */
      .field > .problem {
        color: var(--ce-error);
        font-size: 11px;
        overflow-wrap: anywhere;
      }
      input[aria-invalid="true"] {
        border-color: var(--ce-error);
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ];

  // The form lives in the store so a reload keeps what was typed.
  get modId(): string {
    return store.draft.modId;
  }
  set modId(value: string) {
    store.draft.modId = value;
  }
  get name(): string {
    return store.draft.modName;
  }
  set name(value: string) {
    store.draft.modName = value;
  }
  get creating(): boolean {
    return store.draft.creatingMod;
  }
  set creating(value: boolean) {
    store.draft.creatingMod = value;
  }

  override render() {
    const hasMods = store.mods.length > 0;
    const showForm = this.creating || !hasMods;
    return html`
      <hgroup>
        <h2>Choose a Mod</h2>
        <div class="folder">
          <button
            type="button"
            class="icon-button"
            aria-label="Choose a folder that contains your mods"
            title="Change Mods Folder"
            ?disabled=${store.choosingFolder !== null}
            @click=${() => store.chooseFolder("modsRoot")}
          >
            ${store.choosingFolder === "modsRoot"
              ? html`
                <span class="spin" aria-hidden="true"
                >${spinnerIcon(16)}</span>
              `
              : folderIcon(16)}
          </button>
          <span class="path">${store.modsRoot || "loading"}</span>
        </div>
      </hgroup>
      <p class="muted">
        ${!hasMods || showForm
          ? "Create the mod that will contain constructions."
          : "Open the mod you want to work on, or start a new one."}
      </p>
      ${hasMods && showForm ? null : hasMods
        ? html`
          <ul class="cards">
            <li>
              <button
                class="card new"
                @click=${() => (this.creating = true)}
              >
                ${plusIcon(20)}
                <strong>New Mod</strong>
              </button>
            </li>
            ${store.mods.map(
              (m) =>
                html`
                  <li>
                    <button
                      class="card"
                      title=${m.modId ?? m.dirName}
                      @click=${() => store.openMod(m.dirName)}
                    >
                      <strong>${m.name ?? m.dirName}</strong>
                      <span class="muted">${m.modId ?? m.dirName}</span>
                    </button>
                  </li>
                `,
            )}
          </ul>
        `
        : html`
          <ce-empty-state
            heading="No Mods"
            text="Create a mod below."
            .illustration=${modsIllustration}
          ></ce-empty-state>
        `}
      ${showForm ? this.#form(hasMods) : null}
      ${store.message ? html`<p class="error">${store.message}</p>` : null}
    `;
  }

  #form(canCancel: boolean) {
    const valid = isValidModId(this.modId);
    // An empty field is not an error yet. Create Mod stays disabled for it.
    const problem = this.modId !== "" && !valid
      ? "Use only lowercase letters (a-z), digits (0-9), and underscores (_)."
      : "";
    return html`
      <form @submit=${this.#create}>
        <h2>New Mod</h2>
        <label class="field"><span>Mod ID (a-z, 0-9, _)</span><input
            aria-invalid=${problem ? "true" : "false"}
            aria-describedby=${problem ? "mod-id-problem" : ""}
            .value=${this.modId}
            @input=${(
              e: Event,
            ) => (this.modId = (e.target as HTMLInputElement).value)}
          />${problem
            ? html`<span class="problem" id="mod-id-problem" role="alert">${problem}</span>`
            : null}</label>
        <label class="field"><span>Name</span><input
            placeholder=${titleCaseId(this.modId)}
            .value=${this.name}
            @input=${(
              e: Event,
            ) => (this.name = (e.target as HTMLInputElement).value)}
          /></label>
        <div class="actions">
          <button class="primary" ?disabled=${!valid}>Create Mod</button>
          ${canCancel
            ? html`<button type="button" @click=${() => (this.creating =
              false)}>Cancel</button>`
            : null}
        </div>
      </form>
    `;
  }

  #create(event: Event) {
    event.preventDefault();
    if (!isValidModId(this.modId)) return;
    const name = this.name.trim() || titleCaseId(this.modId);
    void store.createMod(this.modId, name);
  }
}

customElements.define("ce-mod-picker", CeModPicker);
