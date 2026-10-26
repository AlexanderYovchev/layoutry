import path from "node:path";
import { PROJECT_FILE_EXTENSION } from "./projectFileSystem";

/**
 * `.layoutry` files named on a command line: `Layoutry.exe Website.layoutry`,
 * an Explorer "Open with", or a second launch forwarded to the running
 * instance. Switches (`--user-data-dir=…`) and the executable/app path are
 * skipped; relative paths resolve against the launching process's folder.
 */
export function projectFilesFromArguments(
  argv: readonly string[],
  workingDirectory: string,
): string[] {
  const files: string[] = [];
  for (const argument of argv.slice(1)) {
    if (argument.startsWith("-")) continue;
    if (path.extname(argument).toLowerCase() !== PROJECT_FILE_EXTENSION)
      continue;
    const resolved = path.resolve(workingDirectory, argument);
    if (!files.includes(resolved)) files.push(resolved);
  }
  return files;
}
