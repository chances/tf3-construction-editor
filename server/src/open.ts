export interface OpenCommand {
  command: string;
  args: string[];
}

/** The platform's "open with the default app" command for a file. */
export function openCommand(
  os: typeof Deno.build.os,
  path: string,
): OpenCommand {
  switch (os) {
    case "windows":
      return { command: "explorer.exe", args: [path] };
    case "darwin":
      return { command: "open", args: [path] };
    default:
      return { command: "xdg-open", args: [path] };
  }
}

/**
 * Starts the default desktop app for `path` and does not wait for it. Windows
 * `explorer.exe` exits with code 1 even on success, so the exit code is not
 * read. Resolves once the process has started.
 */
export function openInDefaultApp(path: string): Promise<void> {
  const { command, args } = openCommand(Deno.build.os, path);
  try {
    const child = new Deno.Command(command, {
      args,
      stdin: "null",
      stdout: "null",
      stderr: "null",
    }).spawn();
    child.unref();
    return Promise.resolve();
  } catch (error) {
    return Promise.reject(
      new Error(
        `Could not start ${command} to open ${path}: ${
          (error as Error).message
        }`,
      ),
    );
  }
}
