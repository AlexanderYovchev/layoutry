import path from "node:path";
import {
  FILE_TOKEN_PATTERN,
  type FileCapabilityRegistry,
} from "./fileCapabilities";
import {
  PROJECT_FILE_EXTENSION,
  ProjectFileError,
  assertProjectFilePath,
  nodeProjectFileOps,
  readProjectFile,
  writeProjectFileAtomically,
  type ProjectFileOps,
  type WriteHooks,
} from "./projectFileSystem";

/**
 * The desktop project-file operations behind IPC (PROJECT-1.3), free of
 * Electron so they can be unit-tested. Every renderer payload is `unknown`
 * and validated here; the renderer supplies tokens and project text, never
 * paths. Results are plain, structured-clone-safe objects.
 */

/** Same bound as the renderer's loader: 16 Mi UTF-16 code units. */
export const MAX_PROJECT_TEXT_LENGTH = 16 * 1024 * 1024;
const MAX_SUGGESTED_NAME_LENGTH = 260;
const MAX_PENDING_OPENS = 8;

export interface ServiceError {
  code: string;
  message: string;
}

export interface OpenedProjectFile {
  token: string;
  fileName: string;
  text: string;
}

export type OpenResult =
  | { status: "cancelled" }
  | { status: "opened"; file: OpenedProjectFile }
  | { status: "error"; error: ServiceError };

export type PendingOpenResult = OpenResult | { status: "none" };

export type ChooseLocationResult =
  | { status: "cancelled" }
  | { status: "chosen"; target: { token: string; fileName: string } }
  | { status: "error"; error: ServiceError };

export type WriteResult =
  | { status: "saved"; fileName: string }
  | { status: "conflict"; reason: "modified" | "missing"; fileName: string }
  | { status: "error"; error: ServiceError };

export interface ProjectFileServiceOptions {
  registry: FileCapabilityRegistry;
  /** Native Open dialog; resolves to the chosen path, or null if cancelled. */
  showOpenDialog: (defaultFolder: string | null) => Promise<string | null>;
  /** Native Save dialog (which confirms replacing an existing file). */
  showSaveDialog: (defaultPath: string) => Promise<string | null>;
  /** Folder for the first dialog, e.g. Documents. */
  defaultFolder: () => string;
  ops?: ProjectFileOps;
  writeHooks?: WriteHooks;
}

export class InvalidPayloadError extends Error {
  constructor(message: string) {
    super(`Rejected desktop IPC payload: ${message}`);
    this.name = "InvalidPayloadError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Exactly these keys, nothing more: unexpected fields are a bug or an attack. */
function expectKeys(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (!isRecord(value)) throw new InvalidPayloadError("expected an object");
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, i) => key !== expected[i])
  )
    throw new InvalidPayloadError(`expected exactly {${expected.join(", ")}}`);
  return value;
}

function expectToken(value: unknown): string {
  if (typeof value !== "string" || !FILE_TOKEN_PATTERN.test(value))
    throw new InvalidPayloadError("malformed file token");
  return value;
}

/**
 * Cheap defence in depth: the renderer may only write what looks like a
 * Layoutry project. Full validation already happened in the renderer
 * (serializeProject self-checks with the real loader).
 */
function expectProjectText(value: unknown): string {
  if (typeof value !== "string")
    throw new InvalidPayloadError("text must be a string");
  if (value.length > MAX_PROJECT_TEXT_LENGTH)
    throw new InvalidPayloadError("project text too large");
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new InvalidPayloadError("project text is not JSON");
  }
  if (
    !isRecord(parsed) ||
    parsed.format !== "layoutry-project" ||
    typeof parsed.formatVersion !== "number" ||
    !Number.isInteger(parsed.formatVersion)
  )
    throw new InvalidPayloadError("text is not a Layoutry project");
  return value;
}

/** A file name only — any folder part the renderer sends is discarded. */
export function safeSuggestedFileName(value: unknown): string {
  if (typeof value !== "string" || value.length > MAX_SUGGESTED_NAME_LENGTH)
    throw new InvalidPayloadError("suggested name must be a short string");
  const base = path.win32
    .basename(path.posix.basename(value))
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/^[.\s]+|[.\s]+$/g, "");
  const stem = base.toLowerCase().endsWith(PROJECT_FILE_EXTENSION)
    ? base.slice(0, -PROJECT_FILE_EXTENSION.length)
    : base;
  return `${stem.trim() || "Untitled Project"}${PROJECT_FILE_EXTENSION}`;
}

