import { isAbsolute, join, relative, SEPARATOR } from "jsr:@std/path@^1";
import { UserError } from "./mods.ts";

/**
 * @remarks The native folder dialog runs through PowerShell with an `Add-Type`
 * C# wrapper for `IFileOpenDialog` with `FOS_PICKFOLDERS`, and it opens topmost
 * so the browser does not hide it. On Linux it runs `zenity --file-selection
 * --directory` (GNOME). The dialog opens on the server's desktop, which is the user's desktop because the server binds
 * `127.0.0.1` only. A cancelled dialog changes nothing. The pure parts
 * (validation, config merge, output parsing) have sibling tests. The dialog
 * itself has none.
 */

/** The two settings the folder chooser can change. */
export type FolderSetting = "installRoot" | "modsRoot";

export const FOLDER_SETTINGS: readonly FolderSetting[] = [
  "installRoot",
  "modsRoot",
];

export function isFolderSetting(value: unknown): value is FolderSetting {
  return FOLDER_SETTINGS.includes(value as FolderSetting);
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await Deno.stat(path)).isDirectory;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return false;
    throw error;
  }
}

/**
 * Throws a `UserError` unless `path` suits `setting`. The install folder must
 * contain `base/content`. The mods folder must be an existing directory.
 */
export async function validateFolder(
  setting: FolderSetting,
  path: string,
): Promise<void> {
  if (!await isDirectory(path)) {
    throw new UserError(
      `Could not use ${path} as the ${label(setting)}. It is not an ` +
        "existing folder. Choose a folder that exists.",
    );
  }
  if (
    setting === "installRoot" &&
    !await isDirectory(join(path, "base", "content"))
  ) {
    throw new UserError(
      `Could not use ${path} as the install folder. It has no base/content ` +
        "folder. Choose the Transport Fever 3 folder that holds the base game.",
    );
  }
}

function label(setting: FolderSetting): string {
  return setting === "installRoot" ? "install folder" : "mods folder";
}

/**
 * Returns `text` (the content of `cedit.config.json`, or "" when the file is
 * missing) with `setting` set to `path`. Other keys stay as they are.
 */
export function mergeConfig(
  text: string,
  setting: FolderSetting,
  path: string,
): string {
  let current: Record<string, unknown> = {};
  if (text.trim() !== "") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      throw new UserError(
        `Could not save the ${label(setting)}. cedit.config.json is not ` +
          `valid JSON: ${
            (error as Error).message
          }. Fix the file, then try again.`,
      );
    }
    if (
      parsed === null || typeof parsed !== "object" || Array.isArray(parsed)
    ) {
      throw new UserError(
        `Could not save the ${label(setting)}. cedit.config.json does not ` +
          "hold a JSON object. Fix the file, then try again.",
      );
    }
    current = parsed as Record<string, unknown>;
  }
  return JSON.stringify({ ...current, [setting]: path }, null, 2) + "\n";
}

/**
 * The `/` separated folder of `picked` under a mod's `content` folder. Throws a
 * `UserError` when `picked` is the content folder itself or lies outside it.
 */
export function contentFolderOf(content: string, picked: string): string {
  const rel = relative(content, picked);
  if (rel === "") {
    throw new UserError(
      "Could not use the content folder itself. Choose a folder inside it.",
    );
  }
  if (rel === ".." || rel.startsWith(`..${SEPARATOR}`) || isAbsolute(rel)) {
    throw new UserError(
      "Could not use that folder. Choose a folder inside the mod's content " +
        "folder.",
    );
  }
  return rel.split(SEPARATOR).join("/");
}

/** The dialog prints the chosen path, or nothing when it was cancelled. */
export function parseDialogOutput(stdout: string): string | null {
  const path = stdout.trim();
  return path === "" ? null : path;
}

/** Shows a folder dialog. Resolves with the path, or null when cancelled. */
export type FolderPicker = (
  options: { title: string; start?: string },
) => Promise<string | null>;

const SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Threading;

