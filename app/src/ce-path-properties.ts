import { css, html, LitElement, type TemplateResult } from "lit";
import {
  composeTransf,
  decomposeTransf,
  edgeLength,
  type EdgeListDoc,
  findEdgeList,
  type LaneListDoc,
  type TrafficLight,
  type TransportMode,
  type Vec3,
} from "@cedit/schema";
import { observer } from "./observer.ts";
import { store } from "./state.ts";
import {
  edgeObjectIcon,
  plusIcon,
  runwayIcon,
  trashIcon,
  xIcon,
} from "./icons.ts";
import { checkboxField, numberField, textField } from "./fields.ts";
import type { SpinnerChange } from "./ce-spinner.ts";
import { propertiesStyles } from "./ce-properties.ts";
import "./ce-icon-picker.ts";
import "./ce-spinner.ts";

const round = (n: number) => Math.round(n * 1e6) / 1e6;

const MODES: readonly TransportMode[] = [
  "PERSON",
  "CARGO",
  "CAR",
  "BUS",
  "TRUCK",
  "TRAM",
  "ELECTRIC_TRAM",
  "TRAIN",
  "ELECTRIC_TRAIN",
  "AIRCRAFT",
  "SMALL_AIRCRAFT",
  "HELICOPTER",
  "SHIP",
  "SMALL_SHIP",
  "TRAM_TRACK",
  "ELECTRIC_TRAM_TRACK",
];

/** `ELECTRIC_TRAM` as `Electric Tram`. */
function modeLabel(mode: string): string {
  return mode.toLowerCase().split("_").map((w) =>
    w[0].toUpperCase() + w.slice(1)
  )
    .join(" ");
}

const LIGHTS: readonly [TrafficLight | "", string][] = [
  ["", "Default"],
  ["YES", "Yes"],
  ["NO", "No"],
  ["AUTO", "Auto"],
];

/** Node numbers as people count them: 1-based, comma separated. */
const nodeText = (nodes: readonly number[]) =>
  nodes.map((n) => n + 1).join(", ");

function parseNodes(text: string, count: number): number[] {
  return [
    ...new Set(
      text.split(/[\s,]+/).map(Number).filter((n) =>
        Number.isInteger(n) && n >= 1 && n <= count
      ).map((n) => n - 1),
    ),
  ];
}

/** Fields for the lane list, edge list, runway, or edge object that is picked. */
export class CePathProperties extends observer(LitElement) {
  static override styles = [
    ...propertiesStyles,
    css`
      .node-grid {
        align-items: center;
        display: grid;
        gap: 0.125rem;
        grid-template-columns: 0.9rem repeat(3, minmax(0, 1fr)) 1.25rem;
      }
      .node-grid.head {
        color: var(--ce-muted);
        font-size: 11px;
      }
      .node-grid .index {
        color: var(--ce-muted);
        font-variant-numeric: tabular-nums;
        text-align: end;
      }
      .node-grid[aria-current="true"] .index {
        color: var(--ce-accent);
        font-weight: 600;
      }
      .modes {
        display: grid;
        gap: 0.25rem 0.5rem;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .modes label {
        align-items: center;
        display: inline-flex;
        gap: 0.3rem;
      }
      .line {
        align-items: center;
        display: grid;
        gap: 0.25rem;
        grid-template-columns: minmax(0, 1fr) 1.5rem;
      }
      .line button.item {
        text-align: start;
      }
      .line button.item[aria-current="true"] {
        background: var(--ce-selected);
      }
      .tag-row {
        display: grid;
        gap: 0.25rem;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 1.5rem;
      }
      button.pick[aria-pressed="true"] {
        background: var(--ce-selected);
        border-color: var(--ce-accent);
      }
      .chip-button {
        align-items: center;
        display: inline-flex;
        gap: 0.25rem;
      }
    `,
  ];

  override render() {
    const s = store.pathSelection;
    if (!s || !store.doc) return null;
    switch (s.kind) {
      case "lane":
        return store.selectedLane ? this.#lane() : null;
      case "edgeList":
        return store.selectedEdgeList ? this.#edgeList() : null;
      case "runway":
        return store.selectedRunway ? this.#runway() : null;
      case "edgeObject":
        return store.selectedEdgeObject ? this.#edgeObject() : null;
    }
  }