function serviceError(error: unknown, fallbackName: string): ServiceError {
  if (error instanceof ProjectFileError)
    return { code: error.code, message: error.message };
  return {
    code: "failed",
    message: `“${fallbackName}” couldn't be opened or saved. Nothing was changed.`,
  };
}

export function createProjectFileService(options: ProjectFileServiceOptions) {
  const { registry } = options;
  const ops = options.ops ?? nodeProjectFileOps;
  const pending: string[] = [];
  let lastFolder: string | null = null;

  async function openPath(
    ownerId: number,
    filePath: string,
  ): Promise<OpenResult> {
    const fileName = path.basename(filePath);
    try {
      const { text, fingerprint } = await readProjectFile(filePath, ops);
      lastFolder = path.dirname(filePath);
      return {
        status: "opened",
        file: {
          token: registry.issue(ownerId, filePath, fingerprint),
          fileName,
          text,
        },
      };
    } catch (error) {
      return { status: "error", error: serviceError(error, fileName) };
    }
  }

  return {
    async open(ownerId: number): Promise<OpenResult> {
      const chosen = await options.showOpenDialog(lastFolder);
      if (chosen === null) return { status: "cancelled" };
      return openPath(ownerId, chosen);
    },

    /** Queues a file from the command line or a second launch. */
    queueExternalOpen(filePath: string): boolean {
      if (pending.length >= MAX_PENDING_OPENS || pending.includes(filePath))
        return false;
      pending.push(filePath);
      return true;
    },

    async takePending(ownerId: number): Promise<PendingOpenResult> {
      const next = pending.shift();
      if (next === undefined) return { status: "none" };
      return openPath(ownerId, next);
    },

    async chooseSaveLocation(
      ownerId: number,
      payload: unknown,
    ): Promise<ChooseLocationResult> {
      const request = expectKeys(payload, ["suggestedName"]);
      const suggested = safeSuggestedFileName(request.suggestedName);
      const chosen = await options.showSaveDialog(
        path.join(lastFolder ?? options.defaultFolder(), suggested),
      );
      if (chosen === null) return { status: "cancelled" };

      let filePath = chosen;
      if (path.extname(filePath).toLowerCase() !== PROJECT_FILE_EXTENSION) {
        filePath = `${filePath}${PROJECT_FILE_EXTENSION}`;
        // The dialog confirmed replacing the name it showed, not this one.
        const exists = await ops.lstat(filePath).then(
          () => true,
          () => false,
        );
        if (exists)
          return {
            status: "error",
            error: {
              code: "invalid-path",
              message: `“${path.basename(filePath)}” already exists. Choose another name, ending in .layoutry.`,
            },
          };
      }
      try {
        assertProjectFilePath(filePath);
      } catch (error) {
        return {
          status: "error",
          error: serviceError(error, path.basename(filePath)),
        };
      }
      lastFolder = path.dirname(filePath);
      return {
        status: "chosen",
        target: {
          token: registry.issue(ownerId, filePath, null),
          fileName: path.basename(filePath),
        },
      };
    },

    async write(ownerId: number, payload: unknown): Promise<WriteResult> {
      const request = expectKeys(payload, ["token", "text", "force"]);
      const token = expectToken(request.token);
      const text = expectProjectText(request.text);
      if (typeof request.force !== "boolean")
        throw new InvalidPayloadError("force must be a boolean");

      const capability = registry.resolve(ownerId, token);
      if (!capability)
        return {
          status: "error",
          error: {
            code: "invalid-token",
            message:
              "Layoutry no longer has access to this file. Use Save As to choose where to save.",
          },
        };
      try {
        const fingerprint = await writeProjectFileAtomically(
          capability.filePath,
          text,
          request.force || capability.fingerprint === null
            ? { kind: "any" }
            : { kind: "unchanged", fingerprint: capability.fingerprint },
          ops,
          options.writeHooks,
        );
        registry.recordVersion(ownerId, token, fingerprint);
        return { status: "saved", fileName: capability.fileName };
      } catch (error) {
        if (
          error instanceof ProjectFileError &&
          error.code === "modified-externally"
        )
          return {
            status: "conflict",
            reason: "modified",
            fileName: capability.fileName,
          };
        if (error instanceof ProjectFileError && error.code === "missing")
          return {
            status: "conflict",
            reason: "missing",
            fileName: capability.fileName,
          };
        return {
          status: "error",
          error: serviceError(error, capability.fileName),
        };
      }
    },

    release(ownerId: number, payload: unknown): void {
      const request = expectKeys(payload, ["token"]);
      registry.release(ownerId, expectToken(request.token));
    },
  };
}

export type ProjectFileService = ReturnType<typeof createProjectFileService>;
