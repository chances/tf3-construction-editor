# Construction Editor

A 2D web app (MobX and Lit) that edits the static Transport Fever 3
constructions of one mod and exports them into the mod folder as `.con.lua` and
`.script.tl` files. The plan is `.agents/plans/construction-editor-v1.md`. Read
it before changing scope.

The manual test plan for phases 1 to 4 is `tests/plans/v1-manual-tests.html`,
published as the V1 Manual Tests artifact
(<https://claude.ai/artifact/REDHFz2QJKd28NsWUQjDjm>). Republish to that URL to
update it.

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
- App modules never import in a cycle. A component that needs another
  component's exports (a style array) does not get imported by it: the shared
  export lives in its own module, or the side-effect import moves to a common
  parent such as `ce-inspector.ts`. `deno check` and the tests do not see a
  cycle
  (`ReferenceError: can't access lexical declaration ... before
  initialization`
  appears only in the browser), so load the app after adding an import between
  components.
- Path handling always uses `@std/path/posix` (`basename`, `extname`, `dirname`,
  `join`), in every member including `./app`, and never a hand-written slice,
  split, or regex. Model and image names show without folder and extension
  (`basename(id, extname(id))`). `./app` imports it as `jsr:@std/path@^1`
  through its `deno.json`, and `@deno/vite-plugin` in `app/vite.config.ts` lets
  Vite resolve `jsr:` and `npm:` specifiers. The repo has no `package.json`, no
  `.npmrc`, and no npm install step.
- Line endings are LF. `.gitattributes` sets `* text=auto eol=lf`, and tests
  never depend on the line endings of a stored file.
- Unit tests are sibling `<module>.test.ts` files next to `<module>.ts`.
  Fixtures live in a member's `testdata/` folder.
- Every heading, every button label, and every field label uses Title Case, in
  Markdown and in HTML or component templates (`Menu Category`, `Layer Label`,
  `Name`). Hints, placeholders, and sentences keep sentence case, including a
  parenthetical hint after a label (`Name (32 max)`, `Tags (comma separated)`).
- Interface text that holds a count picks its noun with `Intl.PluralRules`
  (`select(n)` returns a category such as `one` or `other`, mapped to the word)
  and formats the number with `Intl.NumberFormat`. Never hand-write
  `n === 1 ? "model" : "models"`, and never write `(s)`. A zero count drops the
  phrase when the sentence reads better without it. A regular noun gets its
  forms from `nounForms` in `app/src/plural.ts`, and a bare plural from
  `pluralNoun`.
- Asset card names and chips come from `schema/src/asset-chips.ts`, shared by
  the app and the server search. A game abbreviation in a model name becomes a
  readable chip and never shows raw (`cr_fish` is `Fish` with a `Critter` chip).
  A leading kind word such as `bird` becomes a parenthetical suffix in the title
  (`bird_crane` is `Crane (Bird)`). Files that differ only by `high`, `low`,
  `idle`, `open`, `closed`, or `prod` are one model. A name word with no known
  meaning is logged in `.agents/plans/model-name-tags.md`, not guessed. Every
  chip belongs to a group in `CHIP_KINDS` (Source, Mod, Domain, the type groups,
  Towns & Cities, Variant, Size, Category), and a chip that exactly one model
  has is dropped from cards, search, and filters. A group prefix is a colon
  label (`State: Idle`, `Level: 1`). The search text and the selected filters
  live in the page URL and never in local storage: the text is `q`, and each
  group is one parameter with lowercase labels joined by commas and spaces
  written as `+` (`q=cow&domain=animals,game+mechanics`).
- Search boxes are keyword search: the query splits on whitespace, every keyword
  must match, and matching ignores case. Chip text and aliases are searchable.
- UI conventions: a stepwise start flow (Choose a Mod, Mod Details,
  Construction) before the three-pane editor page (Assets, surface, Inspector),
  no nested group boxes, empty panes show a filling placeholder, icon-only
  buttons carry a short `title` and a different, descriptive `aria-label` (never
  equal), a removal that undo restores (a model, a ground face, a paint mode, a
  vertex) skips the dialog, except a removal that also removes dependents or
  painted work, which confirms (a path node, edge, or edge list that a runway or
  edge object uses, and a raster material that has pixels). Every removal of a
  container or of something undo cannot restore confirms in the one modal
  (`ce-confirm-dialog`): a construction, a layer, or a mod list entry (author,
  dependency, incompatibility), and icons come from Lucide through
  `app/src/icons.ts`. A new surface that shows existing items carries over their
  treatments (zone colors, loading and empty states, the squared edge where it
  joins a field). A heading's actions are as tall as the Scene heading actions
  (`1.5rem`), so the heading never grows.
- A control that almost fits a new need is generalized with a prop, never
  copied: `ce-range-slider` serves years and the Z band through `step`,
  `openStart`, and `openIcon`. A control used in a vertically tight place (the
  canvas toolbar) takes `variant` (`normal` by default, `compact` for one line).
- Button states and variants live in `app/src/styles.ts`: `button.subtle`
  (transparent at rest, chrome on hover and focus), `cursor: not-allowed` when
  disabled, and a 160 ms color transition. Textareas resize vertically only with
  a 3-line minimum. A disabled button's `title` says why. Toggles use
  `ce-toggle-button` (`variant="icon subtle"`).
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
- The server watches `cedit.config.json` and pushes folder changes to the app
  over `GET /api/events`, so a folder change never needs a restart. Environment
  variables still win over the file. The folder chooser is
  `POST /api/config/choose` (`server/src/folder-dialog.ts`, Windows only).
- Interface copy for end users never names a shell command, a config key, or a
  restart.
- Use `…` (`&hellip;` in HTML) for an ellipsis, never three periods.
- Type definitions:
  `base/tealdef/scripts/construction/construction_util_serialized.d.tl` in the
  install folder.
