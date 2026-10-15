# Empty and Error State Copy

Rewrites the prompts that tell an end user how to fix a missing install folder,
and removes developer instructions (`deno task dev`, restarting the server) from
every message an end user can see.

## Method

| Step               | Skill or source                                                        |
| ------------------ | ---------------------------------------------------------------------- |
| Classify and gate  | `brainstorming`: the copy change is bounded, the config watcher is not |
| Copy structure     | `design:ux-copy`: empty state is what, why empty, how to start         |
| Short instructions | `anthropic-skills:terse-instruction-writing`                           |
| House rules        | `~/.claude/topics/ux-guidelines/prose.md`                              |

## Audit

Every end-user message that names a developer concept is a problem. Findings:

| # | Where                                                         | Current text                                                                                                            | Problem                                                                                           |
| - | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1 | `app/src/ce-assets.ts:80` Game Not Indexed                    | Set `installRoot` in `cedit.config.json` to the Transport Fever 3 folder, then restart the server with `deno task dev`. | Config key, file name, shell command, and a restart. The button already fixes it with no restart. |
| 2 | `server/src/api.ts:387` unknown route                         | The app may be newer than the running server, so restart the server with `deno task dev`.                               | Shell command shown in the app.                                                                   |
| 3 | `server/src/folder-dialog.ts:267` chooser on a non-Windows OS | Set `installRoot` or `modsRoot` in `cedit.config.json`, then restart the server.                                        | Config keys and a restart.                                                                        |
| 4 | `server/src/folder-dialog.ts:301` dialog failed               | Set the folder in `cedit.config.json` instead.                                                                          | Sends the user to a file with no way to find it from this message.                                |
| 5 | `app/src/ce-construction-switcher.ts:251` empty list          | No constructions yet.                                                                                                   | Names no next step.                                                                               |
| 6 | `app/src/ce-construction-picker.ts:113` No Constructions      | Give the first one a name below.                                                                                        | "The first one" has no antecedent in the heading.                                                 |
| 7 | `app/src/ce-canvas.ts:291` Add a Model                        | Pick a model from the Assets browser.                                                                                   | The pane heading is "Assets", not "Assets browser".                                               |
| 8 | `server/src/folder-dialog.ts:70` and `:80`                    | `cedit.config.json` is not valid JSON, or does not hold a JSON object.                                                  | File name is fine, "JSON object" is jargon.                                                       |

Checked and left alone: No Mods ("Create a mod below."), No mods match., No
images match., No problems found., Open or create a construction first.

## Proposed Copy

1. **Game Not Indexed**
   - Heading: `Game Not Indexed` (unchanged).
   - Text:
     `Choose your Transport Fever 3 installation folder to list its models.`
   - Button: `Select Install…`
   - Secondary line: `Or edit cedit.config.json.` (the existing link, no key
     name, no restart sentence). Editing the file by hand needs the watcher
     below to avoid a restart.
2. **Unknown route**:
   `The app and its server are out of step. Close the
   application and open it again.`
3. **Chooser unsupported**:
   `The folder chooser does not work on this operating
   system. Edit cedit.config.json to set the folder.`
4. **Dialog failed**:
   `The folder chooser did not open. Edit cedit.config.json to
   set the folder.`
   (reason follows, as today.)
5. **Empty constructions list**:
   `No constructions yet. Type a name to create
   one.` (verify the draft row
   appears for typed text.)
6. **No Constructions**: `Name your first construction below.`
7. **Add a Model**: `Pick a model from Assets.`
8. **Config JSON errors**:
   `cedit.config.json has a syntax error: <parser
   message>. Fix the file, then try again.`

## Separate Item: Config Watcher

Your note: the backend should watch `cedit.config.json` and publish changes to
the GUI over server-sent events, so no restart is needed at all.

This is architectural, not copy. It touches `server/src/config.ts`, a new
`GET /api/events` stream, the store, and tests. It also needs a rule for
environment variables that override the file. Proposed as its own session after
the copy lands. Until it ships, copy 1 avoids the restart claim by leading with
the button, which applies live.

## Decisions Needed

- Apply rewrites 1 to 8 now, or only 1 to 4 (the developer-speak ones).
- Whether rewrite 1 keeps the `Or edit cedit.config.json.` line, or drops the
  file reference entirely until the watcher exists.
- Whether to start the config watcher as its own session.
