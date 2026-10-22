import { css, html, LitElement, svg } from "lit";
import { basename } from "@std/path/posix";
import {
  decomposeTransf,
  edgeCrossesPolyline,
  type GroundFaceDoc,
  type Mat4,
  transformPoint,
} from "@cedit/schema";
import { gtexImageUrl, type MdlSummary } from "./api.ts";
import { observer } from "./observer.ts";
import {
  type Segment,
  snapAngle,
  snapMove,
  type SnapSettings,
  type Vec2,
} from "./snapping.ts";
import { store } from "./state.ts";
import { sharedStyles } from "./styles.ts";
import "./ce-canvas-toolbar.ts";
import "./ce-empty-state.ts";
import { surfaceIllustration } from "./illustrations.ts";

const VIEW_GRID_STEPS = [1, 5, 10, 50, 100, 500, 1000];
const MIN_GRID_PX = 28;
const MIN_SCALE = 0.5;
const MAX_SCALE = 200;
const SNAP_PX = 10;
const ROTATE_HANDLE_PX = 28;
const HANDLE_PX = 6;
/** Side of one texture preview tile on a ground face, in meters. */
const TILE_M = 4;

/** Points and edges that a dragged or drawn ground face point can snap to. */
interface SnapSet {
  targets: Vec2[];
  segments: Segment[];
}

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
  }
  | {
    kind: "face";
    sub: number;
    face: number;
    pointer: Vec2;
    start: Vec2[];
    set: SnapSet;
  }
  | {
    kind: "vertex";
    sub: number;
    face: number;
    vertex: number;
    pointer: Vec2;
    start: Vec2[];
    set: SnapSet;
  }
  | { kind: "rect"; anchor: Vec2; set: SnapSet };

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
    cursor: { state: true },
    rectEnd: { state: true },
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
      svg.eyedropper .bbox,
      svg.drawing,
      svg.drawing .bbox,
      svg.drawing .face-body {
        cursor: crosshair;
      }
      .face-body {
        cursor: move;
        fill: color-mix(in srgb, var(--ce-accent) 16%, transparent);
        pointer-events: all;
        stroke: var(--ce-accent);
        stroke-width: 1;
        vector-effect: non-scaling-stroke;
      }
      .face-fill {
        fill-opacity: 0.7;
        pointer-events: none;
      }
      .selected .face-body {
        stroke-width: 2;
      }
      .face-stroke {
        fill: none;
        pointer-events: none;
        stroke-width: 3;
        vector-effect: non-scaling-stroke;
      }
      .face-stroke.stroke {
        stroke: var(--ce-warning);
      }
      .face-stroke.stroke_outer {
        stroke: var(--ce-accent);
        stroke-dasharray: 6 3;
      }
      .face-stroke.stroke_inner {
        stroke: var(--ce-model);
        stroke-dasharray: 2 3;
      }
      .vertex {
        cursor: move;
        fill: var(--ce-surface);
        stroke: var(--ce-accent);
        stroke-width: 2;
        vector-effect: non-scaling-stroke;
      }
      .vertex.picked {
        fill: var(--ce-accent);
      }
      .draft {
        fill: color-mix(in srgb, var(--ce-accent) 12%, transparent);
        pointer-events: none;
        stroke: var(--ce-accent);
        stroke-dasharray: 4 3;
        stroke-width: 1.5;
        vector-effect: non-scaling-stroke;
      }
      .draft-dot {
        fill: var(--ce-accent);
        pointer-events: none;
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
  /** Snapped pointer position while a tool is armed, for the rubber band. */
  declare cursor: Vec2 | null;
  /** Far corner of the rectangle being dragged. */
  declare rectEnd: Vec2 | null;
  #drag: Drag | null = null;
  #resize: ResizeObserver | undefined;

  constructor() {
    super();
    this.width = 800;
    this.height = 600;
    this.snapMark = null;
    this.panning = false;
    this.cursor = null;
    this.rectEnd = null;
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
    // An armed drawing tool also shows the surface, so the first item can be
    // a ground face.
    if (!store.hasContent && store.tool === "select") return this.#empty();
    const { cx, cy, scale, width, height } = this;
    const halfW = width / 2 / scale;
    const halfH = height / 2 / scale;
    const viewBox = `${cx - halfW} ${-cy - halfH} ${width / scale} ${
      height / scale
    }`;
    return html`
      <svg
        class=${this.panning
          ? "panning"
          : store.eyedropper
          ? "eyedropper"
          : store.tool !== "select"
          ? "drawing"
          : ""}
        viewBox=${viewBox}
        @wheel=${this.#wheel}
        @pointerdown=${this.#downBackground}
        @pointermove=${this.#move}
        @pointerup=${this.#up}
        @pointercancel=${this.#up}
      >
        ${this.#grid(cx - halfW, cx + halfW, cy - halfH, cy + halfH)}
        ${this.#faces()} ${this.#models()} ${this.#faceHandles()}
        ${this.#gizmo()} ${this.#draft()} ${this.#marker()}
      </svg>
      <ce-canvas-toolbar></ce-canvas-toolbar>
      <span class="hint">${this.#hint()}</span>
    `;
  }

  #hint(): string {
    if (store.tool === "face") {
      return store.faceDraft.length >= 3
        ? "Click to add a point. Click the first point, double-click, or press Enter to close. Esc cancels."
        : "Click to add points. Hold Alt to skip snapping. Esc cancels.";
    }
    if (store.tool === "rect") {
      return "Drag to draw a rectangle. Hold Alt to skip snapping. Esc cancels.";
    }
    return "Drag an item to move it. Hold Alt to skip snapping.";
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
      const name = basename(model.id);
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

  /** Everything a ground face point can snap to, minus the face being moved. */
  #snapSet(skip: { sub: number; face: number } | null): SnapSet {
    const targets: Vec2[] = [[0, 0]];
    const segments: Segment[] = [];
    store.doc?.subconstructions.forEach((layer, si) => {
      layer.models.forEach((m) => {
        if (!store.isVisible(si, m.transf[14])) return;
        const summary = store.summaries.get(m.id);
        const corners = localBox(summary).map((p) => toWorld(m.transf, p));
        targets.push([m.transf[12], m.transf[13]], ...corners);
        corners.forEach((c, i) => segments.push([c, corners[(i + 1) % 4]]));
        for (const loop of summary?.outline ?? []) {
          for (const p of loop) targets.push(toWorld(m.transf, p));
        }
      });
      (layer.groundFaces ?? []).forEach((face, fi) => {
        if (skip?.sub === si && skip.face === fi) return;
        if (!store.isFaceVisible(si)) return;
        face.points.forEach((p, i) => {
          const next = face.points[(i + 1) % face.points.length];
          targets.push([p[0], p[1]]);
          segments.push([[p[0], p[1]], [next[0], next[1]]]);
        });
      });
    });
    return { targets, segments };
  }

  /**
   * Snaps a point. With `prev`, the edge from `prev` to the point first snaps
   * to the angle step, and the grid no longer applies, since it would move the
   * point off that angle.
   */
  #snapPoint(
    p: Vec2,
    set: SnapSet,
    event: PointerEvent,
    prev?: Vec2,
  ): Vec2 {
    const settings = event.altKey ? NO_SNAP : store.snap;
    let candidate = p;
    let use = settings;
    if (prev && settings.angle !== null) {
      const angle = snapAngle(
        Math.atan2(p[1] - prev[1], p[0] - prev[0]),
        settings.angle,
      );
      const length = Math.hypot(p[0] - prev[0], p[1] - prev[1]);
      candidate = [
        prev[0] + Math.cos(angle) * length,
        prev[1] + Math.sin(angle) * length,
      ];
      use = { ...settings, grid: null };
    }
    const snapped = snapMove(
      [candidate],
      set.targets,
      set.segments,
      use,
      SNAP_PX / this.scale,
    );
    this.snapMark = snapped.target ?? null;
    return [candidate[0] + snapped.delta[0], candidate[1] + snapped.delta[1]];
  }

  #faces() {
    const doc = store.doc;
    if (!doc) return null;
    const fs = store.faceSelection;
    const items = doc.subconstructions.flatMap((layer, si) =>
      (layer.groundFaces ?? []).map((face, fi) => ({ si, fi, face }))
    ).filter(({ si }) => store.isFaceVisible(si));
    const isSel = (si: number, fi: number) => fs?.sub === si && fs.face === fi;
    items.sort((a, b) => Number(isSel(a.si, a.fi)) - Number(isSel(b.si, b.fi)));
    const patterns = new Map<string, string>();
    const patternFor = (key: string) => {
      let id = patterns.get(key);
      if (id === undefined) patterns.set(key, id = `gtex-${patterns.size}`);
      return id;
    };
    const drawn = items.map(({ si, fi, face }) => {
      const ring = face.points.map((p) => `${p[0]},${-p[1]}`).join(" ");
      const fill = face.modes.find((m) => m.type === "FILL" && m.key !== "");
      const strokes = face.modes.filter((m) => m.type !== "FILL");
      return svg`
        <g class=${isSel(si, fi) ? "selected" : ""}>
          <polygon
            class="face-body"
            points=${ring}
            @pointerdown=${(e: PointerEvent) => this.#downFace(e, si, fi)}
          />
          ${fill
            ? svg`
              <polygon class="face-fill" points=${ring}
                fill="url(#${patternFor(fill.key)})" />
            `
            : null}
          ${strokes.map((mode) =>
            face.loop === false
              ? svg`
                <polyline class="face-stroke ${mode.type.toLowerCase()}"
                  points=${ring} />
              `
              : svg`
                <polygon class="face-stroke ${mode.type.toLowerCase()}"
                  points=${ring} />
              `
          )}
        </g>
      `;
    });
    return svg`
      <defs>
        ${[...patterns].map(([key, id]) =>
          svg`
            <pattern id=${id} patternUnits="userSpaceOnUse" width=${TILE_M}
              height=${TILE_M}>
              <image href=${gtexImageUrl(store.dir, key, 128)} width=${TILE_M}
                height=${TILE_M} preserveAspectRatio="none" />
            </pattern>
          `
        )}
      </defs>
      ${drawn}
    `;
  }

  /** Vertex handles of the selected face, drawn over the models. */
  #faceHandles() {
    const s = store.faceSelection;
    const face = store.selectedFace;
    if (!s || !face || store.tool !== "select") return null;
    if (!store.isFaceVisible(s.sub)) return null;
    const r = HANDLE_PX / this.scale;
    return face.points.map((p, i) =>
      svg`
        <circle
          class=${s.vertex === i ? "vertex picked" : "vertex"}
          cx=${p[0]}
          cy=${-p[1]}
          r=${r}
          @pointerdown=${(e: PointerEvent) =>
            this.#downVertex(e, s.sub, s.face, i)}
        />
      `
    );
  }

  /** The polygon being clicked out, or the rectangle being dragged. */
  #draft() {
    const r = (HANDLE_PX - 2) / this.scale;
    if (store.tool === "rect" && this.#drag?.kind === "rect" && this.rectEnd) {
      const a = this.#drag.anchor;
      const b = this.rectEnd;
      return svg`
        <rect class="draft" x=${Math.min(a[0], b[0])}
          y=${-Math.max(a[1], b[1])} width=${Math.abs(a[0] - b[0])}
          height=${Math.abs(a[1] - b[1])} />
      `;
    }
    const draft = store.faceDraft;
    if (store.tool !== "face" || draft.length === 0) return null;
    const pts = this.cursor ? [...draft, this.cursor] : draft;
    const ring = pts.map((p) => `${p[0]},${-p[1]}`).join(" ");
    return svg`
      <polygon class="draft" points=${ring} />
      ${draft.map((p, i) =>
        svg`
          <circle class="draft-dot" cx=${p[0]} cy=${-p[1]}
            r=${i === 0 && draft.length >= 3 ? r * 1.8 : r} />
        `
      )}
    `;
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
    // The middle button pans while a drawing tool is armed.
    if (store.tool !== "select" && event.button !== 1) {
      this.#downTool(event);
      return;
    }
    this.#drag = { kind: "pan", x: event.clientX, y: event.clientY };
    this.panning = true;
    store.select(null);
  }

  /** A click or drag with the polygon or rectangle tool. */
  #downTool(event: PointerEvent) {
    const set = this.#snapSet(null);
    const raw = this.#pointerWorld(event);
    if (store.tool === "rect") {
      const anchor = this.#snapPoint(raw, set, event);
      this.#drag = { kind: "rect", anchor, set };
      this.rectEnd = anchor;
      return;
    }
    const draft = store.faceDraft;
    const first = draft[0];
    const nearFirst = first !== undefined && draft.length >= 3 &&
      Math.hypot(raw[0] - first[0], raw[1] - first[1]) * this.scale <=
        SNAP_PX * 1.5;
    // The first click of a double-click already added its point.
    if (nearFirst || (event.detail >= 2 && draft.length >= 3)) {
      store.closeDraft();
      this.cursor = null;
      return;
    }
    const prev = draft.at(-1);
    const point = this.#snapPoint(raw, set, event, prev);
    if (prev && point[0] === prev[0] && point[1] === prev[1]) return;
    // An edge that crosses the polygon so far would make a bow-tie.
    if (prev && edgeCrossesPolyline(draft, prev, point)) return;
    store.addDraftPoint(point);
  }

  #downFace(event: PointerEvent, sub: number, face: number) {
    // With a drawing tool armed the click goes on to the surface.
    if (store.tool !== "select") return;
    event.stopPropagation();
    const target = store.doc?.subconstructions[sub].groundFaces?.[face];
    if (!target) return;
    this.#capture(event);
    store.activeSub = sub;
    store.selectFace({ sub, face, vertex: null });
    store.beginGesture();
    this.#drag = {
      kind: "face",
      sub,
      face,
      pointer: this.#pointerWorld(event),
      start: target.points.map((p): Vec2 => [p[0], p[1]]),
      set: this.#snapSet({ sub, face }),
    };
  }

  #downVertex(event: PointerEvent, sub: number, face: number, vertex: number) {
    event.stopPropagation();
    const target: GroundFaceDoc | undefined = store.doc?.subconstructions[sub]
      .groundFaces?.[face];
    if (!target) return;
    this.#capture(event);
    store.selectFace({ sub, face, vertex });
    store.beginGesture();
    this.#drag = {
      kind: "vertex",
      sub,
      face,
      vertex,
      pointer: this.#pointerWorld(event),
      start: target.points.map((p): Vec2 => [p[0], p[1]]),
      set: this.#snapSet({ sub, face }),
    };
  }

  #downModel(event: PointerEvent, sub: number, model: number) {
    // With a drawing tool armed the click goes on to the surface.
    if (store.tool !== "select") return;
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
    if (!drag) {
      // The rubber band follows the pointer between clicks.
      if (store.tool === "face") {
        this.cursor = this.#snapPoint(
          this.#pointerWorld(event),
          this.#snapSet(null),
          event,
          store.faceDraft.at(-1),
        );
      }
      return;
    }
    if (drag.kind === "pan") {
      this.cx -= (event.clientX - drag.x) / this.scale;
      this.cy += (event.clientY - drag.y) / this.scale;
      drag.x = event.clientX;
      drag.y = event.clientY;
      return;
    }
    const settings = event.altKey ? NO_SNAP : store.snap;
    const p = this.#pointerWorld(event);
    if (drag.kind === "rect") {
      this.rectEnd = this.#snapPoint(p, drag.set, event);
      return;
    }
    if (drag.kind === "face") {
      const dx = p[0] - drag.pointer[0];
      const dy = p[1] - drag.pointer[1];
      const moved = drag.start.map((s): Vec2 => [s[0] + dx, s[1] + dy]);
      const snapped = snapMove(
        moved,
        drag.set.targets,
        drag.set.segments,
        settings,
        SNAP_PX / this.scale,
      );
      this.snapMark = snapped.target ?? null;
      store.setFacePoints(
        drag.sub,
        drag.face,
        drag.start.map((s): Vec2 => [
          s[0] + dx + snapped.delta[0],
          s[1] + dy + snapped.delta[1],
        ]),
      );
      return;
    }
    if (drag.kind === "vertex") {
      const at = drag.start[drag.vertex];
      const moved: Vec2 = [
        at[0] + p[0] - drag.pointer[0],
        at[1] + p[1] - drag.pointer[1],
      ];
      const snapped = snapMove(
        [moved],
        drag.set.targets,
        drag.set.segments,
        settings,
        SNAP_PX / this.scale,
      );
      this.snapMark = snapped.target ?? null;
      const points = drag.start.map((s): Vec2 => [s[0], s[1]]);
      points[drag.vertex] = [
        moved[0] + snapped.delta[0],
        moved[1] + snapped.delta[1],
      ];
      const result = store.setFacePoints(
        drag.sub,
        drag.face,
        points,
        drag.vertex,
      );
      if (result.reversed) {
        // The drag turned the polygon clockwise and it was reversed, so keep
        // dragging the same point from where it now sits.
        const now =
          store.doc!.subconstructions[drag.sub].groundFaces![drag.face]
            .points;
        drag.start = now.map((q): Vec2 => [q[0], q[1]]);
        drag.vertex = result.vertex;
        drag.pointer = p;
      }
      return;
    }
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
    const drag = this.#drag;
    if (drag?.kind === "rect") {
      const end = this.rectEnd ?? drag.anchor;
      this.#drag = null;
      this.rectEnd = null;
      store.addRectangle(drag.anchor, end);
    }
    if (drag && drag.kind !== "pan" && drag.kind !== "rect") store.endGesture();
    this.#drag = null;
    this.panning = false;
    this.snapMark = null;
  }
}

customElements.define("ce-canvas", CeCanvas);
