import { css, html, LitElement, type TemplateResult } from "lit";
import {
  assetChips,
  decomposeTransf,
  isMenuCategory,
  MENU_CATEGORIES,
  menuLabel,
} from "@cedit/schema";
import {
  checkboxField,
  clearableNumberField,
  groupedSelectField,
  numberField,
  textAreaField,
  textField,
} from "./fields.ts";
import { chipStyles } from "./card-styles.ts";
import "./ce-folder-field.ts";
import "./ce-icon-picker.ts";
import "./ce-range-slider.ts";
import type { RangeChange } from "./ce-range-slider.ts";
import { observer } from "./observer.ts";
import { store } from "./state.ts";
import { sharedStyles } from "./styles.ts";

const round = (n: number) => Math.round(n * 1e6) / 1e6;

/** The slider's first and last stops. The last stop means "forever". */
const YEAR_MIN = 1850;
const YEAR_MAX = 2050;

/**
 * The shipped categories grouped by construction menu. A stored value the game
 * does not register stays selectable as its own group, so opening a document
 * never changes it.
 */
function menuCategoryGroups(current: string) {
  const groups: {
    label: string;
    options: { value: string; label: string }[];
  }[] = [];
  for (const c of MENU_CATEGORIES) {
    const label = menuLabel(c.menu);
    let group = groups.find((g) => g.label === label);
    if (!group) groups.push(group = { label, options: [] });
    group.options.push({ value: c.id, label: c.label });
  }
  if (!isMenuCategory(current)) {
    groups.unshift({
      label: "Not a Shipped Category",
      options: [{ value: current, label: current }],
    });
  }
  return groups;
}

/** Fields for whatever the scene tree has selected. */
export class CeProperties extends observer(LitElement) {
  static override styles = [
    sharedStyles,
    chipStyles,
    css`
      /*
      * Every vertical space between components is this one gap. Elements
      * carry no margins of their own, so the spacing stays consistent.
      */
      :host {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      /* The pane scrolls, so children keep their height instead of shrinking. */
      :host > * {
        flex: none;
      }
      h2,
      p,
      fieldset,
      .field {
        margin: 0;
      }
      h2 {
        background: var(--ce-surface);
        inset-block-start: 0;
        padding-block: 0.75rem 0;
        position: sticky;
        z-index: 1;
      }
      fieldset {
        border: 1px solid var(--ce-border);
        border-radius: 4px;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        min-inline-size: 0;
        padding: 0.5rem;
      }
      legend {
        color: var(--ce-muted);
        font-size: 11px;
      }
      /*
      * A group title row that sits on the top border. Each piece masks only
      * the border behind itself, so the border shows between the pieces.
      */
      fieldset.titled {
        /* The title text is about 1.22em tall and centred on the border, so
          half of it, 0.61em, hangs above the box. */
        --title-size: 11px;
        --title-overhang: calc(var(--title-size) * 0.61);
        /* The one margin in this pane: it lowers the box by the overhang, so
          the title text, not the border, sits one gap below its neighbour. */
        margin-block-start: var(--title-overhang);
        min-block-size: 1.5rem;
        /* Content starts 0.5rem below the title text, matching the bottom. The
          extra 0.1rem is the title row's own padding, measured in the page. */
        padding-block-start: calc(var(--title-overhang) + 0.6rem - 1px);
        position: relative;
      }
      .group-title {
        align-items: center;
        color: var(--ce-muted);
        display: flex;
        font-size: var(--title-size);
        inset-block-start: 0;
        inset-inline: 0.5rem;
        justify-content: space-between;
        pointer-events: none;
        position: absolute;
        translate: 0 -50%;
      }
      .group-title > * {
        background: var(--ce-surface);
        padding-inline: 0.3rem;
        pointer-events: auto;
      }
      .legend-check {
        align-items: center;
        display: inline-flex;
        gap: 0.3rem;
      }
      /* Three costs in one row: right-aligned figures. */
      .costs {
        display: grid;
        gap: 0.75rem;
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      /*
      * The fields and the "free" line share one grid cell. The fields stay
      * in the layout, hidden, so the box keeps its height in both states.
      */
      .costs-slot {
        display: grid;
      }
      .costs-slot > * {
        grid-area: 1 / 1;
      }
      .costs.free {
        visibility: hidden;
      }
      /* Muted text that stands in for a group box's empty or disabled content. */
      .placeholder {
        align-self: center;
        color: var(--ce-muted);
        text-align: center;
      }
      .costs ce-spinner::part(input) {
        font-variant-numeric: tabular-nums;
        text-align: end;
      }
      .cols {
        display: grid;
        gap: 0.75rem;
        grid-template-columns: 1fr 1fr;
      }
      /* The label takes all free width, the tag field only what it needs. */
      .cols.label-tag {
        grid-template-columns: minmax(0, 1fr) auto;
      }
      .id {
        overflow-wrap: anywhere;
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
      }
    `,
  ];

