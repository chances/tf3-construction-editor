import { css, html, LitElement } from "lit";
import "./ce-scene.ts";
import "./ce-properties.ts";
import "./ce-problems.ts";
import "./ce-toggle-button.ts";
import { plusIcon } from "./icons.ts";
import { observer } from "./observer.ts";
import { store } from "./state.ts";
import { sharedStyles } from "./styles.ts";

/** Right aside: the scene tree with its properties, and the Problems footer. */
export class CeInspector extends observer(LitElement) {
  static override styles = [
    sharedStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        min-block-size: 0;
        overflow: hidden;
      }
      .scene {
        flex: 0 0 auto;
        padding: 0.75rem;
      }
      /* The title sits at one end and its action at the other. */
      .scene > hgroup {
        align-items: center;
        display: flex;
        gap: 0.5rem;
        justify-content: space-between;
        margin-block-end: 0.5rem;
      }
      .scene > hgroup h2 {
        margin: 0;
      }
      .scene > hgroup .tools {
        align-items: center;
        display: flex;
        gap: 0.25rem;
      }
      .scene > hgroup button {
        align-items: center;
        display: inline-flex;
        justify-content: center;
        block-size: 1.5rem;
        box-sizing: border-box;
        inline-size: 1.5rem;
        line-height: 1;
        padding: 0;
      }
      ce-properties {
        border-block-start: 1px solid var(--ce-border);
        flex: 1 1 auto;
        min-block-size: 0;
        overflow-y: auto;
        padding-block: 0 0.75rem;
        padding-inline: 0.75rem;
      }
      ce-problems {
        border-block-start: 1px solid var(--ce-border);
        flex: 0 1 auto;
      }
    `,
  ];

  override render() {
    return html`
      <section class="scene" aria-label="Scene">
        <hgroup>
          <h2>Scene</h2>
          <div class="tools">
            <ce-toggle-button
              variant="icon"
              icon="pipette"
              title=${store.hasModels
                ? "Pick a model in the scene"
                : "Add a model to the scene to pick one"}
              label="Pick a model in the surface to find it in Assets"
              ?disabled=${!store.hasModels}
              .pressed=${store.eyedropperActive}
              @change=${(e: CustomEvent<boolean>) =>
                store.eyedropper = e.detail}
            ></ce-toggle-button>
            <button
              type="button"
              ?disabled=${!store.doc}
              aria-label="Add a new subconstruction layer to the scene"
              title="Add Subconstruction"
              @click=${() => store.addSubconstruction()}
            >
              ${plusIcon(12)}
            </button>
          </div>
        </hgroup>
        <ce-scene></ce-scene>
      </section>
      <ce-properties></ce-properties>
      <ce-problems></ce-problems>
    `;
  }
}

customElements.define("ce-inspector", CeInspector);
