import { z } from "zod";

/**
 * The renderer side of the desktop bridge (PROJECT-1.3). In the Electron
 * app, a sandboxed preload exposes `window.layoutryDesktop` (see
 * desktop/preload/preload.ts); in a browser it doesn't exist and
 * getDesktopProjectFiles() returns null. The editor and serialization never
 * touch it — only project commands and the workspace do.
 *
 * Files are referred to by opaque tokens issued by the main process; the
 * page never sees or sends a filesystem path.
 */

const serviceErrorSchema = z.object({ code: z.string(), message: z.string() });

const openResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("cancelled") }),
  z.object({ status: z.literal("none") }),
  z.object({
    status: z.literal("opened"),
    file: z.object({
      token: z.string(),
      fileName: z.string(),
      text: z.string(),
    }),
  }),
  z.object({ status: z.literal("error"), error: serviceErrorSchema }),
]);

const chooseResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("cancelled") }),
  z.object({
    status: z.literal("chosen"),
    target: z.object({ token: z.string(), fileName: z.string() }),
  }),
  z.object({ status: z.literal("error"), error: serviceErrorSchema }),
]);

const writeResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("saved"), fileName: z.string() }),
  z.object({
    status: z.literal("conflict"),
    reason: z.enum(["modified", "missing"]),
    fileName: z.string(),
  }),
  z.object({ status: z.literal("error"), error: serviceErrorSchema }),
]);

export type DesktopServiceError = z.infer<typeof serviceErrorSchema>;
export type DesktopOpenResult = z.infer<typeof openResultSchema>;
export type DesktopOpenedFile = Extract<
  DesktopOpenResult,
  { status: "opened" }
>["file"];
export type DesktopChooseResult = z.infer<typeof chooseResultSchema>;
export type DesktopWriteResult = z.infer<typeof writeResultSchema>;

export interface DesktopProjectFiles {
  /** Native Open dialog, then a size-checked read. */
  openProjectFile(): Promise<DesktopOpenResult>;
  /** The next file from the command line / Explorer / a second launch. */
  takePendingProjectFile(): Promise<DesktopOpenResult>;
  /** Native Save dialog; the result is a write capability for the destination. */
  chooseSaveLocation(suggestedName: string): Promise<DesktopChooseResult>;
  /** Atomic write. `force` overwrites an external change the user confirmed. */
  writeProjectFile(
    token: string,
    text: string,
    force: boolean,
  ): Promise<DesktopWriteResult>;
  releaseProjectFile(token: string): void;
  setUnsavedChanges(unsaved: boolean): void;
  respondToCloseRequest(close: boolean): void;
  onCloseRequested(listener: () => void): () => void;
  onPendingProjectFile(listener: () => void): () => void;
}

const BRIDGE_FUNCTIONS = [
  "openProjectFile",
  "takePendingProjectFile",
  "chooseSaveLocation",
  "writeProjectFile",
  "releaseProjectFile",
  "setUnsavedChanges",
  "respondToCloseRequest",
  "onCloseRequested",
  "onPendingProjectFile",
] as const;

type RawBridge = Record<
  (typeof BRIDGE_FUNCTIONS)[number],
  (...args: unknown[]) => unknown
>;

function isRawBridge(value: unknown): value is RawBridge {
  if (typeof value !== "object" || value === null) return false;
  return BRIDGE_FUNCTIONS.every(
    (name) => typeof Reflect.get(value, name) === "function",
  );
}

const BRIDGE_FAILURE: DesktopServiceError = {
  code: "bridge",
  message:
    "Layoutry couldn't reach its file system service. Nothing was changed. Restart Layoutry and try again.",
};

async function call<T>(
  schema: z.ZodType<T>,
  invoke: () => unknown,
): Promise<T | { status: "error"; error: DesktopServiceError }> {
  try {
    const parsed = schema.safeParse(await invoke());
    return parsed.success
      ? parsed.data
      : { status: "error", error: BRIDGE_FAILURE };
  } catch {
    return { status: "error", error: BRIDGE_FAILURE };
  }
}

function asUnsubscribe(value: unknown): () => void {
  return typeof value === "function" ? () => void value() : () => undefined;
}

/** Wraps a raw bridge object, validating every result it returns. */
export function createDesktopProjectFiles(
  raw: unknown,
): DesktopProjectFiles | null {
  if (!isRawBridge(raw)) return null;
  return {
    openProjectFile: () => call(openResultSchema, () => raw.openProjectFile()),
    takePendingProjectFile: () =>
      call(openResultSchema, () => raw.takePendingProjectFile()),
    chooseSaveLocation: (suggestedName) =>
      call(chooseResultSchema, () => raw.chooseSaveLocation(suggestedName)),
    writeProjectFile: (token, text, force) =>
      call(writeResultSchema, () => raw.writeProjectFile(token, text, force)),
    releaseProjectFile: (token) => {
      void Promise.resolve(raw.releaseProjectFile(token)).catch(
        () => undefined,
      );
    },
    setUnsavedChanges: (unsaved) => {
      void Promise.resolve(raw.setUnsavedChanges(unsaved)).catch(
        () => undefined,
      );
    },
    respondToCloseRequest: (close) => {
      void Promise.resolve(raw.respondToCloseRequest(close)).catch(
        () => undefined,
      );
    },
    onCloseRequested: (listener) =>
      asUnsubscribe(raw.onCloseRequested(listener)),
    onPendingProjectFile: (listener) =>
      asUnsubscribe(raw.onPendingProjectFile(listener)),
  };
}

/** The desktop bridge when running in the Layoutry desktop app, else null. */
export function getDesktopProjectFiles(): DesktopProjectFiles | null {
  if (typeof window === "undefined") return null;
  return createDesktopProjectFiles(Reflect.get(window, "layoutryDesktop"));
}