public static class CeditFolderPicker {
  [StructLayout(LayoutKind.Sequential)]
  struct RECT { public int Left, Top, Right, Bottom; }

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  static extern IntPtr FindWindow(string className, string title);
  [DllImport("user32.dll")]
  static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);
  [DllImport("user32.dll")]
  static extern bool SetWindowPos(IntPtr hwnd, IntPtr after, int x, int y,
    int cx, int cy, uint flags);

  // The dialog opens at its remembered place, not over its owner, so a helper
  // thread finds its window by title and centers it in the given area.
  static void CenterWhenShown(string title, int left, int top, int width, int height) {
    var thread = new Thread(() => {
      for (int i = 0; i < 100; i++) {
        IntPtr hwnd = FindWindow("#32770", title);
        RECT r;
        if (hwnd != IntPtr.Zero && GetWindowRect(hwnd, out r)) {
          int x = left + (width - (r.Right - r.Left)) / 2;
          int y = top + (height - (r.Bottom - r.Top)) / 2;
          // SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE
          SetWindowPos(hwnd, IntPtr.Zero, x, y, 0, 0, 0x1 | 0x4 | 0x10);
          return;
        }
        Thread.Sleep(30);
      }
    });
    thread.IsBackground = true;
    thread.Start();
  }
  [ComImport, Guid("DC1C5A9C-E88A-4DDE-A5A1-60F82A20AEF7")]
  class FileOpenDialog {}

  [ComImport, Guid("43826D1E-E718-42EE-BC55-A1E261C37BFE"),
   InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IShellItem {
    void BindToHandler(IntPtr pbc, ref Guid bhid, ref Guid riid, out IntPtr ppv);
    void GetParent(out IShellItem ppsi);
    void GetDisplayName(uint sigdnName,
      [MarshalAs(UnmanagedType.LPWStr)] out string name);
    void GetAttributes(uint mask, out uint attrs);
    void Compare(IShellItem psi, uint hint, out int order);
  }

  [ComImport, Guid("42F85136-DB7E-439C-85F1-E4075D135FC8"),
   InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IFileOpenDialog {
    [PreserveSig] int Show(IntPtr parent);
    void SetFileTypes(uint count, IntPtr types);
    void SetFileTypeIndex(uint index);
    void GetFileTypeIndex(out uint index);
    void Advise(IntPtr events, out uint cookie);
    void Unadvise(uint cookie);
    void SetOptions(uint options);
    void GetOptions(out uint options);
    void SetDefaultFolder(IShellItem item);
    void SetFolder(IShellItem item);
    void GetFolder(out IShellItem item);
    void GetCurrentSelection(out IShellItem item);
    void SetFileName([MarshalAs(UnmanagedType.LPWStr)] string name);
    void GetFileName([MarshalAs(UnmanagedType.LPWStr)] out string name);
    void SetTitle([MarshalAs(UnmanagedType.LPWStr)] string title);
    void SetOkButtonLabel([MarshalAs(UnmanagedType.LPWStr)] string text);
    void SetFileNameLabel([MarshalAs(UnmanagedType.LPWStr)] string text);
    void GetResult(out IShellItem item);
  }

  [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
  static extern void SHCreateItemFromParsingName(string path, IntPtr pbc,
    ref Guid riid, [MarshalAs(UnmanagedType.Interface)] out IShellItem item);

  const uint FOS_PICKFOLDERS = 0x20;
  const uint FOS_FORCEFILESYSTEM = 0x40;
  const uint FOS_PATHMUSTEXIST = 0x800;
  const uint SIGDN_FILESYSPATH = 0x80058000;

  public static string Pick(IntPtr owner, string title, string start,
      int areaLeft, int areaTop, int areaWidth, int areaHeight) {
    var dialog = (IFileOpenDialog)new FileOpenDialog();
    dialog.SetOptions(FOS_PICKFOLDERS | FOS_FORCEFILESYSTEM | FOS_PATHMUSTEXIST);
    dialog.SetTitle(title);
    if (!string.IsNullOrEmpty(start) && System.IO.Directory.Exists(start)) {
      var iid = new Guid("43826D1E-E718-42EE-BC55-A1E261C37BFE");
      IShellItem folder;
      SHCreateItemFromParsingName(start, IntPtr.Zero, ref iid, out folder);
      dialog.SetFolder(folder);
    }
    CenterWhenShown(title, areaLeft, areaTop, areaWidth, areaHeight);
    int hr = dialog.Show(owner);
    if (hr == unchecked((int)0x800704C7)) return "";
    if (hr != 0) Marshal.ThrowExceptionForHR(hr);
    IShellItem item;
    dialog.GetResult(out item);
    string path;
    item.GetDisplayName(SIGDN_FILESYSPATH, out path);
    return path;
  }
}
'@

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Drawing
# The construction crane emoji, drawn from Segoe UI Emoji into a 32 px icon.
$bitmap = New-Object System.Drawing.Bitmap(32, 32)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.TextRenderingHint = 'AntiAliasGridFit'
$font = New-Object System.Drawing.Font('Segoe UI Emoji', 18)
$brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(245, 158, 11))
$graphics.DrawString([char]::ConvertFromUtf32(0x1F3D7), $font, $brush, -2, 1)
$graphics.Dispose()
$icon = [System.Drawing.Icon]::FromHandle($bitmap.GetHicon())
$owner = New-Object System.Windows.Forms.Form
$owner.TopMost = $true
$owner.ShowInTaskbar = $false
$owner.FormBorderStyle = 'None'
$owner.Opacity = 0
$owner.StartPosition = 'Manual'
# The invisible owner and the dialog sit on the screen that holds the mouse,
# which is the screen the browser is on.
$area = [System.Windows.Forms.Screen]::FromPoint([System.Windows.Forms.Cursor]::Position).WorkingArea
$owner.Size = New-Object System.Drawing.Size(1, 1)
$owner.Location = New-Object System.Drawing.Point(
  ($area.Left + [int]($area.Width / 2)), ($area.Top + [int]($area.Height / 2)))
$owner.Icon = $icon
$owner.Show()
$owner.Activate()
try {
  [Console]::Out.Write(
    [CeditFolderPicker]::Pick($owner.Handle, $env:CEDIT_DIALOG_TITLE, $env:CEDIT_DIALOG_START,
      $area.Left, $area.Top, $area.Width, $area.Height))
} finally {
  $owner.Close()
}
`;

/** Encodes a script for `powershell.exe -EncodedCommand` (UTF-16LE base64). */
export function encodeScript(script: string): string {
  const bytes = new Uint8Array(script.length * 2);
  for (let i = 0; i < script.length; i++) {
    const unit = script.charCodeAt(i);
    bytes[i * 2] = unit & 0xff;
    bytes[i * 2 + 1] = unit >> 8;
  }
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** The `zenity` arguments for a folder picker that opens at `start`. */
export function zenityArgs(title: string, start: string | undefined): string[] {
  const args = ["--file-selection", "--directory", `--title=${title}`];
  // A trailing slash makes the dialog open inside the folder, not on it.
  if (start) args.push(`--filename=${start.replace(/\/*$/, "/")}`);
  return args;
}

/**
 * The GNOME folder dialog, through `zenity`. It exits 1 when cancelled and 5
 * when it timed out, and both mean nothing was chosen.
 */
async function pickFolderLinux(
  { title, start }: { title: string; start?: string },
): Promise<string | null> {
  let output: Deno.CommandOutput;
  try {
    output = await new Deno.Command("zenity", {
      args: zenityArgs(title, start),
      stdin: "null",
      stdout: "piped",
      stderr: "piped",
    }).output();
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new UserError(
        "Could not open the folder chooser. It needs zenity, which is not " +
          "installed. Install zenity, then try again.",
      );
    }
    throw error;
  }
  if (output.code === 1 || output.code === 5) return null;
  if (!output.success) {
    const detail = new TextDecoder().decode(output.stderr).trim();
    throw new Error(
      `The folder chooser failed (exit code ${output.code}).${
        detail ? ` ${detail}` : ""
      }`,
    );
  }
  return parseDialogOutput(new TextDecoder().decode(output.stdout));
}

/**
 * The Windows folder dialog (`IFileOpenDialog` with `FOS_PICKFOLDERS`), run
 * through PowerShell. The dialog opens on the desktop of the user who runs the
 * server, which is the user in front of the app.
 */
export const pickFolder: FolderPicker = async (options) => {
  if (Deno.build.os === "linux") return await pickFolderLinux(options);
  if (Deno.build.os !== "windows") {
    throw new UserError(
      "The folder chooser does not work on this operating system. Edit " +
        "cedit.config.json to set the folder.",
    );
  }
  const { title, start } = options;
  let output: Deno.CommandOutput;
  try {
    output = await new Deno.Command("powershell.exe", {
      args: [
        "-NoProfile",
        "-NonInteractive",
        "-STA",
        "-EncodedCommand",
        encodeScript(SCRIPT),
      ],
      env: {
        CEDIT_DIALOG_TITLE: title,
        CEDIT_DIALOG_START: start ?? "",
      },
      stdin: "null",
      stdout: "piped",
      stderr: "piped",
    }).output();
  } catch (error) {
    throw new Error(
      `Could not start powershell.exe to open the folder chooser: ${
        (error as Error).message
      }`,
    );
  }
  if (!output.success) {
    const detail = new TextDecoder().decode(output.stderr).trim();
    throw new Error(
      `The folder chooser failed (exit code ${output.code}).${
        detail ? ` ${detail}` : ""
      } Set the folder in cedit.config.json instead.`,
    );
  }
  return parseDialogOutput(new TextDecoder().decode(output.stdout));
};
