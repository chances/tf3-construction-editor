# Folder Chooser and Error-State Actions

Adds corrective actions to `ce-error-state`, a link to the config file, and a
server-side folder chooser for the install folder and the mods folder.

## Decisions

| Topic            | Decision                                                                                                   |
| ---------------- | ---------------------------------------------------------------------------------------------------------- |
| Actions slot     | `ce-error-state` gets `<slot name="actions">` below the explanation. The default slot keeps the text.      |
| Dialog mechanism | The server runs PowerShell with an `Add-Type` C# wrapper for `IFileOpenDialog` with `FOS_PICKFOLDERS`.     |
| Other OSes       | The route returns a specific "not supported on this OS, set it in cedit.config.json" error.                |
| Config link      | `cedit.config.json` is a button-link that calls the server to reveal the file in Explorer.                 |
| Missing file     | The link first writes `{}` to the file, then reveals it.                                                   |
| Persistence      | The server merges the picked path into `cedit.config.json` and applies it live, with no restart.           |
| Validation       | Install folder must contain `base/content`. Mods folder must be an existing directory. Else reject.        |
| Mods folder UI   | Icon-only Lucide folder button after the `Mods folder:` path, `aria-label` and `title` Change Mods Folder. |
| Mods change      | The app closes the open mod, clears the saved selection, reloads the list, and shows Choose a Mod.         |

## Server

- `POST /api/config/choose` with body
  `{ "setting": "installRoot" | "modsRoot" }`. Opens the dialog, validates,
  writes `cedit.config.json`, updates the live config, drops the cached base
  index, and returns the new config.
- `POST /api/config/reveal` creates `cedit.config.json` when missing and runs
  `explorer.exe /select,<file>`.
- The picker lives in `server/src/folder-dialog.ts`. The pure parts (validation,
  config merge, dialog output parsing) have sibling tests. The dialog itself has
  no unit test.
- `server/deno.json` start task adds `--allow-run=powershell.exe,explorer.exe`.
- The server already binds `127.0.0.1` only, so the dialog opens on the user's
  own desktop.
- A cancelled dialog returns `{ "cancelled": true }` and changes nothing.
- The dialog window opens topmost so it does not hide behind the browser.

## App

- `ce-error-state`: `actions` slot, styled as a centered row.
- `ce-assets`: error state gets a `Select Install...` button in the `actions`
  slot. While the dialog is open the button is disabled and shows a spinner.
- `ce-mod-picker`: folder icon button after the mods folder path.
- `store`: `chooseFolder(setting)` runs through the page loading step, then
  refreshes the assets list or the mod list, and reports failures with the
  action, the folder, the reason, and the next step.

## Not in This Change

- Folder choosers on Linux and macOS.
