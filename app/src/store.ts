import { makeAutoObservable, observable, runInAction, toJS } from "mobx";
import {
  composeTransf,
  type ConstructionDoc,
  decomposeTransf,
  type Issue,
  type ModInfoJson,
  type ModJson,
  newSubconstruction,
  type PositionYaw,
} from "@cedit/schema";
import { History, SnapshotCommand } from "./history.ts";
import { type PersistedState, STORAGE_VERSION } from "./persist.ts";
import { defaultSnap, type SnapSettings } from "./snapping.ts";
import {
  api,
  type AssetListing,
  type ExportOutcome,
  type LoadedMod,
  type MdlSummary,
  type ModListing,
} from "./api.ts";

export interface Selection {
  sub: number;
  model: number;
}

export interface PlacementPatch {
  x?: number;
  y?: number;
  z?: number;
  /** Degrees. */
  yawDeg?: number;
  scale?: number;
}

const SAVE_DELAY_MS = 400;
const SEARCH_DELAY_MS = 200;
/**
 * Minimum time any loading state stays on screen once shown, including the
 * first load, so it never blinks or flickers.
 */
const SPINNER_MIN_MS = 500;

/** Wizard steps, then the editor page. */
export type View = "mods" | "details" | "constructions" | "editor";

/** What the Properties section shows. */
export type InspectTarget = "construction" | "layer" | "model";

export class EditorStore {
  view: View = "mods";
  inspectTarget: InspectTarget = "construction";
  modsRoot = "";
  /** `null` when the server has no base game folder configured. */
  installRoot: string | null = "";
  mods: ModListing[] = [];
  loaded: LoadedMod | null = null;
  doc: ConstructionDoc | null = null;
  selection: Selection | null = null;
  activeSub = 0;
  assets: AssetListing[] = [];
  assetTotal = 0;
  assetQuery = "";
  summaries = new Map<string, MdlSummary>();
  issues: Issue[] = [];
  exportOutcome: ExportOutcome | null = null;
  message = "";
  busy = false;

  snap: SnapSettings = defaultSnap();
  zBand: { min: number | null; max: number | null } = { min: null, max: null };
  /** Editor surface pan and zoom: world center and pixels per meter. */
  canvas = { cx: 0, cy: 0, scale: 10 };
  /** Form text and open/closed state of the two creation forms. */
  draft = {
    modId: "",
    modName: "",
    creatingMod: false,
    constructionName: "",
    creatingConstruction: false,
  };
  /** The construction waiting for the user to confirm its deletion. */
  pendingDelete: { id: string; name: string } | null = null;
  /** True once saved state has been restored. Persistence waits for it. */
  ready = false;
  /** What the loading page says the app is doing, such as "Opening Playground". */
  loadingTitle = "";
  /** The wizard step or page the current load is heading to, or null. */
  loadingTarget: View | null = null;
  /** Pending steps shown under the title, such as "Listing assets". */
  loadingTasks: { text: string; note?: string }[] = [];
  /** Page-level loads in flight. */
  loadingCount = 0;
  /** True while the blank loading page shows (delayed, with a minimum time). */
  loadingVisible = false;
  /** True while a construction edit has not been written to the server. */
  pendingDoc = false;
  /** True while a mod edit has not been written to the server. */
  pendingMod = false;
  /** Bumped on every history change so computed getters re-run. */
  historyVersion = 0;

