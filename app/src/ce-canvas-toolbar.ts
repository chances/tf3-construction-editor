import { css, html, LitElement } from "lit";
import { live } from "lit/directives/live.js";
import { observer } from "./observer.ts";
import { ANGLE_STEPS, GRID_STEPS } from "./snapping.ts";
import { store } from "./state.ts";
import { sharedStyles } from "./styles.ts";
import {
  angleIcon,
  edgeIcon,
  gridIcon,
  infinityIcon,
  magnetIcon,
  polygonIcon,
  vertexIcon,
  zBandIcon,
} from "./icons.ts";
import "./ce-range-slider.ts";
import "./ce-toggle-button.ts";
import type { RangeChange } from "./ce-range-slider.ts";

/** Z extent shown when no model is placed. */
const DEFAULT_Z = { min: -10, max: 10 };

/** Snapping and Z band controls over the canvas. */
export class CeCanvasToolbar extends observer(LitElement) {
  static override styles = [
    sharedStyles,
    css`
      :host {
        z-index: 1;
        background: var(--ce-surface);
        border: 1px solid var(--ce-border);
        border-radius: 6px;
        align-items: stretch;
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        inset-block-start: 0.5rem;
        inset-inline: 0.5rem;
        overflow: hidden;
        position: absolute;
      }
      label {
        align-items: center;
        display: inline-flex;
        gap: 0.25rem;
      }
      .controls__group {
        align-items: stretch;
        display: flex;
        flex: 1 1 auto;
        gap: 0.5rem;
        justify-content: space-between;
        padding-inline-end: 0.5rem;
      }
      .controls__group.tools {
        flex: none;
        justify-content: flex-start;
        padding-inline-end: 0.5rem;
      }
      .controls__group > :not(.controls__label) {
        align-self: center;
      }
      :host(.wrapped) .controls__group:not(:last-child) .controls__label {
        border-block-end: 1px solid var(--ce-border);
      }
      .controls__label {
        align-items: center;
        background: var(--ce-canvas);
        border-inline-end: 1px solid var(--ce-border);
        box-sizing: border-box;
        display: inline-flex;
        font-weight: 600;
        gap: 0.25rem;
        min-inline-size: var(--label-size, 0);
        padding: 0.5rem;
      }
      ce-range-slider {
        flex: 1;
        min-inline-size: 16rem;
      }
    `,
  ];

  #resize: ResizeObserver | undefined;

  override connectedCallback() {
    super.connectedCallback();
    // The groups wrap when they no longer fit, which CSS cannot report, so the
    // host carries a `wrapped` class while a group sits below another. Wrapped
    // labels all take the width of the widest one, measured at natural width.
    this.#resize = new ResizeObserver(() => {
      this.style.removeProperty("--label-size");
      const groups = [
        ...this.renderRoot.querySelectorAll<HTMLElement>(".controls__group"),
      ];
      const wrapped = new Set(groups.map((g) => g.offsetTop)).size > 1;
      this.classList.toggle("wrapped", wrapped);
      if (!wrapped) return;
      const widest = Math.max(
        ...[...this.renderRoot.querySelectorAll<HTMLElement>(
          ".controls__label",
        )].map((l) => l.offsetWidth),
      );
      this.style.setProperty("--label-size", `${widest}px`);
    });
    this.#resize.observe(this);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.#resize?.disconnect();
  }

  /** Whole-metre Z extent of the placed models, so the thumbs span them. */
  #zExtent(): { min: number; max: number } {
    const zs =
      store.doc?.subconstructions.flatMap((s) =>
        s.models.map((m) => m.transf[14])
      ) ?? [];
    if (zs.length === 0) return DEFAULT_Z;
    const min = Math.floor(Math.min(...zs));
    const max = Math.ceil(Math.max(...zs));
    return max > min ? { min, max } : { min, max: min + 1 };
  }

  override render() {
    const snap = store.snap;
    const band = store.zBand;
    const extent = this.#zExtent();
    return html`
      <div class="controls__group tools">
        <span class="controls__label">${polygonIcon(14)} Tool</span>
        ${([
          ["select", "pointer", "Select", "Select and move items"],
          ["face", "polygon", "Ground Face", "Click out a ground face polygon"],
          [
            "rect",
            "rectangle",
            "Ground Face Rectangle",
            "Drag a rectangular ground face",
          ],
        ] as const).map(([tool, icon, title, label]) =>
          html`
            <ce-toggle-button
              variant="icon subtle"
              icon=${icon}
              title=${title}
              label=${label}
              .pressed=${live(store.tool === tool)}
              @change=${() =>
                store.setTool(store.tool === tool ? "select" : tool)}
            ></ce-toggle-button>
          `
        )}
      </div>
      <div class="controls__group">
        <span class="controls__label">${magnetIcon(14)} Snapping</span>
        <label>${gridIcon(14)} Grid <select @change=${(e: Event) => {
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
        <label>${vertexIcon(14)} <input type="checkbox" .checked=${snap.vertex}
          @change=${(
            e: Event,
          ) => (snap.vertex = (e.target as HTMLInputElement).checked)} />
          Vertex</label>
        <label>${edgeIcon(14)} <input type="checkbox" .checked=${snap.edge}
          @change=${(
            e: Event,
          ) => (snap.edge = (e.target as HTMLInputElement).checked)} />
          Edge</label>
        <label>${angleIcon(14)} Angle <select @change=${(e: Event) => {
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
      </div>
      <div class="controls__group">
        <span class="controls__label">${zBandIcon(14)} Z Band</span>
        <ce-range-slider
          variant="compact"
          .min=${Math.min(extent.min, band.min ?? extent.min)}
          .max=${Math.max(extent.max, band.max ?? extent.max)}
          .step=${0.1}
          .from=${band.min ?? undefined}
          .to=${band.max ?? undefined}
          .openStart=${undefined}
          .openIcon=${infinityIcon}
          startLabel="No Min"
          foreverLabel="No Max"
          fromLabel="Z Min"
          toLabel="Z Max"
          @change=${(e: CustomEvent<RangeChange>) => {
            band.min = e.detail.from ?? null;
            band.max = e.detail.to ?? null;
          }}
        ></ce-range-slider>
      </div>
    `;
  }
}

customElements.define("ce-canvas-toolbar", CeCanvasToolbar);
