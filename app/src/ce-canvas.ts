import { css, html, LitElement, svg } from "lit";
import { decomposeTransf, type Mat4, transformPoint } from "@cedit/schema";
import type { MdlSummary } from "./api.ts";
import { observer } from "./observer.ts";
import {
  ANGLE_STEPS,
  GRID_STEPS,
  type Segment,
  snapAngle,
  snapMove,
  type SnapSettings,
  type Vec2,
} from "./snapping.ts";
import { store } from "./state.ts";
import { sharedStyles } from "./styles.ts";
import "./ce-empty-state.ts";
import { surfaceIllustration } from "./illustrations.ts";

const VIEW_GRID_STEPS = [1, 5, 10, 50, 100, 500, 1000];
const MIN_GRID_PX = 28;
const MIN_SCALE = 0.5;
const MAX_SCALE = 200;
const SNAP_PX = 10;
const ROTATE_HANDLE_PX = 28;
const HANDLE_PX = 6;

const NO_SNAP: SnapSettings = {
  grid: null,
  vertex: false,
  edge: false,
  angle: null,
};

function gridStep(scale: number): number {
  return VIEW_GRID_STEPS.find((s) => s * scale >= MIN_GRID_PX) ?? 1000;
}

type Drag =
  | { kind: "pan"; x: number; y: number }
  | {
    kind: "move";
    sub: number;
    model: number;
    pointer: Vec2;
    start: { x: number; y: number; z: number; yaw: number; scale: number };
    sources: Vec2[];
    targets: Vec2[];
    segments: Segment[];
  }
  | {
    kind: "rotate";
    sub: number;
    model: number;
    origin: Vec2;
    startAngle: number;
    start: { x: number; y: number; z: number; yaw: number; scale: number };
  }
  | {
    kind: "scale";
    sub: number;
    model: number;
    origin: Vec2;
    startDistance: number;
    start: { x: number; y: number; z: number; yaw: number; scale: number };
  };

function localBox(summary: MdlSummary | undefined): Vec2[] {
  const [x0, y0, x1, y1] = summary
    ? [summary.bbMin[0], summary.bbMin[1], summary.bbMax[0], summary.bbMax[1]]
    : [-0.5, -0.5, 0.5, 0.5];
  return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
}

function toWorld(transf: Mat4, p: Vec2): Vec2 {
  const w = transformPoint(transf, [p[0], p[1], 0]);
  return [w[0], w[1]];
}