  /** Three spinners for a position or direction, one node per row. */
  #spinners(
    label: string,
    value: Vec3,
    set: (v: Vec3) => void,
  ): TemplateResult[] {
    return (["X", "Y", "Z"] as const).map((axis, k) =>
      html`
        <ce-spinner
          fill
          .label=${`${label} ${axis} (m)`}
          .step=${null}
          .value=${round(value[k])}
          @change=${(e: CustomEvent<SpinnerChange>) => {
            const next: Vec3 = [...value];
            next[k] = e.detail.value ?? 0;
            set(next);
          }}
        ></ce-spinner>
      `
    );
  }

  #tangentFields(
    current: Vec3 | undefined,
    set: (v: Vec3 | undefined) => void,
  ): TemplateResult {
    const value: Vec3 = current ?? [0, 0, 0];
    return html`
      <div class="cols">
        ${numberField(
          "Tangent X",
          round(value[0]),
          (v) => set([v ?? 0, value[1], value[2]]),
        )}
        ${numberField(
          "Tangent Y",
          round(value[1]),
          (v) => set([value[0], v ?? 0, value[2]]),
        )}
        ${numberField(
          "Tangent Z",
          round(value[2]),
          (v) => set([value[0], value[1], v ?? 0]),
        )}
        <button
          type="button"
          ?disabled=${current === undefined}
          title=${current === undefined
            ? "The tangent is automatic"
            : "Reset Tangent"}
          aria-label="Clear the tangent override of the picked node so it follows its edges"
          @click=${() => set(undefined)}
        >Reset Tangent</button>
      </div>
    `;
  }

  // Lane lists

  #lane(): TemplateResult {
    const s = store.pathSelection;
    if (s?.kind !== "lane") return html``;
    const lane = store.selectedLane!;
    const edit = (change: (l: LaneListDoc) => void, label: string) =>
      store.editLane(s.sub, s.lane, change, { label });
    const offset = decomposeTransf(
      lane.transf ?? composeTransf({
        x: 0,
        y: 0,
        z: 0,
        yaw: 0,
      }),
    );
    const setOffset = (x: number, y: number, z: number) =>
      edit((l) => {
        l.transf = x === 0 && y === 0 && z === 0
          ? undefined
          : composeTransf({ x, y, z, yaw: 0 });
      }, "Set lane offset");
    const picked = s.node !== null ? lane.nodes[s.node] : undefined;
    return html`
      ${textField("Lane Label", lane.label ?? "", (v) =>
        edit((l) => {
          l.label = v || undefined;
        }, "Rename lane list"))}
      <fieldset class="titled" aria-label="Transport Modes">
        <div class="group-title"><span>Transport Modes</span></div>
        <div class="modes">
          ${MODES.map((mode) =>
            html`
              <label>
                <input
                  type="checkbox"
                  .checked=${lane.transportModes.includes(mode)}
                  @change=${(e: Event) => {
                    const on = (e.target as HTMLInputElement).checked;
                    edit((l) => {
                      l.transportModes = MODES.filter((m) =>
                        m === mode ? on : l.transportModes.includes(m)
                      );
                    }, "Set transport modes");
                  }}
                />
                ${modeLabel(mode)}
              </label>
            `
          )}
        </div>
      </fieldset>
      <div class="cols">
        ${numberField(
          "Speed Limit (m/s)",
          round(lane.speedLimit),
          (v) =>
            edit((l) => {
              l.speedLimit = Math.max(0, v ?? 0);
            }, "Set speed limit"),
          "any",
          false,
          0,
        )}
        ${numberField(
          "Walk Penalty",
          round(lane.pedestrianWalkPenalty),
          (v) =>
            edit((l) => {
              l.pedestrianWalkPenalty = Math.max(0, v ?? 0);
            }, "Set walk penalty"),
          "any",
          false,
          0,
        )}
      </div>
      <div class="cols">
        ${checkboxField("Linkable", lane.linkable, (v) =>
          edit((l) => {
            l.linkable = v;
          }, "Set linkable"))}
        ${checkboxField("Forward Only", lane.forwardOnly, (v) =>
          edit((l) => {
            l.forwardOnly = v;
          }, "Set forward only"))}
        ${checkboxField(
          "Needs Reservation",
          lane.needsReservation,
          (v) =>
            edit((l) => {
              l.needsReservation = v;
            }, "Set needs reservation"),
        )}
      </div>
      <fieldset class="titled" aria-label="Offset">
        <div class="group-title"><span>Offset</span></div>
        <div class="cols">
          ${numberField(
            "Offset X",
            round(offset.x),
            (v) => setOffset(v ?? 0, offset.y, offset.z),
          )}
          ${numberField(
            "Offset Y",
            round(offset.y),
            (v) => setOffset(offset.x, v ?? 0, offset.z),
          )}
          ${numberField(
            "Offset Z",
            round(offset.z),
            (v) => setOffset(offset.x, offset.y, v ?? 0),
          )}
        </div>
      </fieldset>
      <fieldset class="titled" aria-label="Nodes">
        <div class="group-title">
          <span>Nodes</span>
          <button
            type="button"
            class="subtle icon-button"
            title="Add Node"
            aria-label="Split the edge after the picked node with a new lane node"
            @click=${() =>
              store.addLaneNode(s.sub, s.lane, s.node ?? lane.nodes.length - 2)}
          >${plusIcon(12)}</button>
        </div>
        <div class="node-grid head" aria-hidden="true">
          <span></span><span>X (m)</span><span>Y (m)</span><span>Z (m)</span
          ><span></span>
        </div>
        ${lane.nodes.map((n, i) =>
          html`
            <div
              class="node-grid"
              aria-current=${String(s.node === i)}
              @focusin=${() => store.selectPathNode(i)}
            >
              <span class="index">${i + 1}</span>
              ${this.#spinners(`Node ${i + 1}`, n.pos, (pos) =>
                edit((l) => {
                  l.nodes[i].pos = pos;
                }, "Move lane node"))}
              <button
                type="button"
                class="subtle icon-button"
                ?disabled=${!store.canRemoveLaneNode(s.sub, s.lane)}
                title=${store.canRemoveLaneNode(s.sub, s.lane)
                  ? "Remove Node"
                  : "A lane list keeps 2 nodes"}
                aria-label=${`Remove node ${i + 1} from the lane list`}
                @click=${() => store.removeLaneNodeAt(s.sub, s.lane, i)}
              >${xIcon(12)}</button>
            </div>
          `
        )}
      </fieldset>
      ${picked
        ? html`
          <div class="cols">
            ${numberField(
              "Width",
              round(picked.width),
              (v) =>
                edit((l) => {
                  l.nodes[s.node!].width = Math.max(0, v ?? 0);
                }, "Set lane width"),
              "any",
              false,
              0,
            )}
          </div>
          ${this.#tangentFields(picked.tangent, (t) => store.setPathTangent(t))}
        `
        : html`<p class="muted">Pick a node to edit its width and tangent.</p>`}
    `;
  }

  // Edge lists

  #edgeList(): TemplateResult {
    const s = store.pathSelection;
    if (s?.kind !== "edgeList") return html``;
    const list = store.selectedEdgeList!;
    const edit = (change: (l: EdgeListDoc) => void, label: string) =>
      store.editEdgeList(s.list, change, { label });
    const picked = s.node !== null ? list.nodes[s.node] : undefined;
    const pickedEdge = s.edge !== null ? list.edges[s.edge] : undefined;
    return html`
      ${textField("Edge List Label", list.label ?? "", (v) =>
        edit((l) => {
          l.label = v || undefined;
        }, "Rename edge list"))}
      <div class="cols">
        <label class="field"><span>List Type</span><select
            @change=${(e: Event) =>
              store.setEdgeListType(
                s.list,
                (e.target as HTMLSelectElement).value as "STREET" | "TRACK",
              )}
          >${(["STREET", "TRACK"] as const).map((type) =>
            html`<option value=${type} .selected=${list.type === type}>${
              type === "STREET" ? "Street" : "Track"
            }</option>`
          )}</select></label>
        ${checkboxField("Align Terrain", list.alignTerrain, (v) =>
          edit((l) => {
            l.alignTerrain = v;
          }, "Set align terrain"))}
      </div>
      <ce-icon-picker
        .label=${list.type === "STREET" ? "Street Type" : "Track Type"}
        .kind=${list.type === "STREET" ? "street" : "track"}
        .dir=${store.dir}
        .value=${list.typeName}
        .autoOpen=${store.pendingTypePick === list.id}
        @opened=${() => store.clearTypePick()}
        @change=${(e: CustomEvent<{ value: string }>) =>
          edit((l) => {
            l.typeName = e.detail.value;
          }, "Set edge list type")}
      ></ce-icon-picker>
      <fieldset class="titled" aria-label="Nodes">
        <div class="group-title"><span>Nodes</span></div>
        <div class="node-grid head" aria-hidden="true">
          <span></span><span>X (m)</span><span>Y (m)</span><span>Z (m)</span
          ><span></span>
        </div>
        ${list.nodes.map((n, i) =>
          html`
            <div
              class="node-grid"
              aria-current=${String(s.node === i)}
              @focusin=${() => store.selectPathNode(i)}
            >
              <span class="index">${i + 1}</span>
              ${this.#spinners(`Node ${i + 1}`, n.pos, (pos) =>
                edit((l) => {
                  l.nodes[i].pos = pos;
                }, "Move edge node"))}
              <button
                type="button"
                class="subtle icon-button"
                title="Remove Node"
                aria-label=${`Remove node ${
                  i + 1
                } and its edges from the edge list`}
                @click=${() => store.requestRemoveEdgeNode(s.list, i)}
              >${xIcon(12)}</button>
            </div>
          `
        )}
      </fieldset>
      ${picked
        ? html`
          <div class="cols">
            ${checkboxField("Snap Node", picked.snap === true, (v) =>
              edit((l) => {
                l.nodes[s.node!].snap = v || undefined;
              }, "Set snap node"))}
            ${checkboxField("Free Node", picked.free === true, (v) =>
              edit((l) => {
                l.nodes[s.node!].free = v || undefined;
              }, "Set free node"))}
            <label class="field"><span>Traffic Light</span><select
                @change=${(e: Event) => {
                  const v = (e.target as HTMLSelectElement).value;
                  edit((l) => {
                    l.nodes[s.node!].trafficLight = v === ""
                      ? undefined
                      : v as TrafficLight;
                  }, "Set traffic light");
                }}
              >${LIGHTS.map(([value, label]) =>
                html`<option value=${value} .selected=${
                  (picked.trafficLight ?? "") === value
                }>${label}</option>`
              )}</select></label>
          </div>
          ${this.#tangentFields(picked.tangent, (t) =>
            store.setPathTangent(t))}
        `
        : html`<p class="muted">Pick a node to edit its role and tangent.</p>`}
      <fieldset class="titled" aria-label="Edges">
        <div class="group-title"><span>Edges</span></div>
        ${list.edges.length === 0
          ? html`<p class="placeholder">This list has no edge yet.</p>`
          : list.edges.map(([a, b], i) =>
            html`
              <div class="line">
                <button
                  type="button"
                  class="subtle item"
                  aria-current=${String(s.edge === i)}
                  title=${`Edge ${i + 1}`}
                  @click=${() => store.selectPathEdge(i)}
                >Edge ${i + 1}: Node ${a + 1} to Node ${b + 1}</button>
                <button
                  type="button"
                  class="subtle icon-button"
                  title="Remove Edge"
                  aria-label=${`Remove edge ${i + 1} from the edge list`}
                  @click=${() => store.requestRemoveEdge(s.list, i)}
                >${xIcon(12)}</button>
              </div>
            `
          )}
      </fieldset>
      <div class="actions">
        <button
          type="button"
          ?disabled=${!pickedEdge}
          title=${pickedEdge
            ? "Add Edge Object"
            : "Pick an edge to put an object on it"}
          aria-label="Add an edge object, such as a sign, on the picked edge"
          @click=${() => store.addEdgeObject(s.list, s.edge!)}
        >${edgeObjectIcon(14)} Add Edge Object</button>
        ${(["LANDING", "TAKEOFF"] as const).map((kind) =>
          html`
            <button
              type="button"
              title=${`Add ${
                kind === "LANDING" ? "Landing" : "Takeoff"
              } Runway`}
              aria-label=${`Add a ${kind.toLowerCase()} runway on this edge list to the active layer`}
              @click=${() => store.addRunway(kind)}
            >${runwayIcon(14)} ${kind === "LANDING"
              ? "Landing"
              : "Takeoff"}</button>
          `
        )}
      </div>
      ${this.#tags(list, s.list)}
    `;
  }

  /** The `tag2nodes` editor: a tag name and its nodes, counted from 1. */
  #tags(list: EdgeListDoc, index: number): TemplateResult {
    const tags = Object.entries(list.tag2nodes ?? {});
    const edit = (change: (l: EdgeListDoc) => void, label: string) =>
      store.editEdgeList(index, change, { label });
    return html`
      <fieldset class="titled" aria-label="Node Tags">
        <div class="group-title">
          <span>Node Tags</span>
          <button
            type="button"
            class="subtle icon-button"
            title="Add Node Tag"
            aria-label="Add a tag that names a set of nodes of the edge list"
            @click=${() =>
              edit((l) => {
                let n = Object.keys(l.tag2nodes ?? {}).length + 1;
                while (l.tag2nodes && `tag${n}` in l.tag2nodes) n++;
                l.tag2nodes = { ...l.tag2nodes, [`tag${n}`]: [] };
              }, "Add node tag")}
          >${plusIcon(12)}</button>
        </div>
        ${tags.length === 0
          ? html`<p class="placeholder">No node has a tag.</p>`
          : tags.map(([tag, nodes]) =>
            html`
              <div class="tag-row">
                <input
                  aria-label=${`Name of the tag ${tag}`}
                  .value=${tag}
                  @change=${(e: Event) => {
                    const next = (e.target as HTMLInputElement).value.trim();
                    if (next === "" || next === tag) return;
                    edit((l) => {
                      l.tag2nodes = Object.fromEntries(
                        Object.entries(l.tag2nodes ?? {}).map((
                          [k, v],
                        ) => [k === tag ? next : k, v]),
                      );
                    }, "Rename node tag");
                  }}
                />
                <input
                  aria-label=${`Nodes of the tag ${tag}, counted from 1`}
                  placeholder="1, 2"
                  .value=${nodeText(nodes)}
                  @change=${(e: Event) => {
                    const text = (e.target as HTMLInputElement).value;
                    edit((l) => {
                      l.tag2nodes![tag] = parseNodes(text, l.nodes.length);
                    }, "Set tagged nodes");
                  }}
                />
                <button
                  type="button"
                  class="subtle icon-button"
                  title="Remove Node Tag"
                  aria-label=${`Remove the tag ${tag}`}
                  @click=${() =>
                    edit((l) => {
                      delete l.tag2nodes![tag];
                      if (Object.keys(l.tag2nodes!).length === 0) {
                        delete l.tag2nodes;
                      }
                    }, "Remove node tag")}
                >${trashIcon(12)}</button>
              </div>
            `
          )}
      </fieldset>
    `;
  }

  // Runways

  #runway(): TemplateResult {
    const s = store.pathSelection;
    if (s?.kind !== "runway") return html``;
    const runway = store.selectedRunway!;
    const doc = store.doc!;
    const edit = (
      change: (r: NonNullable<typeof runway>) => void,
      label: string,
    ) => store.editRunway(s.sub, s.runway, change, { label });
    const pick = store.runwayPick;
    const armed = (field: "node" | "edges") =>
      pick?.sub === s.sub && pick.runway === s.runway && pick.field === field;
    const toggle = (field: "node" | "edges") =>
      store.beginRunwayPick(
        armed(field) ? null : { sub: s.sub, runway: s.runway, field },
      );
    return html`
      ${textField("Runway Label", runway.label ?? "", (v) =>
        edit((r) => {
          r.label = v || undefined;
        }, "Rename runway"))}
      <div class="cols">
        <label class="field"><span>Runway Kind</span><select
            @change=${(e: Event) => {
              const v = (e.target as HTMLSelectElement).value;
              edit((r) => {
                r.kind = v as "LANDING" | "TAKEOFF";
              }, "Set runway kind");
            }}
          >${(["LANDING", "TAKEOFF"] as const).map((kind) =>
            html`<option value=${kind} .selected=${runway.kind === kind}>${
              kind === "LANDING" ? "Landing" : "Takeoff"
            }</option>`
          )}</select></label>
        <label class="field"><span>Edge List</span><select
            @change=${(e: Event) => {
              const id = (e.target as HTMLSelectElement).value;
              edit((r) => {
                r.edgeList = id;
                r.node = undefined;
                r.edges = [];
              }, "Set runway edge list");
            }}
          >${(doc.edgeLists ?? []).map((list, i) =>
            html`<option value=${list.id} .selected=${
              runway.edgeList === list.id
            }>${list.label ?? `Edge List ${i + 1}`}</option>`
          )}${findEdgeList(doc, runway.edgeList)
            ? null
            : html`<option value=${runway.edgeList} selected>Missing Edge List</option>`}</select></label>
      </div>
      <div class="line">
        <span>${runway.node === undefined
          ? "Node: not picked"
          : `Node: ${runway.node + 1}`}</span>
        <span></span>
      </div>
      <div class="actions">
        <button
          type="button"
          class="pick"
          aria-pressed=${String(armed("node"))}
          title="Pick Node"
          aria-label="Click a node of the edge list on the surface to set the runway node"
          @click=${() => toggle("node")}
        >Pick Node</button>
        <button
          type="button"
          class="pick"
          aria-pressed=${String(armed("edges"))}
          title="Pick Edges"
          aria-label="Click edges of the edge list on the surface to add them to the runway or take them out"
          @click=${() => toggle("edges")}
        >Pick Edges</button>
      </div>
      <fieldset class="titled" aria-label="Runway Edges">
        <div class="group-title"><span>Runway Edges</span></div>
        ${runway.edges.length === 0
          ? html`<p class="placeholder">No edge picked yet.</p>`
          : runway.edges.map((e) =>
            html`
              <div class="line">
                <span>Edge ${e + 1}</span>
                <button
                  type="button"
                  class="subtle icon-button"
                  title="Remove Edge"
                  aria-label=${`Take edge ${e + 1} out of the runway`}
                  @click=${() =>
                    edit((r) => {
                      r.edges = r.edges.filter((x) => x !== e);
                    }, "Remove runway edge")}
                >${xIcon(12)}</button>
              </div>
            `
          )}
      </fieldset>
    `;
  }

  // Edge objects

  #edgeObject(): TemplateResult {
    const s = store.pathSelection;
    if (s?.kind !== "edgeObject") return html``;
    const object = store.selectedEdgeObject!;
    const doc = store.doc!;
    const edit = (
      change: (o: NonNullable<typeof object>) => void,
    ) => store.editEdgeObject(s.index, change);
    const list = findEdgeList(doc, object.edgeList);
    const edge = list?.edges[object.edge];
    const a = edge && list?.nodes[edge[0]];
    const b = edge && list?.nodes[edge[1]];
    const length = a && b ? edgeLength(a, b) : null;
    return html`
      <ce-icon-picker
        label="Edge Object"
        kind="edge-object"
        .dir=${store.dir}
        .value=${object.model}
        .autoOpen=${store.pendingObjectPick === s.index}
        @opened=${() => store.clearObjectPick()}
        @change=${(e: CustomEvent<{ value: string }>) =>
          edit((o) => {
            o.model = e.detail.value;
          })}
      ></ce-icon-picker>
      <div class="cols">
        <label class="field"><span>Edge List</span><select
            @change=${(e: Event) => {
              const id = (e.target as HTMLSelectElement).value;
              edit((o) => {
                o.edgeList = id;
                o.edge = 0;
              });
            }}
          >${(doc.edgeLists ?? []).map((l, i) =>
            html`<option value=${l.id} .selected=${object.edgeList === l.id}>${
              l.label ?? `Edge List ${i + 1}`
            }</option>`
          )}</select></label>
        <label class="field"><span>Edge</span><select
            @change=${(e: Event) => {
              const n = Number((e.target as HTMLSelectElement).value);
              edit((o) => {
                o.edge = n;
              });
            }}
          >${(list?.edges ?? []).map((_, i) =>
            html`<option value=${i} .selected=${object.edge === i}>Edge ${
              i + 1
            }</option>`
          )}</select></label>
      </div>
      <div class="cols">
        ${numberField(
          "Offset (m)",
          round(object.param),
          (v) =>
            edit((o) => {
              o.param = Math.max(0, v ?? 0);
            }),
          "any",
          false,
          0,
        )}
        ${checkboxField("Left Side", object.left, (v) =>
          edit((o) => {
            o.left = v;
          }))}
      </div>
      <p class="muted">${length === null
        ? "This edge is not in the edge list."
        : `The edge is ${
          round(length)
        } m long. The offset counts from its first node.`}</p>
    `;
  }
}

customElements.define("ce-path-properties", CePathProperties);
