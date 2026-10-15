export interface Command {
  readonly label: string;
  /** Commands with the same key merge into one command during a gesture. */
  readonly mergeKey?: string;
  do(): void;
  undo(): void;
  /** Absorbs a later command. Returns true when it merged. */
  merge?(next: Command): boolean;
}

/**
 * Undo and redo stacks. A gesture, such as one drag, is open between
 * `beginGesture` and `endGesture`. Commands that carry the same `mergeKey`
 * inside one gesture collapse into the first command of that gesture.
 */
export class History {
  #undo: Command[] = [];
  #redo: Command[] = [];
  #gesture = false;
  #gestureTop: Command | null = null;

  get canUndo(): boolean {
    return this.#undo.length > 0;
  }

  get canRedo(): boolean {
    return this.#redo.length > 0;
  }

  get undoLabel(): string | undefined {
    return this.#undo.at(-1)?.label;
  }

  get redoLabel(): string | undefined {
    return this.#redo.at(-1)?.label;
  }

  beginGesture() {
    this.#gesture = true;
    this.#gestureTop = null;
  }

  endGesture() {
    this.#gesture = false;
    this.#gestureTop = null;
  }

  /** Runs the command, then records it. */
  execute(command: Command) {
    command.do();
    this.record(command);
  }

  /** Records a command whose effect is already applied. */
  record(command: Command) {
    const top = this.#gestureTop;
    if (
      this.#gesture && top !== null && top === this.#undo.at(-1) &&
      command.mergeKey !== undefined && command.mergeKey === top.mergeKey &&
      top.merge?.(command)
    ) return;
    this.#undo.push(command);
    this.#redo = [];
    if (this.#gesture && this.#gestureTop === null) this.#gestureTop = command;
  }

  undo(): boolean {
    const command = this.#undo.pop();
    if (!command) return false;
    command.undo();
    this.#redo.push(command);
    this.#gestureTop = null;
    return true;
  }

  redo(): boolean {
    const command = this.#redo.pop();
    if (!command) return false;
    command.do();
    this.#undo.push(command);
    this.#gestureTop = null;
    return true;
  }

  clear() {
    this.#undo = [];
    this.#redo = [];
    this.#gesture = false;
    this.#gestureTop = null;
  }
}

/** Replaces a whole state value. `after` follows later merged commands. */
export class SnapshotCommand<T> implements Command {
  constructor(
    readonly label: string,
    private readonly before: T,
    private after: T,
    private readonly apply: (state: T) => void,
    readonly mergeKey?: string,
  ) {}

  do() {
    this.apply(this.after);
  }

  undo() {
    this.apply(this.before);
  }

  merge(next: Command): boolean {
    if (!(next instanceof SnapshotCommand)) return false;
    this.after = next.after;
    return true;
  }
}