/** Top-down SVG view. World +Y points up, so drawing negates Y. */
export class CeCanvas extends observer(LitElement) {
  static override properties = {
    width: { state: true },
    height: { state: true },
    snapMark: { state: true },
    panning: { state: true },
  };
  static override styles = [
    sharedStyles,
    css`
      :host {
        background: var(--ce-canvas);
        display: block;
        overflow: hidden;
        position: relative;
      }
      svg {
        block-size: 100%;
        cursor: grab;
        display: block;
        inline-size: 100%;
        touch-action: none;
        user-select: none;
      }
      svg.panning {
        cursor: grabbing;
      }
      svg.eyedropper,
      svg.eyedropper .bbox {
        cursor: crosshair;
      }
      .grid {
        stroke: var(--ce-grid);
        stroke-width: 1;
        vector-effect: non-scaling-stroke;
      }
      .axis {
        stroke: var(--ce-muted);
        stroke-width: 1.5;
        vector-effect: non-scaling-stroke;
      }
      .bbox {
        cursor: move;
        fill: transparent;
        pointer-events: all;
        stroke: var(--ce-model);
        stroke-dasharray: 4 3;
        stroke-width: 1;
        vector-effect: non-scaling-stroke;
      }
      .outline {
        fill: var(--ce-model-fill);
        fill-rule: evenodd;
        pointer-events: none;
        stroke: var(--ce-model);
        stroke-width: 1.5;
        vector-effect: non-scaling-stroke;
      }
      .selected .bbox {
        stroke: var(--ce-accent);
        stroke-dasharray: none;
        stroke-width: 2;
      }
      .selected .outline {
        fill: var(--ce-selected);
        stroke: var(--ce-accent);
      }
      .label {
        fill: var(--ce-text);
        pointer-events: none;
      }
      .handle {
        fill: var(--ce-surface);
        stroke: var(--ce-accent);
        stroke-width: 2;
        vector-effect: non-scaling-stroke;
      }
      .handle.rotate {
        cursor: crosshair;
      }
      .handle.scale {
        cursor: nwse-resize;
      }
      .stem {
        stroke: var(--ce-accent);
        stroke-width: 1.5;
        vector-effect: non-scaling-stroke;
      }
      .snap-mark {
        fill: none;
        pointer-events: none;
        stroke: var(--ce-warning);
        stroke-width: 2;
        vector-effect: non-scaling-stroke;
      }
      .toolbar {
        align-items: center;
        z-index: 1;
        background: var(--ce-surface);
        border: 1px solid var(--ce-border);
        border-radius: 6px;
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        inset-block-start: 0.5rem;
        inset-inline-start: 0.5rem;
        padding-block: 0.25rem;
        padding-inline: 0.5rem;
        position: absolute;
      }
      .toolbar label {
        align-items: center;
        display: inline-flex;
        gap: 0.25rem;
      }
      .toolbar input[type="number"] {
        inline-size: 4.5rem;
      }
      .empty {
        block-size: 100%;
        cursor: default;
      }
      .hint {
        color: var(--ce-muted);
        inset-block-end: 0.5rem;
        inset-inline-start: 0.75rem;
        pointer-events: none;
        position: absolute;
      }
    `,
  ];

  // Pan and zoom live in the store so a reload restores the view.
  get cx(): number {
    return store.canvas.cx;
  }
  set cx(value: number) {
    store.canvas.cx = value;
  }
  get cy(): number {
    return store.canvas.cy;
  }
  set cy(value: number) {
    store.canvas.cy = value;
  }
  get scale(): number {
    return store.canvas.scale;
  }
  set scale(value: number) {
    store.canvas.scale = value;
  }
  declare width: number;
  declare height: number;
  declare snapMark: Vec2 | null;
  declare panning: boolean;
  #drag: Drag | null = null;
  #resize: ResizeObserver | undefined;

  constructor() {
    super();
    this.width = 800;
    this.height = 600;
    this.snapMark = null;
    this.panning = false;
  }

