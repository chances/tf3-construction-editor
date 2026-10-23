import { css, html, LitElement, type TemplateResult } from "lit";
import {
  type AlignmentMode,
  decomposeTransf,
  type GroundFaceDoc,
  type GroundFaceModeType,
  isMenuCategory,
  MENU_CATEGORIES,
  menuLabel,
} from "@cedit/schema";
import { canRemoveVertex, moveVertex } from "./face-edit.ts";
import {
  edgesIcon,
  laneIcon,
  plusIcon,
  polygonIcon,
  rectangleIcon,
  runwayIcon,
  trashIcon,
  xIcon,
} from "./icons.ts";
import type { SpinnerChange } from "./ce-spinner.ts";
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

const MODE_TYPES: readonly [GroundFaceModeType, string][] = [
  ["FILL", "Fill"],
  ["STROKE", "Stroke"],
  ["STROKE_INNER", "Stroke Inner"],
  ["STROKE_OUTER", "Stroke Outer"],
];

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

/** Layout shared by the Properties pane and its path panel. */
export const propertiesStyles = [
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
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .actions button {
      align-items: center;
      display: inline-flex;
      gap: 0.4rem;
    }
    /* The heading actions are as tall as the Scene heading actions. */
    button.icon-button {
      align-items: center;
      block-size: 1.5rem;
      box-sizing: border-box;
      display: inline-flex;
      inline-size: 1.5rem;
      justify-content: center;
      padding: 0;
    }
    .vertex-grid {
      align-items: center;
      display: grid;
      gap: 0.125rem;
      grid-template-columns: 0.9rem repeat(2, minmax(0, 1fr)) 1.25rem;
    }
    .vertex-grid.head {
      color: var(--ce-muted);
      font-size: 11px;
    }
    .vertex-grid .index {
      color: var(--ce-muted);
      font-variant-numeric: tabular-nums;
      text-align: end;
    }
    .vertex-grid[aria-current="true"] .index {
      color: var(--ce-accent);
      font-weight: 600;
    }
    /* Paint modes share one box, split by a rule, so no group nests. */
    .mode {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .mode + .mode {
      border-block-start: 1px solid var(--ce-border);
      padding-block-start: 0.5rem;
    }
    .mode-head {
      align-items: end;
      display: grid;
      gap: 0.25rem;
      grid-template-columns: minmax(0, 1fr) 1.5rem;
    }
    details.alignment {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    details.alignment[open] > summary {
      margin-block-end: 0.5rem;
    }
    details.alignment > * + * {
      margin-block-start: 0.5rem;
    }
    summary {
      color: var(--ce-muted);
      cursor: pointer;
      font-size: 11px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
  `,
];

/** Fields for whatever the scene tree has selected. */
export class CeProperties extends observer(LitElement) {
  static override styles = propertiesStyles;

  override render() {
    if (!store.doc) return null;
    const target = store.inspectTarget;
    return html`
      <h2>Properties</h2>
      ${target === "model" && store.selectedPlacement
        ? this.#model()
        : target === "face" && store.selectedFace
        ? this.#face()
        : target === "path" && store.pathSelection
        ? html`<ce-path-properties></ce-path-properties>`
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
      <div class="actions">
        <button
          type="button"
          title="Draw Ground Face"
          aria-label="Click out a ground face polygon on the surface"
          @click=${() => store.setTool("face")}
        >${polygonIcon(14)} Draw Ground Face</button>
        <button
          type="button"
          title="Draw Rectangle"
          aria-label="Drag a rectangular ground face on the surface"
          @click=${() => store.setTool("rect")}
        >${rectangleIcon(14)} Draw Rectangle</button>
        <button
          type="button"
          title="Draw Lane List"
          aria-label="Click out a lane list on the surface"
          @click=${() => store.setTool("lane")}
        >${laneIcon(14)} Draw Lane List</button>
        <button
          type="button"
          title="Draw Edge List"
          aria-label="Click out street or track edges on the surface"
          @click=${() => store.setTool("edges")}
        >${edgesIcon(14)} Draw Edge List</button>
        <button
          type="button"
          ?disabled=${!store.doc?.edgeLists?.length}
          title=${store.doc?.edgeLists?.length
            ? "Add Runway"
            : "Draw an edge list first"}
          aria-label="Add a runway on an edge list to this layer"
          @click=${() => store.addRunway("LANDING")}
        >${runwayIcon(14)} Add Runway</button>
      </div>
    `;
  }

  #face(): TemplateResult {
    const s = store.faceSelection!;
    const face = store.selectedFace!;
    const edit = (
      change: (f: GroundFaceDoc) => void,
      label: string,
    ) => store.editFace(s.sub, s.face, change, { label });
    const alignmentUsed = face.loop !== undefined ||
      face.alignmentOffsetMode !== undefined ||
      face.alignmentOffset !== undefined ||
      face.alignmentDirMode !== undefined ||
      face.alignmentDir !== undefined;
    const modeChoice = (value: string | undefined) => value ?? "Default";
    const modeSelect = (
      label: string,
      value: AlignmentMode | undefined,
      set: (v: AlignmentMode | undefined) => void,
    ) =>
      html`
        <label class="field"><span>${label}</span><select
            @change=${(e: Event) => {
              const v = (e.target as HTMLSelectElement).value;
              set(v === "Default" ? undefined : v as AlignmentMode);
            }}
          >${["Default", "OBJECT", "WORLD"].map((o) =>
            html`<option .selected=${o === modeChoice(value)}>${o}</option>`
          )}</select></label>
      `;
    const pair = (
      label: string,
      value: [number, number] | undefined,
      set: (v: [number, number]) => void,
    ) =>
      html`
        <div class="cols">
          ${numberField(
            `${label} X`,
            round(value?.[0] ?? 0),
            (v) => set([v ?? 0, value?.[1] ?? 0]),
          )}
          ${numberField(
            `${label} Y`,
            round(value?.[1] ?? 0),
            (v) => set([value?.[0] ?? 0, v ?? 0]),
          )}
        </div>
      `;
    return html`
      ${textField("Face Label", face.label ?? "", (v) =>
        edit((f) => {
          f.label = v || undefined;
        }, "Rename ground face"))}
      <fieldset class="titled" aria-label="Vertices">
        <div class="group-title">
          <span>Vertices</span>
          <button
            type="button"
            class="subtle icon-button"
            title="Add Vertex"
            aria-label="Split the edge after the picked vertex with a new vertex"
            @click=${() =>
              store.addFaceVertex(
                s.sub,
                s.face,
                s.vertex ?? face.points.length - 1,
              )}
          >${plusIcon(12)}</button>
        </div>
        <div class="vertex-grid head" aria-hidden="true">
          <span></span><span>X (m)</span><span>Y (m)</span><span></span>
        </div>
        ${face.points.map((p, i) =>
          html`
            <div
              class="vertex-grid"
              aria-current=${String(s.vertex === i)}
              @focusin=${() => store.selectVertex(i)}
            >
              <span class="index">${i + 1}</span>
              ${(["X", "Y"] as const).map((axis, k) =>
                html`
                  <ce-spinner
                    fill
                    .label=${`Vertex ${i + 1} ${axis} (m)`}
                    .step=${null}
                    .value=${round(p[k])}
                    @change=${(e: CustomEvent<SpinnerChange>) => {
                      const v = e.detail.value ?? 0;
                      edit((f) => {
                        moveVertex(
                          f,
                          i,
                          k === 0 ? v : f.points[i][0],
                          k === 1 ? v : f.points[i][1],
                        );
                      }, "Move vertex");
                    }}
                  ></ce-spinner>
                `
              )}
              <button
                type="button"
                class="subtle icon-button"
                ?disabled=${!canRemoveVertex(face)}
                title=${canRemoveVertex(face)
                  ? "Remove Vertex"
                  : "A ground face keeps 3 vertices"}
                aria-label=${`Remove vertex ${i + 1} from the ground face`}
                @click=${() => store.removeFaceVertex(s.sub, s.face, i)}
              >${xIcon(12)}</button>
            </div>
          `
        )}
      </fieldset>
      <fieldset class="titled" aria-label="Paint Modes">
        <div class="group-title">
          <span>Paint Modes</span>
          <button
            type="button"
            class="subtle icon-button"
            title="Add Paint Mode"
            aria-label="Add a paint mode to the ground face"
            @click=${() => store.addFaceMode(s.sub, s.face)}
          >${plusIcon(12)}</button>
        </div>
        ${face.modes.length === 0
          ? html`<p class="placeholder">This face paints nothing yet.</p>`
          : face.modes.map((mode, mi) =>
            html`
              <div class="mode">
                <div class="mode-head">
                  <label class="field"><span>Paint Mode</span><select
                      @change=${(e: Event) =>
                        store.setFaceMode(s.sub, s.face, mi, {
                          type: (e.target as HTMLSelectElement)
                            .value as GroundFaceModeType,
                        })}
                    >${MODE_TYPES.map(([value, label]) =>
                      html`<option value=${value} .selected=${
                        value === mode.type
                      }>${label}</option>`
                    )}</select></label>
                  <button
                    type="button"
                    class="subtle icon-button"
                    title="Remove Paint Mode"
                    aria-label=${`Remove the ${mode.type} paint mode from the ground face`}
                    @click=${() => store.removeFaceMode(s.sub, s.face, mi)}
                  >${trashIcon(12)}</button>
                </div>
                <ce-icon-picker
                  label="Texture"
                  kind="gtex"
                  .dir=${store.dir}
                  .value=${mode.key}
                  .autoOpen=${store.pendingTexturePick?.sub === s.sub &&
                    store.pendingTexturePick.face === s.face &&
                    store.pendingTexturePick.mode === mi}
                  @opened=${() => store.clearTexturePick()}
                  @change=${(e: CustomEvent<{ value: string }>) =>
                    store.setFaceMode(s.sub, s.face, mi, {
                      key: e.detail.value,
                    })}
                ></ce-icon-picker>
                ${checkboxField(
                  "Edit Texture Coordinates",
                  mode.texCoords !== undefined,
                  (own) => store.setOwnTexCoords(s.sub, s.face, mi, own),
                )}
                ${mode.texCoords
                  ? mode.texCoords.map(([u, v], i) =>
                    html`
                      <div class="cols">
                        ${numberField(
                          `Vertex ${i + 1} U`,
                          round(u),
                          (n) =>
                            edit((f) => {
                              f.modes[mi].texCoords![i] = [n ?? 0, v];
                            }, "Edit texture coordinates"),
                        )}
                        ${numberField(
                          `Vertex ${i + 1} V`,
                          round(v),
                          (n) =>
                            edit((f) => {
                              f.modes[mi].texCoords![i] = [u, n ?? 0];
                            }, "Edit texture coordinates"),
                        )}
                      </div>
                    `
                  )
                  : null}
              </div>
            `
          )}
      </fieldset>
      <details class="alignment" ?open=${alignmentUsed}>
        <summary>Alignment</summary>
        <p class="muted">Not checked in game.</p>
        ${checkboxField(
          "Loop",
          face.loop !== false,
          (v) =>
            edit((f) => {
              f.loop = v ? undefined : false;
            }, "Set loop"),
        )}
        ${modeSelect(
          "Offset Mode",
          face.alignmentOffsetMode,
          (v) =>
            edit((f) => {
              f.alignmentOffsetMode = v;
            }, "Set offset mode"),
        )}
        ${pair(
          "Offset",
          face.alignmentOffset,
          (v) =>
            edit((f) => {
              f.alignmentOffset = v;
            }, "Set offset"),
        )}
        ${modeSelect(
          "Direction Mode",
          face.alignmentDirMode,
          (v) =>
            edit((f) => {
              f.alignmentDirMode = v;
            }, "Set direction mode"),
        )}
        ${pair(
          "Direction",
          face.alignmentDir,
          (v) =>
            edit((f) => {
              f.alignmentDir = v;
            }, "Set direction"),
        )}
        <button
          type="button"
          ?disabled=${!alignmentUsed}
          title=${alignmentUsed
            ? "Reset Alignment"
            : "No alignment field is set"}
          aria-label="Clear loop and every alignment field of the ground face"
          @click=${() =>
            edit((f) => {
              delete f.loop;
              delete f.alignmentOffsetMode;
              delete f.alignmentOffset;
              delete f.alignmentDirMode;
              delete f.alignmentDir;
            }, "Reset alignment")}
        >Reset Alignment</button>
      </details>
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
            ${listing.chips.map(
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
              d.availability.yearFrom = e.detail.from ?? 0;
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
