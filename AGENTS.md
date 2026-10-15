# Construction Editor

A 2D web app (MobX and Lit) that edits the static Transport Fever 3
constructions of one mod and exports them into the mod folder as `.con.lua` and
`.script.tl` files. The plan is `.agents/plans/construction-editor-v1.md`. Read
it before changing scope.

## Layout

Each folder sits at the repo root and is a Deno workspace member.

| Folder     | Role                                                          |
| ---------- | ------------------------------------------------------------- |
| `./schema` | Types, JSON schema, defaults, lint rules, no DOM              |
| `./export` | JSON to `.con.lua`, `.script.tl`, `.gtex.lua`, mask TGA       |
| `./server` | Zip index, `.mdl` and `.msh` readers, file API, export writer |
| `./app`    | Lit components, MobX stores, commands, canvas                 |

## Commands

Run from the repo root.

- `deno task dev` starts the file server on port 8787 and Vite for `./app`. Vite
  reloads on change. The server does not, so restart `dev` after editing
  `./server`, `./export`, or `./schema`.
- `deno task build` bundles `./app`.
- `deno task test` runs every workspace member's tests.
- `deno task fmt` formats. Fix formatting with it, never by hand.

## Rules

- Scripts that the game loads are Teal (`.tl`), never plain Lua.
- Members import each other by `name` (`@cedit/schema`), with no `imports`
  entry.
- Unit tests are sibling `<module>.test.ts` files next to `<module>.ts`.
  Fixtures live in a member's `testdata/` folder.
- Every heading and every button label uses Title Case, in Markdown and in HTML
  or component templates.
- UI conventions: a stepwise start flow (Choose a Mod, Mod Details,
  Construction) before the three-pane editor page (Assets, surface, Inspector),
  no nested group boxes, empty panes show a filling placeholder, icon-only
  buttons carry `aria-label` and `title`, deletes confirm in the one modal
  (`ce-confirm-dialog`), and icons come from Lucide through `app/src/icons.ts`.
- Number inputs are `ce-spinner` (custom spin arrows, always visible), through
  `numberField` and `clearableNumberField` in `app/src/fields.ts`. A composite
  control draws one focus outline, on its outermost box. A toggle that turns
  fields off keeps the box height: the message and the hidden fields share one
  grid cell.
- Game files live outside this repo:
  `D:\Steam\steamapps\common\Transport Fever 3`. Never extract archives into the
  install folder.
- User-specific paths never appear in source or tests. The server reads
  `installRoot` and `modsRoot` from `CEDIT_INSTALL_ROOT` and `CEDIT_MODS_ROOT`
  or from `cedit.config.json` (copy `cedit.config.example.json`). Tests that
  need the install skip when `installRoot` is not set.
- Type definitions:
  `base/tealdef/scripts/construction/construction_util_serialized.d.tl` in the
  install folder.
