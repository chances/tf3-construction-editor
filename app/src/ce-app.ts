import { css, html, LitElement } from "lit";
import { decomposeTransf } from "@cedit/schema";
import "./ce-confirm-dialog.ts";
import "./ce-wizard.ts";
import "./ce-editor.ts";
import { observer } from "./observer.ts";
import { startApp, store } from "./state.ts";
import { sharedStyles } from "./styles.ts";

export class CeApp extends observer(LitElement) {
  static override styles = [
    sharedStyles,
    css`
      :host {
        background: var(--ce-canvas);
        block-size: 100vh;
        display: block;
      }
      ce-editor,
      ce-wizard {
        block-size: 100%;
      }
    `,
  ];

  override connectedCallback() {
    super.connectedCallback();
    globalThis.addEventListener("keydown", this.#keydown);
    void startApp();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    globalThis.removeEventListener("keydown", this.#keydown);
  }

  #keydown = (event: KeyboardEvent) => {
    if (store.view !== "editor") return;
    const origin = event.composedPath()[0];
    if (
      origin instanceof HTMLInputElement ||
      origin instanceof HTMLTextAreaElement ||
      origin instanceof HTMLSelectElement
    ) return;
    const key = event.key.toLowerCase();
    const mod = event.ctrlKey || event.metaKey;
    if (mod && key === "z") {
      event.preventDefault();
      if (event.shiftKey) store.redo();
      else store.undo();
    } else if (mod && key === "y") {
      event.preventDefault();
      store.redo();
    } else if (key === "escape") {
      if (store.runwayPick) {
        event.preventDefault();
        store.beginRunwayPick(null);
      } else if (store.tool !== "select") {
        event.preventDefault();
        store.setTool("select");
      }
    } else if (key === "enter") {
      if (store.tool === "face" && store.faceDraft.length > 0) {
        event.preventDefault();
        store.closeDraft();
      } else if (
        (store.tool === "lane" || store.tool === "edges") &&
        store.pathDraft.length > 0
      ) {
        event.preventDefault();
        store.finishPathDraft();
      }
    } else if (key === "delete" || key === "backspace") {
      const face = store.faceSelection;
      if (store.pathSelection) {
        event.preventDefault();
        store.removeSelectedPath();
      } else if (store.selection) {
        event.preventDefault();
        store.removeSelected();
      } else if (face?.vertex != null) {
        event.preventDefault();
        store.removeFaceVertex(face.sub, face.face, face.vertex);
      } else if (face) {
        event.preventDefault();
        store.removeSelectedFace();
      }
    } else if (key.startsWith("arrow") && store.selectedPlacement) {
      event.preventDefault();
      const step = (store.snap.grid ?? 1) * (event.shiftKey ? 5 : 1);
      const t = decomposeTransf(store.selectedPlacement.transf);
      const dx = key === "arrowleft" ? -step : key === "arrowright" ? step : 0;
      const dy = key === "arrowdown" ? -step : key === "arrowup" ? step : 0;
      store.patchSelectedPlacement({ x: t.x + dx, y: t.y + dy });
    }
  };

  override render() {
    // Loading is an implicit wizard step: the wizard shows the spinner in its
    // card, so the editor appears only after everything it needs has loaded.
    const loading = !store.ready || store.loadingVisible;
    const page = !loading && store.view === "editor" && store.doc
      ? html`<ce-editor></ce-editor>`
      : html`<ce-wizard></ce-wizard>`;
    return html`${page}<ce-confirm-dialog></ce-confirm-dialog>`;
  }
}

customElements.define("ce-app", CeApp);
