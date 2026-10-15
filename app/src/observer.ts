import { Reaction } from "mobx";
import type { LitElement, PropertyValues } from "lit";

// deno-lint-ignore no-explicit-any
type Constructor<T> = new (...args: any[]) => T;

/**
 * Re-renders a Lit element when an observable read during `render` changes.
 * The reaction tracks `update`, so every MobX read in `render` is covered.
 */
export function observer<T extends Constructor<LitElement>>(Base: T): T {
  class Observer extends Base {
    #reaction: Reaction | undefined;

    override connectedCallback() {
      this.#reaction = new Reaction(
        `${this.localName}`,
        () => this.requestUpdate(),
      );
      super.connectedCallback();
    }

    override disconnectedCallback() {
      super.disconnectedCallback();
      this.#reaction?.dispose();
      this.#reaction = undefined;
    }

    protected override update(changed: PropertyValues) {
      const reaction = this.#reaction;
      if (reaction) reaction.track(() => super.update(changed));
      else super.update(changed);
    }
  }
  return Observer;
}
