import { z } from "zod";
import type { HtmlCssExportMode } from "@/features/export/types/exportResult";

/**
 * The renderer side of native code export (EXPORT-1.4). In the desktop
 * app the sandboxed preload adds two functions to `window.layoutryDesktop`
 * (see desktop/preload/preload.ts); in a browser they don't exist and
 * getDesktopExportFiles() returns null.
 *
 * Like project files, the page never sees or sends a path: the main
 * process shows the native dialog and returns an opaque destination token.
 * The page sends only the generated files by their fixed names
 * (index.html, styles.css, script.js), and the main process decides where
 * they go.
 */

const serviceErrorSchema = z.object({ code: z.string(), message: z.string() });

const chooseResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("cancelled") }),
  z.object({
    status: z.literal("chosen"),
    destination: z.object({ token: z.string(), label: z.string() }),
  }),
  z.object({ status: z.literal("error"), error: serviceErrorSchema }),
]);

const writeResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("saved"), label: z.string(), fileNames: z.array(z.string()) }),
  z.object({ status: z.literal("conflict"), label: z.string(), existing: z.array(z.string()) }),
  z.object({ status: z.literal("error"), error: serviceErrorSchema }),
]);

export type DesktopExportServiceError = z.infer<typeof serviceErrorSchema>;
export type DesktopExportChooseResult = z.infer<typeof chooseResultSchema>;
export type DesktopExportWriteResult = z.infer<typeof writeResultSchema>;

export interface DesktopExportFileContent {
  path: string;
  content: string;
}

export interface DesktopExportFiles {
  /**
   * "standalone": native Save dialog for the HTML file (Windows confirms
   * replacing an existing file). "separate": native folder picker.
   */
  chooseExportDestination(mode: HtmlCssExportMode, suggestedName: string): Promise<DesktopExportChooseResult>;
  /**
   * Writes the files to the chosen destination. Without `overwrite`, files
   * that already exist (and that the Save dialog did not already confirm)
   * come back as a conflict and nothing is written.
   */
  writeExportFiles(token: string, files: readonly DesktopExportFileContent[], overwrite: boolean): Promise<DesktopExportWriteResult>;
}

const BRIDGE_FUNCTIONS = ["chooseExportDestination", "writeExportFiles"] as const;

type RawBridge = Record<(typeof BRIDGE_FUNCTIONS)[number], (...args: unknown[]) => unknown>;

function isRawBridge(value: unknown): value is RawBridge {
  if (typeof value !== "object" || value === null) return false;
  return BRIDGE_FUNCTIONS.every((name) => typeof Reflect.get(value, name) === "function");
}

const BRIDGE_FAILURE: DesktopExportServiceError = {
  code: "bridge",
  message: "Layoutry couldn't reach its file system service. Nothing was saved. Restart Layoutry and try again.",
};

async function call<T>(schema: z.ZodType<T>, invoke: () => unknown): Promise<T | { status: "error"; error: DesktopExportServiceError }> {
  try {
    const parsed = schema.safeParse(await invoke());
    return parsed.success ? parsed.data : { status: "error", error: BRIDGE_FAILURE };
  } catch {
    return { status: "error", error: BRIDGE_FAILURE };
  }
}

/** Wraps a raw bridge object, validating every result it returns. */
export function createDesktopExportFiles(raw: unknown): DesktopExportFiles | null {
  if (!isRawBridge(raw)) return null;
  return {
    chooseExportDestination: (mode, suggestedName) => call(chooseResultSchema, () => raw.chooseExportDestination(mode, suggestedName)),
    writeExportFiles: (token, files, overwrite) =>
      call(writeResultSchema, () =>
        raw.writeExportFiles(
          token,
          files.map((file) => ({ path: file.path, content: file.content })),
          overwrite,
        ),
      ),
  };
}

/** The desktop export bridge, or null in a browser. */
export function getDesktopExportFiles(): DesktopExportFiles | null {
  if (typeof window === "undefined") return null;
  return createDesktopExportFiles(Reflect.get(window, "layoutryDesktop"));
}
