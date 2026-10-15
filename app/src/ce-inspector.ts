import { css, html, LitElement } from "lit";
import "./ce-scene.ts";
import "./ce-properties.ts";
import "./ce-problems.ts";
import { sharedStyles } from "./styles.ts";

/** Right aside: the scene tree with its properties, and the Problems footer. */
export class CeInspector extends LitElement {
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
      .scene > h2 {
        margin-block-end: 0.5rem;
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
        flex: 0 0 30%;
        min-block-size: 7rem;
      }
    `,
  ];

  override render() {
    return html`
      <section class="scene" aria-label="Scene">
        <h2>Scene</h2>
        <ce-scene></ce-scene>
      </section>
      <ce-properties></ce-properties>
      <ce-problems></ce-problems>
    `;
  }
}

customElements.define("ce-inspector", CeInspector);
