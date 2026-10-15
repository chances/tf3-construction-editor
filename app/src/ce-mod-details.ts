import { css, html, LitElement } from "lit";
import type { Severity } from "@cedit/schema";
import {
  checkboxField,
  numberField,
  selectField,
  textAreaField,
  textField,
} from "./fields.ts";
import { trashIcon } from "./icons.ts";
import { observer } from "./observer.ts";
import { store } from "./state.ts";
import { sharedStyles } from "./styles.ts";

const SEVERITIES: readonly Severity[] = ["None", "Warning", "Critical"];

/** Wizard step 2: the mod's own details. */
export class CeModDetails extends observer(LitElement) {
  static override styles = [
    sharedStyles,
    css`
      :host {
        display: block;
      }
      details {
        border: 1px solid var(--ce-border);
        border-radius: 4px;
        margin-block-end: 1rem;
        padding: 0.5rem 0.75rem;
      }
      summary {
        cursor: pointer;
        font-weight: 600;
      }
      section {
        margin-block-start: 1rem;
      }
      section h3 {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.06em;
        margin-block: 0 0.5rem;
        text-transform: uppercase;
        color: var(--ce-muted);
      }
      .cols {
        display: grid;
        gap: 0.5rem;
        grid-template-columns: 1fr 1fr;
      }
      .item-row {
        align-items: end;
        display: grid;
        gap: 0.5rem;
        grid-template-columns: minmax(0, 1fr) auto;
      }
      .item-row.author {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
      }
      button.icon-button {
        align-items: center;
        aspect-ratio: 1;
        block-size: 1.7rem;
        display: inline-flex;
        justify-content: center;
        margin-block-end: 0.5rem;
        padding: 0;
      }
      button.icon-button:hover:not(:disabled) {
        border-color: var(--ce-error);
        color: var(--ce-error);
      }
      .actions {
        display: flex;
        gap: 0.5rem;
        justify-content: space-between;
        margin-block-start: 1rem;
      }
    `,
  ];

  /** Icon-only remove button. The label names the item it removes. */
  #removeButton(label: string, onClick: () => void) {
    return html`
      <button
        type="button"
        class="icon-button"
        aria-label=${`${label}. Removes it from this mod.`}
        title=${label}
        @click=${onClick}
      >${trashIcon()}</button>
    `;
  }

  override render() {
    const loaded = store.loaded;
    if (!loaded) return null;
    const { mod, modInfo } = loaded;
    return html`
      <h2>Mod Details</h2>
      <p class="muted">
        Describe the mod. These details are saved as you type.
      </p>
      ${textField(
        "Name (32 max)",
        modInfo.name,
        (v) => store.editMod((_m, info) => (info.name = v)),
      )}
      ${textField(
        "Summary (100 max)",
        modInfo.summary,
        (v) => store.editMod((_m, info) => (info.summary = v)),
      )}
      ${textAreaField(
        "Description",
        modInfo.description,
        (v) => store.editMod((_m, info) => (info.description = v)),
      )}
      <details>
        <summary>Details and Other Metadata</summary>
        <div class="cols">
          ${textField(
            "Mod ID",
            mod.modId,
            (v) => store.editMod((m) => (m.modId = v)),
          )}
          ${numberField(
            "Revision",
            mod.revision,
            (v) => store.editMod((m) => (m.revision = v ?? 1)),
            "1",
          )}
          ${selectField(
            "Severity add",
            mod.severityAdd ?? "None",
            SEVERITIES,
            (v) => store.editMod((m) => (m.severityAdd = v)),
          )}
          ${selectField(
            "Severity remove",
            mod.severityRemove ?? "Warning",
            SEVERITIES,
            (v) => store.editMod((m) => (m.severityRemove = v)),
          )}
          ${checkboxField(
            "Visible",
            mod.visible ?? true,
            (v) => store.editMod((m) => (m.visible = v)),
          )}
          ${checkboxField(
            "Cosmetic",
            mod.cosmetic ?? false,
            (v) => store.editMod((m) => (m.cosmetic = v)),
          )}
        </div>
        ${textField(
          "Tags (comma separated)",
          modInfo.tags.join(", "),
          (v) =>
            store.editMod((_m, info) => {
              info.tags = v.split(",").map((s) => s.trim()).filter(Boolean);
            }),
        )}
        <section>
          <h3>Authors</h3>
          ${modInfo.authors.map(
            (a, i) =>
              html`<div class="item-row author">
                ${
                textField(
                  "Name",
                  a.name,
                  (v) =>
                    store.editMod((_m, info) => (info.authors[i].name = v)),
                )
              }
                ${
                textField(
                  "Role",
                  a.role,
                  (v) =>
                    store.editMod((_m, info) => (info.authors[i].role = v)),
                )
              }
                ${
                this.#removeButton(
                  `Remove Author: ${a.name || "Unnamed"}`,
                  () => store.editMod((_m, info) => info.authors.splice(i, 1)),
                )
              }
              </div>`,
          )}
          <button type="button" @click=${() =>
            store.editMod((_m, info) => {
              info.authors.push({ name: "", role: "CREATOR" });
            })}>
            Add Author
          </button>
        </section>
        ${this.#modRefs(
          "Dependencies",
          "Dependency",
          "Add Dependency",
          mod.dependencies?.map((d) => d.mod.modId) ?? [],
          (i, v) => store.editMod((m) => (m.dependencies![i].mod.modId = v)),
          (i) => store.editMod((m) => m.dependencies!.splice(i, 1)),
          () =>
            store.editMod((m) => {
              m.dependencies = [...(m.dependencies ?? []), {
                mod: { modId: "" },
              }];
            }),
        )}
        ${this.#modRefs(
          "Incompatibilities",
          "Incompatibility",
          "Add Incompatibility",
          mod.incompatibilities?.map((d) => d.mod.modId) ?? [],
          (i, v) =>
            store.editMod((m) => (m.incompatibilities![i].mod.modId = v)),
          (i) => store.editMod((m) => m.incompatibilities!.splice(i, 1)),
          () =>
            store.editMod((m) => {
              m.incompatibilities = [
                ...(m.incompatibilities ?? []),
                { mod: { modId: "" } },
              ];
            }),
        )}
      </details>
      ${store.message ? html`<p class="error">${store.message}</p>` : null}
      <div class="actions">
        <button @click=${() => store.closeMod()}>Back</button>
        <button class="primary" @click=${() =>
          store.goTo("constructions")}>Continue</button>
      </div>
    `;
  }

  #modRefs(
    heading: string,
    itemLabel: string,
    addLabel: string,
    ids: string[],
    onEdit: (index: number, value: string) => void,
    onRemove: (index: number) => void,
    onAdd: () => void,
  ) {
    return html`
      <section>
        <h3>${heading}</h3>
        ${ids.map(
          (id, i) =>
            html`<div class="item-row">
              ${textField("Mod ID", id, (v) => onEdit(i, v))}
              ${
              this.#removeButton(
                `Remove ${itemLabel}: ${id || "Empty"}`,
                () => onRemove(i),
              )
            }
            </div>`,
        )}
        <button type="button" @click=${onAdd}>${addLabel}</button>
      </section>
    `;
  }
}

customElements.define("ce-mod-details", CeModDetails);
