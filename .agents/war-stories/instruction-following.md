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

## Pattern

- A named target gets changed along with its neighbors.
- A new thing is built where an existing one covers the request.
- A property is set and the property next to it is never read back.
- Wide tools (`preview_stop`) are used for narrow instructions.
- One field regresses on several rounds because each fix is checked against its
  own case and not the neighboring cases. The Content Folder field changed three
  times (relative base, mod name, shortening a path that fits).
- A request to audit "the entire" set is answered with the one slice already in
  mind, and a gap found by a question is offered as a future edit instead of
  being made.
