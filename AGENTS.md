# Construction Editor

A 2D web app (MobX and Lit) that edits one static Transport Fever 3 construction
and exports a Teal `.con` file. The plan is
`.agents/plans/construction-editor-v1.md`. Read it before changing scope.

## Layout

Each folder sits at the repo root and is a Deno workspace member.

| Folder     | Role                                                          |
| ---------- | ------------------------------------------------------------- |
| `./schema` | Types, JSON schema, defaults, lint rules, no DOM              |
| `./export` | JSON to `.con.tl`, `.gtex.lua`, mask TGA, export report       |
| `./server` | Zip index, `.mdl` and `.msh` readers, file API, export writer |
| `./app`    | Lit components, MobX stores, commands, canvas                 |

## Commands

Run from the repo root.

- `deno task dev` starts Vite for `./app`.
- `deno task build` bundles `./app`.
- `deno task test` runs every workspace member's tests.
- `deno task fmt` formats. Fix formatting with it, never by hand.

## Rules

- Scripts that the game loads are Teal (`.tl`), never plain Lua.
- Members import each other by `name` (`@cedit/schema`), with no `imports`
  entry.
- Game files live outside this repo:
  `D:\Steam\steamapps\common\Transport Fever 3`. Never extract archives into the
  install folder.
- Type definitions:
  `base/tealdef/scripts/construction/construction_util_serialized.d.tl` in the
  install folder.
