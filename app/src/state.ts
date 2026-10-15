import { configure, reaction } from "mobx";
import { loadPersisted, savePersisted } from "./persist.ts";
import { EditorStore } from "./store.ts";

// Components set simple view settings (snap, Z band) directly on the store.
configure({ enforceActions: "never" });

export const store = new EditorStore();

/** `localStorage` can be missing or blocked, so every access is guarded. */
function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

let started = false;

/**
 * Loads config and mods, resumes the saved session, then keeps the saved
 * session current. Persistence starts only after the restore so the default
 * state never overwrites a saved one.
 */
export async function startApp(): Promise<void> {
  if (started) return;
  started = true;
  const local = storage();
  await store.start(local ? loadPersisted(local) : null);
  if (!local) return;

  const write = () => savePersisted(local, store.persistable);
  reaction(() => store.persistable, write, { delay: 150 });
  // The delay can swallow the last change, so write synchronously on exit.
  globalThis.addEventListener("pagehide", write);
  globalThis.addEventListener("beforeunload", write);
  write();
}
