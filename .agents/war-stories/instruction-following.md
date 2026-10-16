# Instruction Following

Cases where the agent did something other than what a short, clear instruction
said. The full list of incidents is in
[instruction-following.csv](instruction-following.csv), one row per incident
with the instruction and what was done instead.

## 2026-10-15: Error Icon Color

| Part        | Detail                                                                                                                                                                                                |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Instruction | "Error dialogs should use the triangle exclamation point error Lucide icon in dialog titles. Make sure the icon color is the dangerous red color that we use across the app."                         |
| Asked for   | `TriangleAlert` icon in the title. The icon is `--ce-error`.                                                                                                                                          |
| Done        | Icon added in `--ce-error`. The title `h2` had class `error`, which the shared styles color red, so the title text turned red too. The first report called the title text normal before measuring it. |
| Cause       | The class name `error` was chosen without checking what it already styled. The icon color was set, and the title color was never read back until the screenshot showed it.                            |
| Fix         | Class renamed to `alert`. Computed colors read back: icon `rgb(255, 138, 128)`, title `rgb(230, 232, 235)`.                                                                                           |

## 2026-10-15: Cr Fish Card

| Part        | Detail                                                                                                                                                                                        |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Instruction | "Audit the entire model library for common suffixes", then "Fix the cr fish crap now."                                                                                                        |
| Asked for   | Readable names and chips for every common abbreviation in the model library, with no raw tokens on a card.                                                                                    |
| Done        | Only trailing words were counted. The prefix `cr_` was never audited, so `cr_fish` showed as `Cr Fish`. The first reply to the complaint waited for the background audit and described a fix. |
| Cause       | The audit was scoped to the one pattern already in mind. A narrow audit was read as the full request, and the fix was held back for a background job it did not depend on.                    |
| Fix         | A `PREFIXES` table maps `cr` to a `Critter` chip. The suffix, prefix, and folder tokens now share one table. The unknown meanings are listed in `.agents/plans/model-name-tags.md`.           |

## 2026-10-15: Offered Edit

| Part        | Detail                                                                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Instruction | "Is the unknown `f` part in the plan doc you wrote?"                                                                                        |
| Asked for   | The `f` suffix is in the plan doc when the reply ends.                                                                                      |
| Done        | The reply said no and offered to add `f` and the other single letters. The doc was unchanged.                                               |
| Cause       | A question about a gap in a file was answered as a yes or no question, and the small edit was held for a confirmation nobody had asked for. |
| Fix         | Rows for `f`, `n`, `t`, `x`, and `d` were added to the doc. A rule was added to the global `CLAUDE.md`.                                     |

## 2026-10-16: Path Helpers Instead of the Standard Library

| Part        | Detail                                                                                                                                                                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Instruction | "This function is redundant. We already have base name and path functions in the standard library!" (a FIXME in `ce-scene.ts`), then "Always use the standard library path functions everywhere in the app."                                |
| Asked for   | Every path operation in `./app` calls `@std/path/posix`, and no local path helper exists.                                                                                                                                                   |
| Done        | The FIXME was answered with `stem` from the hand-written `app/src/paths.ts`. The next attempt added the `@jsr/std__path` npm mirror, an `.npmrc`, and a Vite alias. The user said the app does not use npm.                                 |
| Cause       | An account-level note said Vite cannot resolve `jsr:`, so a local helper plus a std-comparison test was the fix. The real fix is `@deno/vite-plugin`. A session before this one had already written the helpers from that note.             |
| Fix         | `@std/path` is a `jsr:` import in `app/deno.json`, `@deno/vite-plugin` is in `app/vite.config.ts`, `basename` and `extname` are imported at every call site, and `.npmrc` is gone. The AGENTS.md rules say so, and the stale note is fixed. |

## 2026-10-16: Distill Session Skipped the Sibling CSV

| Part        | Detail                                                                                                                                                                                                                           |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Instruction | `/distill-session`, which writes a project case study and follows the directory's existing structure. The directory pairs each prose file with a sibling `.csv` log.                                                              |
| Asked for   | Both layers in full: personal memory and project files, and for the project log both the `.md` case and the `.csv` row for every incident in the session.                                                                       |
| Done        | The `.md` case was written and the `.csv` row was left out. After the user named the file, the row was appended with a Bash `printf` and covered one incident. The missing delete confirmation and the unsaved rules had no rows. |
| Cause       | The skill's report was treated as done once the prose existed. The directory's sibling-file pattern was not checked, and only the incident named last was logged.                                                                |
| Fix         | `instruction-following.csv` has rows for all three incidents, written with Edit. The repeat is logged in `skill-checklist-discipline.csv` in the account-level topics.                                                            |

## 2026-10-16: Second Range Slider for the Z Band

| Part        | Detail                                                                                                                                                                                                                               |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Instruction | A FIXME in `ce-canvas.ts`: replace the Z band number inputs with a range slider. Then: "Never reinvent the wheel."                                                                                                                   |
| Asked for   | The existing `ce-range-slider` serves the Z band, and the toolbar sits in its own `ce-canvas-toolbar` component.                                                                                                                      |
| Done        | The agent planned a second slider inside the toolbar because `ce-range-slider` assumed years. It then saved a memory that credited the user's remark and left out the agent's own plan, and the user called that passive-aggressive. The first toolbar wrapped the Z band onto three lines, found only when a screenshot was requested. |
| Cause       | The component was not checked for a way to generalize it before a new one was planned. The unstyled `controls__group` div was never opened in the browser.                                                                            |
| Fix         | `ce-range-slider` takes `step`, `openStart`, `openIcon`, and `variant`. The toolbar groups are flex rows. The memory states the agent's act. The rules are in the account-level topics and in AGENTS.md.                               |

## 2026-10-16: Toolbar Group Labels

| Part        | Detail                                                                                                                                                                                                                                  |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Instruction | Make the toolbar group labels distinct from the controls: plain label, semi-bold, different background, inline-end border. Then: inconsistent padding, fill the band height, no margin to the toolbar, matching widths when wrapped. |
| Asked for   | Labels that fill their bands, touch the container edge, share one padding, share one width while wrapped, and carry a block-end border only above a wrapped band.                                                                        |
| Done        | Icon names were first looked up with a WebFetch of a CDN listing and the user rejected it for the Context7 tools. The first label styling set only a background and a border and was judged from a screenshot.                              |
| Cause       | The visible edges, heights, and widths were not measured in the running page before reporting, and the docs MCP tools were not tried first.                                                                                             |
| Fix         | `ce-canvas-toolbar` has full-height flush labels, a `wrapped` class set by a `ResizeObserver`, and a `--label-size` variable. The rules are in the account-level `ux-guidelines/layout.md`.                                              |

## Pattern

- A named target gets changed along with its neighbors.
- A new thing is built where an existing one covers the request. The path
  helpers were written twice in place of `@std/path`.
- A property is set and the property next to it is never read back.
- Wide tools (`preview_stop`) are used for narrow instructions.
- One field regresses on several rounds because each fix is checked against its
  own case and not the neighboring cases. The Content Folder field changed three
  times (relative base, mod name, shortening a path that fits).
- A request to audit "the entire" set is answered with the one slice already in
  mind, and a gap found by a question is offered as a future edit instead of
  being made.