  override connectedCallback() {
    super.connectedCallback();
    this.#resize = new ResizeObserver(([entry]) => {
      this.width = entry.contentRect.width;
      this.height = entry.contentRect.height;
    });
    this.#resize.observe(this);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.#resize?.disconnect();
  }

  override render() {
    // Until a model is placed the surface is only the empty state: no grid,
    // no toolbar, no drag hint, and no pan cursor.
    const placed = store.doc?.subconstructions.some((s) => s.models.length > 0);
    if (!placed) return this.#empty();
    const { cx, cy, scale, width, height } = this;
    const halfW = width / 2 / scale;
    const halfH = height / 2 / scale;
    const viewBox = `${cx - halfW} ${-cy - halfH} ${width / scale} ${
      height / scale
    }`;
    return html`
      <svg
        class=${this.panning ? "panning" : store.eyedropper ? "eyedropper" : ""}
        viewBox=${viewBox}
        @wheel=${this.#wheel}
        @pointerdown=${this.#downBackground}
        @pointermove=${this.#move}
        @pointerup=${this.#up}
        @pointercancel=${this.#up}
      >
        ${this.#grid(cx - halfW, cx + halfW, cy - halfH, cy + halfH)}
        ${this.#models()} ${this.#gizmo()} ${this.#marker()}
      </svg>
      ${this.#toolbar()}
      <span class="hint">Drag an item to move it. Hold Alt to skip snapping.</span>
    `;
  }

  /** Prompt that fills the surface until the first model is placed. */
  #empty() {
    return html`
      <ce-empty-state
        class="empty"
        heading="Add a Model"
        text="Pick a model from the Assets Browser."
        .illustration=${surfaceIllustration}
      ></ce-empty-state>
    `;
  }

  #toolbar() {
    const snap = store.snap;
    const band = store.zBand;
    const num = (e: Event): number | null => {
      const raw = (e.target as HTMLInputElement).value.trim();
      return raw === "" || !Number.isFinite(Number(raw)) ? null : Number(raw);
    };
    return html`
      <div class="toolbar">
        <label>Grid <select @change=${(e: Event) => {
          const v = (e.target as HTMLSelectElement).value;
          snap.grid = v === "off" ? null : Number(v);
        }}>
          <option value="off" .selected=${snap.grid === null}>off</option>
          ${GRID_STEPS.map((g) =>
            html`<option value=${g} .selected=${
              snap.grid === g
            }>${g} m</option>`
          )}
        </select></label>
        <label><input type="checkbox" .checked=${snap.vertex}
          @change=${(
            e: Event,
          ) => (snap.vertex = (e.target as HTMLInputElement).checked)} />
          Vertex</label>
        <label><input type="checkbox" .checked=${snap.edge}
          @change=${(
            e: Event,
          ) => (snap.edge = (e.target as HTMLInputElement).checked)} />
          Edge</label>
        <label>Angle <select @change=${(e: Event) => {
          const v = (e.target as HTMLSelectElement).value;
          snap.angle = v === "off" ? null : Number(v);
        }}>
          <option value="off" .selected=${snap.angle === null}>off</option>
          ${ANGLE_STEPS.map((a) =>
            html`<option value=${a} .selected=${
              snap.angle === a
            }>${a}&deg;</option>`
          )}
        </select></label>
        <label>Z Min<input type="number" .value=${band.min === null
          ? ""
          : String(band.min)}
          @change=${(e: Event) => (band.min = num(e))} /></label>
        <label>Z Max<input type="number" .value=${band.max === null
          ? ""
          : String(band.max)}
          @change=${(e: Event) => (band.max = num(e))} /></label>
      </div>
    `;
  }

  #grid(x0: number, x1: number, y0: number, y1: number) {
    const step = gridStep(this.scale);
    const lines = [];
    for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) {
      lines.push(
        svg`
          <line class=${x === 0 ? "axis" : "grid"} x1=${x} x2=${x} y1=${-y1}
            y2=${-y0} />
        `,
      );
    }
    for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) {
      lines.push(
        svg`
          <line class=${y === 0 ? "axis" : "grid"} x1=${x0} x2=${x1} y1=${-y}
            y2=${-y} />
        `,
      );
    }
    return lines;
  }

  #models() {
    const doc = store.doc;
    if (!doc) return null;
    const sel = store.selection;
    const items = doc.subconstructions.flatMap((sub, si) =>
      sub.models.map((model, mi) => ({ si, mi, model }))
    ).filter(({ si, model }) => store.isVisible(si, model.transf[14]));
    const isSel = (si: number, mi: number) =>
      sel?.sub === si && sel.model === mi;
    items.sort((a, b) => Number(isSel(a.si, a.mi)) - Number(isSel(b.si, b.mi)));
    return items.map(({ si, mi, model }) => {
      const summary = store.summaries.get(model.id);
      const box = localBox(summary).map((p) => toWorld(model.transf, p));
      const points = box.map((c) => `${c[0]},${-c[1]}`).join(" ");
      const outline = summary?.outline?.map((loop) =>
        "M" +
        loop.map((p) => {
          const w = toWorld(model.transf, p);
          return `${w[0]},${-w[1]}`;
        }).join("L") + "Z"
      ).join(" ");
      const origin = toWorld(model.transf, [0, 0]);
      const name = model.id.slice(model.id.lastIndexOf("/") + 1);
      return svg`
        <g class=${isSel(si, mi) ? "selected" : ""}>
          ${outline ? svg`<path class="outline" d=${outline} />` : null}
          <polygon
            class="bbox"
            points=${points}
            @pointerdown=${(e: PointerEvent) => this.#downModel(e, si, mi)}
          />
          ${this.scale >= 6
            ? svg`
              <text class="label" x=${origin[0]} y=${-origin[1]}
                font-size=${11 / this.scale}>${name}</text>
            `
            : null}
        </g>
      `;
    });
  }

  #selectedGeometry() {
    const sel = store.selection;
    const placement = store.selectedPlacement;
    if (!sel || !placement || !store.isVisible(sel.sub, placement.transf[14])) {
      return null;
    }
    const summary = store.summaries.get(placement.id);
    const box = localBox(summary);
    const top: Vec2 = [(box[0][0] + box[2][0]) / 2, box[2][1]];
    const topWorld = toWorld(placement.transf, top);
    const up = Math.hypot(placement.transf[4], placement.transf[5]) || 1;
    const dir: Vec2 = [placement.transf[4] / up, placement.transf[5] / up];
    const reach = ROTATE_HANDLE_PX / this.scale;
    const rotate: Vec2 = [
      topWorld[0] + dir[0] * reach,
      topWorld[1] + dir[1] * reach,
    ];
    const corner = toWorld(placement.transf, box[2]);
    return { sel, placement, topWorld, rotate, corner };
  }

  #gizmo() {
    const g = this.#selectedGeometry();
    if (!g) return null;
    const r = HANDLE_PX / this.scale;
    return svg`
      <line class="stem" x1=${g.topWorld[0]} y1=${-g.topWorld[1]}
        x2=${g.rotate[0]} y2=${-g.rotate[1]} />
      <circle class="handle rotate" cx=${g.rotate[0]} cy=${-g.rotate[1]} r=${r}
        @pointerdown=${(e: PointerEvent) => this.#downRotate(e)} />
      <rect class="handle scale" x=${g.corner[0] - r} y=${-g.corner[1] - r}
        width=${r * 2} height=${r * 2}
        @pointerdown=${(e: PointerEvent) => this.#downScale(e)} />
    `;
  }

  #marker() {
    if (!this.snapMark) return null;
    const r = (HANDLE_PX + 3) / this.scale;
    return svg`
      <circle class="snap-mark" cx=${this.snapMark[0]}
        cy=${-this.snapMark[1]} r=${r} />
    `;
  }

  #pointerWorld(event: PointerEvent): Vec2 {
    const el = this.renderRoot.querySelector("svg")!;
    const point = el.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const p = point.matrixTransform(el.getScreenCTM()!.inverse());
    return [p.x, -p.y];
  }

  #capture(event: PointerEvent) {
    this.renderRoot.querySelector("svg")!.setPointerCapture(event.pointerId);
  }

  #wheel(event: WheelEvent) {
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
    this.scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, this.scale * factor));
  }

  #downBackground(event: PointerEvent) {
    this.#capture(event);
    this.#drag = { kind: "pan", x: event.clientX, y: event.clientY };
    this.panning = true;
    store.select(null);
  }

  #downModel(event: PointerEvent, sub: number, model: number) {
    event.stopPropagation();
    const doc = store.doc!;
    if (store.eyedropperActive) {
      store.select({ sub, model });
      void store.pickAsset(doc.subconstructions[sub].models[model].id);
      return;
    }
    this.#capture(event);
    store.activeSub = sub;
    store.select({ sub, model });
    const placement = doc.subconstructions[sub].models[model];
    const start = decomposeTransf(placement.transf);
    const summary = store.summaries.get(placement.id);
    const sources: Vec2[] = [
      [start.x, start.y],
      ...localBox(summary).map((p) => toWorld(placement.transf, p)),
    ];
    const targets: Vec2[] = [[0, 0]];
    const segments: Segment[] = [];
    doc.subconstructions.forEach((s, si) =>
      s.models.forEach((m, mi) => {
        if (
          (si === sub && mi === model) || !store.isVisible(si, m.transf[14])
        ) {
          return;
        }
        targets.push([m.transf[12], m.transf[13]]);
        const corners = localBox(store.summaries.get(m.id)).map((p) =>
          toWorld(m.transf, p)
        );
        targets.push(...corners);
        corners.forEach((c, i) => segments.push([c, corners[(i + 1) % 4]]));
      })
    );
    store.beginGesture();
    this.#drag = {
      kind: "move",
      sub,
      model,
      pointer: this.#pointerWorld(event),
      start,
      sources,
      targets,
      segments,
    };
  }

  #downRotate(event: PointerEvent) {
    const g = this.#selectedGeometry();
    if (!g) return;
    event.stopPropagation();
    this.#capture(event);
    const start = decomposeTransf(g.placement.transf);
    const origin: Vec2 = [start.x, start.y];
    const p = this.#pointerWorld(event);
    store.beginGesture();
    this.#drag = {
      kind: "rotate",
      sub: g.sel.sub,
      model: g.sel.model,
      origin,
      startAngle: Math.atan2(p[1] - origin[1], p[0] - origin[0]),
      start,
    };
  }

  #downScale(event: PointerEvent) {
    const g = this.#selectedGeometry();
    if (!g) return;
    event.stopPropagation();
    this.#capture(event);
    const start = decomposeTransf(g.placement.transf);
    const origin: Vec2 = [start.x, start.y];
    const p = this.#pointerWorld(event);
    store.beginGesture();
    this.#drag = {
      kind: "scale",
      sub: g.sel.sub,
      model: g.sel.model,
      origin,
      startDistance: Math.max(
        Math.hypot(p[0] - origin[0], p[1] - origin[1]),
        1e-6,
      ),
      start,
    };
  }

  #move(event: PointerEvent) {
    const drag = this.#drag;
    if (!drag) return;
    if (drag.kind === "pan") {
      this.cx -= (event.clientX - drag.x) / this.scale;
      this.cy += (event.clientY - drag.y) / this.scale;
      drag.x = event.clientX;
      drag.y = event.clientY;
      return;
    }
    const settings = event.altKey ? NO_SNAP : store.snap;
    const p = this.#pointerWorld(event);
    if (drag.kind === "move") {
      const dx = p[0] - drag.pointer[0];
      const dy = p[1] - drag.pointer[1];
      const moved = drag.sources.map((s): Vec2 => [s[0] + dx, s[1] + dy]);
      const snapped = snapMove(
        moved,
        drag.targets,
        drag.segments,
        settings,
        SNAP_PX / this.scale,
      );
      this.snapMark = snapped.target ?? null;
      store.setPlacementTransf(drag.sub, drag.model, {
        ...drag.start,
        x: drag.start.x + dx + snapped.delta[0],
        y: drag.start.y + dy + snapped.delta[1],
      });
    } else if (drag.kind === "rotate") {
      const angle = Math.atan2(p[1] - drag.origin[1], p[0] - drag.origin[0]);
      const yaw = snapAngle(
        drag.start.yaw + (angle - drag.startAngle),
        settings.angle,
      );
      store.setPlacementTransf(drag.sub, drag.model, { ...drag.start, yaw });
    } else {
      const dist = Math.hypot(p[0] - drag.origin[0], p[1] - drag.origin[1]);
      const raw = drag.start.scale * (dist / drag.startDistance);
      const scale = Math.min(100, Math.max(0.05, Math.round(raw * 100) / 100));
      store.setPlacementTransf(drag.sub, drag.model, { ...drag.start, scale });
    }
  }

  #up() {
    if (this.#drag && this.#drag.kind !== "pan") store.endGesture();
    this.#drag = null;
    this.panning = false;
    this.snapMark = null;
  }
}

customElements.define("ce-canvas", CeCanvas);