  override render() {
    if (!store.doc) return null;
    const target = store.inspectTarget;
    return html`
      <h2>Properties</h2>
      ${target === "model" && store.selectedPlacement
        ? this.#model()
        : target === "layer"
        ? this.#layer()
        : this.#construction()}
    `;
  }

  #layerFields(): TemplateResult | null {
    const sub = store.doc?.subconstructions[store.activeSub];
    if (!sub) return null;
    return html`
      <div class="cols label-tag">
        ${textField("Layer Label", sub.label ?? "", (v) =>
          store.edit(
            (d) => {
              d.subconstructions[store.activeSub].label = v || undefined;
            },
            { label: "Rename layer" },
          ))}
        ${clearableNumberField(
          "Layer Tag",
          sub.tag,
          (v) =>
            store.edit(
              (d) => {
                d.subconstructions[store.activeSub].tag = v === undefined
                  ? undefined
                  : Math.round(v);
              },
              { label: "Set tag" },
            ),
          "Clear Tag",
          1,
        )}
      </div>
    `;
  }

  #layer(): TemplateResult {
    return html`
      <p class="muted">A layer is one exported subconstruction.</p>
      ${this.#layerFields()}
    `;
  }

  #model(): TemplateResult {
    const placement = store.selectedPlacement!;
    const t = decomposeTransf(placement.transf);
    const listing = store.listings.get(placement.id);
    return html`
      <div class="cols">
        ${numberField(
          "X (m)",
          round(t.x),
          (v) => store.patchSelectedPlacement({ x: v ?? 0 }),
        )}
        ${numberField(
          "Y (m)",
          round(t.y),
          (v) => store.patchSelectedPlacement({ y: v ?? 0 }),
        )}
        ${numberField(
          "Z (m)",
          round(t.z),
          (v) => store.patchSelectedPlacement({ z: v ?? 0 }),
        )}
        ${numberField(
          "Yaw (deg)",
          round((t.yaw * 180) / Math.PI),
          (v) => store.patchSelectedPlacement({ yawDeg: v ?? 0 }),
        )}
        ${numberField(
          "Scale",
          round(t.scale),
          (v) => store.patchSelectedPlacement({ scale: v && v > 0 ? v : 1 }),
        )}
      </div>
      ${textField("Model Tag", placement.tag ?? "", (v) => {
        const s = store.selection;
        if (!s) return;
        store.edit(
          (d) => {
            d.subconstructions[s.sub].models[s.model].tag = v || undefined;
          },
          { label: "Set model tag" },
        );
      })}
      <p class="id muted" title=${placement.id}>${placement.id}</p>
      ${listing
        ? html`
          <div class="chips">
            ${assetChips(listing, listing.variants).map(
              (c) => html`<span class="chip ${c.zone ?? ""}">${c.label}</span>`,
            )}
          </div>
        `
        : null}
    `;
  }

  #construction(): TemplateResult {
    const doc = store.doc!;
    return html`
      ${textField(
        "Name (32 max)",
        doc.description.name,
        (v) => store.edit((d) => (d.description.name = v)),
      )}
      ${textAreaField(
        "Description (320 max)",
        doc.description.description,
        (v) => store.edit((d) => (d.description.description = v)),
      )}
      <div class="cols">
        <ce-icon-picker
          label="Icon"
          .dir=${store.dir}
          .value=${doc.description.icon ?? ""}
          @change=${(e: CustomEvent<{ value: string }>) =>
            store.edit((d) => d.description.icon = e.detail.value || undefined)}
        ></ce-icon-picker>
        <ce-icon-picker
          label="Preview Icon"
          .dir=${store.dir}
          .value=${doc.description.previewIcon ?? ""}
          @change=${(e: CustomEvent<{ value: string }>) =>
            store.edit((d) =>
              d.description.previewIcon = e.detail.value || undefined
            )}
        ></ce-icon-picker>
      </div>
      <ce-folder-field
        label="Content Folder"
        root="./content/"
        .value=${doc.folder}
        ?choosing=${store.choosingFolder === "contentFolder"}
        @change=${(e: CustomEvent<{ value: string }>) =>
          store.edit((d) => (d.folder = e.detail.value))}
        @choose=${async () => {
          const folder = await store.chooseContentFolder(doc.folder);
          if (folder !== null && folder !== doc.folder) {
            store.edit((d) => (d.folder = folder));
          }
        }}
      ></ce-folder-field>
      <div class="cols">
        ${groupedSelectField(
          "Menu Category",
          doc.menuCategory.category,
          menuCategoryGroups(doc.menuCategory.category),
          (v) => store.edit((d) => (d.menuCategory.category = v)),
        )}
        ${numberField(
          "Menu Order",
          doc.menuCategory.order,
          (v) => store.edit((d) => (d.menuCategory.order = v ?? 0)),
          "1",
        )}
      </div>
      <fieldset class="titled" aria-label="Years Available">
        <div class="group-title">
          <span>Years Available</span>
        </div>
        <ce-range-slider
          .min=${YEAR_MIN}
          .max=${YEAR_MAX}
          .from=${doc.availability.yearFrom}
          .to=${doc.availability.yearTo}
          startLabel="Always"
          foreverLabel="Forever"
          fromLabel="Year From"
          toLabel="Year To"
          @change=${(e: CustomEvent<RangeChange>) =>
            store.edit((d) => {
              d.availability.yearFrom = e.detail.from;
              d.availability.yearTo = e.detail.to;
            })}
        ></ce-range-slider>
      </fieldset>
      <fieldset class="titled" aria-label="Costs">
        <div class="group-title">
          <span>Costs</span>
          <label class="legend-check">
            <input
              type="checkbox"
              .checked=${doc.costs.noCostAtAll ?? false}
              @change=${(e: Event) => {
                const checked = (e.target as HTMLInputElement).checked;
                store.edit((d) => (d.costs.noCostAtAll = checked || undefined));
              }}
            />
            <span>No Costs at All</span>
          </label>
        </div>
        <div class="costs-slot">
        <div class=${doc.costs.noCostAtAll ? "costs free" : "costs"}>
          ${numberField(
            "Cost",
            doc.costs.cost,
            (v) => store.edit((d) => (d.costs.cost = v)),
            "100",
            false,
            0,
          )}
          ${numberField(
            "Maintenance",
            doc.costs.maintenanceCost,
            (v) => store.edit((d) => (d.costs.maintenanceCost = v)),
            "100",
            false,
            0,
          )}
          ${numberField(
            "Bulldoze",
            doc.costs.bulldozeCost,
            (v) => store.edit((d) => (d.costs.bulldozeCost = v)),
            "100",
            false,
            0,
          )}
        </div>
        ${doc.costs.noCostAtAll
          ? html`
            <p class="placeholder">This construction costs nothing.</p>
          `
          : null}
        </div>
      </fieldset>
    `;
  }
}

customElements.define("ce-properties", CeProperties);
