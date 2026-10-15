import { assert, assertEquals } from "jsr:@std/assert@^1";
import { History, SnapshotCommand } from "./history.ts";

function counter() {
  const state = { value: 0 };
  const command = (to: number, key?: string) =>
    new SnapshotCommand<number>(
      `set ${to}`,
      state.value,
      to,
      (v) => (state.value = v),
      key,
    );
  return { state, command };
}

Deno.test("history: undo and redo walk the stack", () => {
  const h = new History();
  const { state, command } = counter();
  h.execute(command(1));
  h.execute(command(2));
  assertEquals(state.value, 2);
  h.undo();
  assertEquals(state.value, 1);
  h.undo();
  assertEquals(state.value, 0);
  assert(!h.canUndo && h.canRedo);
  h.redo();
  assertEquals(state.value, 1);
});

Deno.test("history: a new command clears the redo stack", () => {
  const h = new History();
  const { state, command } = counter();
  h.execute(command(1));
  h.undo();
  h.execute(command(5));
  assert(!h.canRedo);
  assertEquals(state.value, 5);
});

Deno.test("history: a drag with one merge key becomes one command", () => {
  const h = new History();
  const state = { value: 0 };
  const apply = (v: number) => (state.value = v);
  h.beginGesture();
  let before = 0;
  for (const to of [1, 2, 3, 4]) {
    h.execute(new SnapshotCommand("move", before, to, apply, "drag"));
    before = to;
  }
  h.endGesture();
  assertEquals(state.value, 4);
  h.undo();
  assertEquals(state.value, 0);
  assert(!h.canUndo, "the whole drag was one command");
  h.redo();
  assertEquals(state.value, 4);
});

Deno.test("history: commands outside a gesture never merge", () => {
  const h = new History();
  const { state, command } = counter();
  h.execute(command(1, "same"));
  h.execute(command(2, "same"));
  h.undo();
  assertEquals(state.value, 1);
});

Deno.test("history: a second gesture starts a new command", () => {
  const h = new History();
  const state = { value: 0 };
  const apply = (v: number) => (state.value = v);
  h.beginGesture();
  h.execute(new SnapshotCommand("a", 0, 1, apply, "drag"));
  h.endGesture();
  h.beginGesture();
  h.execute(new SnapshotCommand("b", 1, 2, apply, "drag"));
  h.endGesture();
  h.undo();
  assertEquals(state.value, 1);
});
