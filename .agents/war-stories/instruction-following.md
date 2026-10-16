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

## Pattern

- A named target gets changed along with its neighbors.
- A new thing is built where an existing one covers the request.
- A property is set and the property next to it is never read back.
- Wide tools (`preview_stop`) are used for narrow instructions.
- One field regresses on several rounds because each fix is checked against its
  own case and not the neighboring cases. The Content Folder field changed three
  times (relative base, mod name, shortening a path that fits).