  #history = new History();
  #hideTimer: number | undefined;
  #shownAt = 0;
  #saveTimer: number | undefined;
  #modSaveTimer: number | undefined;
  #searchTimer: number | undefined;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get dir(): string {
    if (!this.loaded) throw new Error("No mod is open.");
    return this.loaded.dirName;
  }

  get hasErrors(): boolean {
    return this.issues.some((i) => i.severity === "error");
  }

  get selectedPlacement() {
    const s = this.selection;
    if (!s || !this.doc) return null;
    return this.doc.subconstructions[s.sub]?.models[s.model] ?? null;
  }

  /** Shows an error as "what failed" followed by the reason from the cause. */
  #fail(error: unknown, whatFailed?: string) {
    const reason = (error as Error).message ?? String(error);
    this.message = whatFailed ? `${whatFailed} ${reason}` : reason;
  }

  /** Opens `cedit.config.json` in the default desktop app, creating it first. */
  async openConfigFile() {
    try {
      await api.openConfig();
    } catch (error) {
      this.#fail(error, "Could not open cedit.config.json.");
    }
  }

  /** Everything worth keeping across a page reload. See `persist.ts`. */
  get persistable(): PersistedState {
    return {
      version: STORAGE_VERSION,
      view: this.view,
      modDir: this.loaded?.dirName ?? null,
      constructionId: this.doc?.id ?? null,
      selection: this.selection ? { ...this.selection } : null,
      activeSub: this.activeSub,
      inspectTarget: this.inspectTarget,
      assetQuery: this.assetQuery,
      snap: { ...this.snap },
      zBand: { ...this.zBand },
      canvas: { ...this.canvas },
      draft: { ...this.draft },
      pending: {
        doc: this.pendingDoc && this.doc ? toJS(this.doc) : null,
        mod: this.pendingMod && this.loaded ? toJS(this.loaded.mod) : null,
        modInfo: this.pendingMod && this.loaded
          ? toJS(this.loaded.modInfo)
          : null,
      },
    };
  }

  /** Loads config and mods, then resumes from saved state when there is any. */
  async start(saved: PersistedState | null) {
    const startedAt = Date.now();
    runInAction(() => {
      this.loadingTitle = "Loading Mods";
    });
    try {
      await this.#task("Listing your mods from disk", () => this.init());
      if (saved?.modDir) {
        runInAction(() => {
          this.loadingTitle = "Resuming Your Session";
        });
      }
      await this.restore(saved);
    } finally {
      // The first loading state is on screen from the first paint, so hold it
      // for the minimum duration to keep a fast start from flickering.
      const remaining = SPINNER_MIN_MS - (Date.now() - startedAt);
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }
      runInAction(() => {
        this.ready = true;
      });
    }
  }

  /**
   * Re-opens the mod and construction the user had open. Missing mods or
   * constructions are skipped, and the app lands on the nearest step that
   * still exists. Edits that never reached the server are re-applied.
   */
  async restore(saved: PersistedState | null) {
    try {
      if (saved) {
        runInAction(() => {
          this.snap = saved.snap;
          this.zBand = saved.zBand;
          this.canvas = saved.canvas;
          this.draft = saved.draft;
        });
        if (
          saved.modDir !== null &&
          this.mods.some((m) => m.dirName === saved.modDir)
        ) {
          await this.openMod(saved.modDir);
          await this.#restoreMod(saved);
        }
      }
    } catch (error) {
      this.#fail(error);
    }
  }

  async #restoreMod(saved: PersistedState) {
    const loaded = this.loaded;
    if (!loaded) return;
    if (saved.pending.mod || saved.pending.modInfo) {
      this.editMod((mod, info) => {
        if (saved.pending.mod) Object.assign(mod, saved.pending.mod);
        if (saved.pending.modInfo) Object.assign(info, saved.pending.modInfo);
      });
    }
    const wantsEditor = saved.view === "editor" &&
      saved.constructionId !== null;
    const exists = wantsEditor &&
      loaded.constructions.some((c) => c.id === saved.constructionId);
    if (exists) {
      await this.openConstruction(saved.constructionId!);
      if (this.doc) {
        if (saved.pending.doc && saved.pending.doc.id === this.doc.id) {
          runInAction(() => {
            this.doc = saved.pending.doc;
          });
          this.#scheduleSave();
          await this.#loadSummaries();
        }
        const doc = this.doc!;
        const sub = Math.min(saved.activeSub, doc.subconstructions.length - 1);
        runInAction(() => {
          this.activeSub = Math.max(0, sub);
          const s = saved.selection;
          const valid = s !== null &&
            doc.subconstructions[s.sub]?.models[s.model] !== undefined;
          this.selection = valid ? s : null;
          this.inspectTarget = saved.inspectTarget === "model" && !valid
            ? "construction"
            : saved.inspectTarget;
        });
      }
    } else {
      runInAction(() => {
        this.view = saved.view === "constructions" || wantsEditor
          ? "constructions"
          : "details";
      });
    }
    if (saved.assetQuery !== "") await this.searchAssets(saved.assetQuery);
  }

  async init() {
    try {
      const config = await api.config();
      const mods = await api.listMods();
      runInAction(() => {
        this.modsRoot = config.modsRoot;
        this.installRoot = config.installRoot;
        this.mods = mods;
      });
    } catch (error) {
      this.#fail(error);
    }
  }

  /**
   * Runs page-level work behind the loading step. The loading step shows as
   * soon as the work starts and stays at least `SPINNER_MIN_MS`, so the
   * destination never flashes before its data is ready.
   */
  async #pageLoad<T>(
    title: string,
    target: View,
    work: () => Promise<T>,
  ): Promise<T> {
    const outerTitle = this.loadingTitle;
    const outerTarget = this.loadingTarget;
    this.loadingTitle = title;
    this.loadingTarget = target;
    this.loadingCount++;
    clearTimeout(this.#hideTimer);
    // The destination depends on this data, so show the loading step at once.
    // Waiting before showing it lets the old or half-filled step flash first.
    if (!this.loadingVisible) {
      this.loadingVisible = true;
      this.#shownAt = Date.now();
    }
    try {
      return await work();
    } finally {
      runInAction(() => {
        this.loadingCount = Math.max(0, this.loadingCount - 1);
        if (this.loadingCount > 0) {
          this.loadingTitle = outerTitle;
          this.loadingTarget = outerTarget;
        }
      });
      if (this.loadingCount === 0) {
        if (this.loadingVisible) {
          const wait = Math.max(
            0,
            SPINNER_MIN_MS - (Date.now() - this.#shownAt),
          );
          this.#hideTimer = setTimeout(() => {
            runInAction(() => {
              this.loadingVisible = false;
            });
          }, wait);
        }
      }
    }
  }

  /**
   * Shows `text` as a pending task on the loading page until `work` settles.
   * `update` replaces the text, for progress such as "2 of 5".
   */
  async #task<T>(
    text: string,
    work: (update: (text: string) => void) => Promise<T>,
    note?: string,
  ): Promise<T> {
    const item = observable({ text, note });
    runInAction(() => this.loadingTasks.push(item));
    try {
      return await work((next) => runInAction(() => (item.text = next)));
    } finally {
      runInAction(() => {
        const at = this.loadingTasks.indexOf(item);
        if (at >= 0) this.loadingTasks.splice(at, 1);
      });
    }
  }

  async createMod(modId: string, name: string) {
    await this.#pageLoad(`Creating ${name || modId}`, "details", async () => {
      try {
        const created = await this.#task(
          "Writing mod.json and modinfo.json",
          () => api.createMod(modId, name),
        );
        await this.openMod(created.dirName);
      } catch (error) {
        this.#fail(error, `Could not create the mod ${name || modId}.`);
      }
    });
  }

  /** Opens a mod and moves the wizard to the Mod Details step. */
  async openMod(dirName: string) {
    const label = this.mods.find((m) => m.dirName === dirName)?.name ?? dirName;
    await this.#pageLoad(`Opening ${label}`, "details", async () => {
      try {
        const loaded = await this.#task(
          "Reading mod.json, modinfo.json, and the list of constructions",
          () => api.loadMod(dirName),
        );
        runInAction(() => {
          this.loaded = loaded;
          this.doc = null;
          this.selection = null;
          this.issues = [];
          this.exportOutcome = null;
          this.message = "";
          this.view = "details";
        });
        await this.#task(
          "Indexing models from the base game and this mod.",
          () => this.searchAssets(""),
          "The first run can take a minute.",
        );
      } catch (error) {
        this.#fail(error, `Could not open the mod ${label}.`);
      }
    });
  }

  /** Back to the first wizard step. */
  closeMod() {
    void this.flushSave();
    if (this.pendingMod) {
      clearTimeout(this.#modSaveTimer);
      void this.#saveMod();
    }
    this.loaded = null;
    this.doc = null;
    this.selection = null;
    this.pendingDelete = null;
    this.view = "mods";
    void this.init();
  }

  /** Moves between wizard steps and the editor without losing state. */
  goTo(view: View) {
    // Step 1 chooses the mod, so returning to it deselects the open mod.
    if (view === "mods") return this.closeMod();
    if (!this.loaded) return;
    if (view === "editor" && !this.doc) return;
    if (view !== "editor") void this.flushSave();
    this.view = view;
    this.message = "";
  }

  async createConstruction(id: string, name?: string) {
    await this.#pageLoad(`Creating ${name || id}`, "editor", async () => {
      try {
        await this.#task(
          `Writing ${id}.json`,
          () => api.createConstruction(this.dir, id, name),
        );
        const loaded = await api.loadMod(this.dir);
        runInAction(() => {
          this.loaded = loaded;
        });
        await this.openConstruction(id);
      } catch (error) {
        this.#fail(error, `Could not create the construction ${name || id}.`);
      }
    });
  }

  /** Opens the delete confirmation for a construction of the open mod. */
  requestDelete(id: string) {
    const name = id === this.doc?.id
      ? this.doc.description.name
      : this.loaded?.constructions.find((c) => c.id === id)?.name ?? id;
    this.pendingDelete = { id, name: name || id };
  }

  cancelDelete() {
    this.pendingDelete = null;
  }

  /** Deletes the construction named by `pendingDelete`, then shows step 3. */
  async confirmDelete() {
    const target = this.pendingDelete;
    if (!target || !this.loaded) return;
    this.pendingDelete = null;
    const deletingOpen = this.doc?.id === target.id;
    if (deletingOpen) {
      // A pending debounced save would write the file back after the delete.
      clearTimeout(this.#saveTimer);
      this.#saveTimer = undefined;
      this.pendingDoc = false;
    }
    await this.#pageLoad(
      `Deleting ${target.name}`,
      "constructions",
      async () => {
        try {
          await this.#task(
            `Removing ${target.id}.json and its exported files`,
            () => api.deleteConstruction(this.dir, target.id),
          );
          const loaded = await api.loadMod(this.dir);
          runInAction(() => {
            this.loaded = loaded;
            if (deletingOpen || this.doc?.id === target.id) {
              this.doc = null;
              this.selection = null;
              this.issues = [];
              this.exportOutcome = null;
              this.#history.clear();
              this.historyVersion++;
            }
            this.view = "constructions";
          });
        } catch (error) {
          this.#fail(
            error,
            `Could not delete the construction ${target.name} (${target.id}).`,
          );
        }
      },
    );
  }

  /**
   * Loads the construction, its model summaries, the asset list, and lint
   * before showing the editor page, so it appears complete in one step.
   */
  async openConstruction(id: string) {
    const label = this.loaded?.constructions.find((c) => c.id === id)?.name ??
      id;
    await this.#pageLoad(`Opening ${label}`, "editor", async () => {
      try {
        await this.flushSave();
        const doc = await this.#task(
          `Reading ${id}.json`,
          () => api.readConstruction(this.dir, id),
        );
        runInAction(() => {
          this.doc = doc;
          this.selection = null;
          this.inspectTarget = "construction";
          this.activeSub = 0;
          this.exportOutcome = null;
          this.#history.clear();
          this.historyVersion++;
        });
        await Promise.all([
          this.#task(
            "Loading model outlines",
            (update) => this.#loadSummaries(update),
          ),
          this.#task("Checking for problems", () => this.#runLint()),
          this.assets.length === 0
            ? this.#task(
              "Listing assets",
              () => this.searchAssets(this.assetQuery),
            )
            : Promise.resolve(),
        ]);
        runInAction(() => {
          this.view = "editor";
        });
      } catch (error) {
        this.#fail(error, `Could not open the construction ${label} (${id}).`);
      }
    });
  }

  async #loadSummaries(update?: (text: string) => void) {
    if (!this.doc) return;
    const ids = new Set(
      this.doc.subconstructions.flatMap((s) => s.models.map((m) => m.id)),
    );
    const todo = [...ids].filter((id) => !this.summaries.has(id));
    let done = 0;
    for (const id of todo) {
      update?.(`Loading model outlines (${done + 1} of ${todo.length})`);
      done++;
      if (this.summaries.has(id)) continue;
      try {
        const summary = await api.model(this.dir, id);
        runInAction(() => this.summaries.set(id, summary));
      } catch {
        // An unresolved id shows up in the lint panel.
      }
    }
  }

  async #runLint() {
    if (!this.doc) return;
    try {
      const issues = await api.lint(this.dir, toJS(this.doc));
      runInAction(() => {
        this.issues = issues;
      });
    } catch (error) {
      this.#fail(error);
    }
  }

  #scheduleSave() {
    clearTimeout(this.#saveTimer);
    this.pendingDoc = true;
    this.#saveTimer = setTimeout(() => void this.flushSave(), SAVE_DELAY_MS);
  }

  async flushSave() {
    if (this.#saveTimer === undefined || !this.doc || !this.loaded) return;
    clearTimeout(this.#saveTimer);
    this.#saveTimer = undefined;
    try {
      await api.writeConstruction(this.dir, toJS(this.doc));
      // An edit made during the write schedules another save and stays pending.
      if (this.#saveTimer === undefined) {
        runInAction(() => {
          this.pendingDoc = false;
        });
      }
      await this.#runLint();
    } catch (error) {
      this.#fail(error);
    }
  }

  #snapshot(): ConstructionDoc {
    return JSON.parse(JSON.stringify(toJS(this.doc)));
  }

  #replaceDoc(snapshot: ConstructionDoc) {
    this.doc = JSON.parse(JSON.stringify(snapshot));
    const s = this.selection;
    if (s && !this.doc!.subconstructions[s.sub]?.models[s.model]) {
      this.selection = null;
    }
    if (this.activeSub >= this.doc!.subconstructions.length) {
      this.activeSub = 0;
    }
    this.#scheduleSave();
    void this.#loadSummaries();
  }

  /**
   * Applies an edit to the open construction, records it for undo, and saves.
   * Edits that share a `mergeKey` inside one gesture become one command.
   */
  edit(
    change: (doc: ConstructionDoc) => void,
    options: { label?: string; mergeKey?: string } = {},
  ) {
    if (!this.doc) return;
    const before = this.#snapshot();
    change(this.doc);
    const after = this.#snapshot();
    if (JSON.stringify(before) === JSON.stringify(after)) return;
    this.#history.record(
      new SnapshotCommand(
        options.label ?? "Edit",
        before,
        after,
        (state) => this.#replaceDoc(state),
        options.mergeKey,
      ),
    );
    this.historyVersion++;
    this.#scheduleSave();
  }

  get canUndo(): boolean {
    this.historyVersion;
    return this.#history.canUndo;
  }

  get canRedo(): boolean {
    this.historyVersion;
    return this.#history.canRedo;
  }

  get undoLabel(): string | undefined {
    this.historyVersion;
    return this.#history.undoLabel;
  }

  get redoLabel(): string | undefined {
    this.historyVersion;
    return this.#history.redoLabel;
  }

  undo() {
    if (this.#history.undo()) this.historyVersion++;
  }

  redo() {
    if (this.#history.redo()) this.historyVersion++;
  }

  beginGesture() {
    this.#history.beginGesture();
  }

  endGesture() {
    this.#history.endGesture();
  }

  /** Sets a placement's transform. Calls inside one gesture merge. */
  setPlacementTransf(sub: number, model: number, transf: PositionYaw) {
    this.edit((doc) => {
      doc.subconstructions[sub].models[model].transf = composeTransf(transf);
    }, { label: "Transform", mergeKey: `transf:${sub}:${model}` });
  }

  /** Layer visibility is a view setting. It is saved but not undoable. */
  setHidden(sub: number, hidden: boolean) {
    if (!this.doc) return;
    this.doc.subconstructions[sub].hidden = hidden || undefined;
    if (hidden && this.selection?.sub === sub) this.selection = null;
    this.#scheduleSave();
  }

  /** Visible items inside the Z band, as sub and model indices. */
  isVisible(sub: number, z: number): boolean {
    const layer = this.doc?.subconstructions[sub];
    if (!layer || layer.hidden) return false;
    const { min, max } = this.zBand;
    return (min === null || z >= min) && (max === null || z <= max);
  }

  async searchAssets(query: string) {
    this.assetQuery = query;
    clearTimeout(this.#searchTimer);
    await new Promise<void>((resolve) => {
      this.#searchTimer = setTimeout(
        resolve,
        query === "" ? 0 : SEARCH_DELAY_MS,
      );
    });
    if (query !== this.assetQuery || !this.loaded) return;
    try {
      const result = await api.assets(this.dir, query);
      runInAction(() => {
        this.assets = result.entries;
        this.assetTotal = result.total;
      });
    } catch (error) {
      this.#fail(error);
    }
  }

  async addModel(id: string) {
    if (!this.doc) {
      this.message = "Open or create a construction first.";
      return;
    }
    const subIndex = Math.min(
      this.activeSub,
      this.doc.subconstructions.length - 1,
    );
    const models = this.doc.subconstructions[subIndex].models;
    this.edit((doc) => {
      doc.subconstructions[subIndex].models.push({
        id,
        transf: composeTransf({ x: 0, y: 0, z: 0, yaw: 0 }),
      });
    }, { label: "Add model" });
    this.selection = { sub: subIndex, model: models.length - 1 };
    const prefixAt = id.indexOf("::");
    if (prefixAt > 0) this.#ensureDependency(id.slice(0, prefixAt));
    await this.#loadSummaries();
  }

  /** Selects a model, or clears the selection and shows the construction. */
  select(selection: Selection | null) {
    this.selection = selection;
    this.inspectTarget = selection ? "model" : "construction";
    if (selection) this.activeSub = selection.sub;
  }

  /** Selects a layer in the scene tree. */
  selectLayer(sub: number) {
    this.selection = null;
    this.activeSub = sub;
    this.inspectTarget = "layer";
  }

  removeSelected() {
    const s = this.selection;
    if (!s) return;
    this.edit((doc) => {
      doc.subconstructions[s.sub].models.splice(s.model, 1);
    }, { label: "Remove model" });
    this.selection = null;
  }

  addSubconstruction() {
    this.edit((doc) => {
      doc.subconstructions.push(
        newSubconstruction(`Sub ${doc.subconstructions.length + 1}`),
      );
    }, { label: "Add subconstruction" });
  }

  patchSelectedPlacement(patch: PlacementPatch) {
    const placement = this.selectedPlacement;
    if (!placement) return;
    const current = decomposeTransf(placement.transf);
    const next = composeTransf({
      x: patch.x ?? current.x,
      y: patch.y ?? current.y,
      z: patch.z ?? current.z,
      yaw: patch.yawDeg === undefined
        ? current.yaw
        : (patch.yawDeg * Math.PI) / 180,
      scale: patch.scale ?? current.scale,
    });
    this.edit(() => {
      placement.transf = next;
    }, { label: "Transform" });
  }

  #ensureDependency(modId: string) {
    this.editMod((mod) => {
      const dependencies = mod.dependencies ?? [];
      if (dependencies.some((d) => d.mod.modId === modId)) return;
      mod.dependencies = [...dependencies, { mod: { modId } }];
    });
  }

  /** Writes `mod.json` and `modinfo.json` after a short pause. */
  editMod(change: (mod: ModJson, info: ModInfoJson) => void) {
    if (!this.loaded) return;
    change(this.loaded.mod, this.loaded.modInfo);
    clearTimeout(this.#modSaveTimer);
    this.pendingMod = true;
    this.#modSaveTimer = setTimeout(() => void this.#saveMod(), SAVE_DELAY_MS);
  }

  async #saveMod() {
    if (!this.loaded) return;
    this.#modSaveTimer = undefined;
    try {
      await api.saveMod(
        this.dir,
        toJS(this.loaded.mod),
        toJS(this.loaded.modInfo),
      );
      if (this.#modSaveTimer === undefined) {
        runInAction(() => {
          this.pendingMod = false;
        });
      }
    } catch (error) {
      this.#fail(error);
    }
  }

  async exportCurrent() {
    if (!this.doc) return;
    this.busy = true;
    try {
      await this.flushSave();
      await this.#saveMod();
      const outcome = await api.exportConstruction(this.dir, this.doc.id);
      runInAction(() => {
        this.exportOutcome = outcome;
        this.issues = outcome.issues;
      });
    } catch (error) {
      this.#fail(error);
    } finally {
      runInAction(() => {
        this.busy = false;
      });
    }
  }
}
