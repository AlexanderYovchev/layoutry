import { createHash, randomBytes } from "node:crypto";
import { promises as nodeFs } from "node:fs";
import path from "node:path";

/**
 * Native `.layoutry` file reads and writes for the desktop app
 * (PROJECT-1.3). Main process only: the renderer never sees a path, it
 * holds an opaque capability token (see fileCapabilities.ts).
 *
 * Writes never overwrite a project in place. They write a uniquely named
 * temporary file in the destination folder, flush it to disk, then rename
 * it over the destination (Windows MoveFileEx with replace-existing,
 * atomic on one NTFS volume). The original is never deleted first, so a
 * failure at any step leaves it intact. See docs/architecture/desktop-files.md.
 */

export const PROJECT_FILE_EXTENSION = ".layoutry";
/**
 * Matches the renderer loader's bound (16 Mi characters × at most 3 UTF-8
 * bytes each), so every file the editor can produce can be opened again.
 */
export const MAX_PROJECT_FILE_BYTES = 16 * 1024 * 1024 * 3;

/** Identifies a file version by content, not by timestamp. */
export interface FileFingerprint {
  size: number;
  sha256: string;
}

export type ProjectFileErrorCode =
  | "not-found"
  | "permission-denied"
  | "locked"
  | "disk-full"
  | "too-large"
  | "not-a-file"
  | "symbolic-link"
  | "invalid-path"
  | "invalid-encoding"
  | "modified-externally"
  | "missing"
  | "verification-failed"
  | "failed";

export class ProjectFileError extends Error {
  constructor(
    readonly code: ProjectFileErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ProjectFileError";
  }
}

/** The fs calls this module makes, injectable so tests can fail any step. */
export interface ProjectFileOps {
  lstat: (filePath: string) => Promise<{
    size: number;
    isFile(): boolean;
    isSymbolicLink(): boolean;
  }>;
  readFile: (filePath: string) => Promise<Buffer>;
  /** Exclusive create ("wx"): fails if anything, including a link, exists. */
  createExclusive: (filePath: string) => Promise<WritableFile>;
  rename: (from: string, to: string) => Promise<void>;
  unlink: (filePath: string) => Promise<void>;
}

export interface WritableFile {
  write: (bytes: Buffer) => Promise<void>;
  /** Flushes file contents to the disk (FlushFileBuffers on Windows). */
  sync: () => Promise<void>;
  close: () => Promise<void>;
}

export const nodeProjectFileOps: ProjectFileOps = {
  lstat: (filePath) => nodeFs.lstat(filePath),
  readFile: (filePath) => nodeFs.readFile(filePath),
  createExclusive: async (filePath) => {
    const handle = await nodeFs.open(filePath, "wx");
    return {
      write: async (bytes) => {
        await handle.writeFile(bytes);
      },
      sync: () => handle.sync(),
      close: () => handle.close(),
    };
  },
  rename: (from, to) => nodeFs.rename(from, to),
  unlink: (filePath) => nodeFs.unlink(filePath),
};

export function fingerprintOf(bytes: Buffer): FileFingerprint {
  return {
    size: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

export function errnoOf(error: unknown): string {
  if (typeof error !== "object" || error === null || !("code" in error))
    return "";
  return typeof error.code === "string" ? error.code : "";
}

/** User-facing errors. Messages name the file, never the full path. */
function fileError(
  code: ProjectFileErrorCode,
  fileName: string,
): ProjectFileError {
  const messages: Record<ProjectFileErrorCode, string> = {
    "not-found": `“${fileName}” couldn't be found. It may have been moved, renamed or deleted.`,
    "permission-denied": `Layoutry doesn't have permission to use “${fileName}” or its folder. Choose another folder with Save As.`,
    locked: `“${fileName}” is open in another program or protected right now. Close the other program and try again, or use Save As.`,
    "disk-full": `There isn't enough disk space to save “${fileName}”. Free up space or save to another drive. The previous version of the file is unchanged.`,
    "too-large": `“${fileName}” is too large to be a Layoutry project.`,
    "not-a-file": `“${fileName}” isn't a regular file.`,
    "symbolic-link": `“${fileName}” is a shortcut link (symbolic link or junction). Open or save the real file instead.`,
    "invalid-path": `“${fileName}” isn't a valid Layoutry project file location.`,
    "invalid-encoding": `“${fileName}” isn't a Layoutry project: it isn't UTF-8 text. It may be damaged or be another kind of file.`,
    "modified-externally": `“${fileName}” was changed outside Layoutry after you opened or saved it.`,
    missing: `“${fileName}” was moved or deleted outside Layoutry after you opened or saved it.`,
    "verification-failed": `“${fileName}” was saved, but reading it back didn't match. Save again, or use Save As to keep a separate copy.`,
    failed: `“${fileName}” couldn't be saved. The previous version of the file is unchanged.`,
  };
  return new ProjectFileError(code, messages[code]);
}

function fromErrno(
  error: unknown,
  fileName: string,
  stage: "read" | "create" | "write" | "replace",
): ProjectFileError {
  if (error instanceof ProjectFileError) return error;
  const errno = errnoOf(error);
  switch (errno) {
    case "ENOENT":
      return fileError(
        stage === "read" ? "not-found" : "invalid-path",
        fileName,
      );
    case "EACCES":
    case "EPERM":
    case "EROFS":
      // A rename over a file another program holds open fails with
      // EPERM/EACCES on Windows: that is a lock, not missing rights.
      return fileError(
        stage === "replace" ? "locked" : "permission-denied",
        fileName,
      );
    case "EBUSY":
      return fileError("locked", fileName);
    case "ENOSPC":
    case "EDQUOT":
      return fileError("disk-full", fileName);
    case "EISDIR":
      return fileError("not-a-file", fileName);
    case "ENAMETOOLONG":
    case "EINVAL":
    case "ENOTDIR":
      return fileError("invalid-path", fileName);
    default:
      return fileError("failed", fileName);
  }
}

/**
 * Accepts only absolute paths to `.layoutry` files. Paths come from the
 * native dialogs or the command line, never from the renderer.
 */
export function assertProjectFilePath(filePath: string): void {
  const fileName = path.basename(filePath);
  if (
    filePath.length === 0 ||
    filePath.length > 32_000 ||
    filePath.includes("\0") ||
    !path.isAbsolute(filePath) ||
    path.extname(filePath).toLowerCase() !== PROJECT_FILE_EXTENSION ||
    fileName.length <= PROJECT_FILE_EXTENSION.length
  )
    throw fileError("invalid-path", fileName || "This file");
}

type CurrentState =
  { kind: "missing" } | { kind: "file"; fingerprint: FileFingerprint };

async function currentState(
  filePath: string,
  ops: ProjectFileOps,
  maxBytes: number = MAX_PROJECT_FILE_BYTES,
): Promise<CurrentState> {
  const fileName = path.basename(filePath);
  let stat;
  try {
    stat = await ops.lstat(filePath);
  } catch (error) {
    if (errnoOf(error) === "ENOENT") return { kind: "missing" };
    throw fromErrno(error, fileName, "read");
  }
  if (stat.isSymbolicLink()) throw fileError("symbolic-link", fileName);
  if (!stat.isFile()) throw fileError("not-a-file", fileName);
  if (stat.size > maxBytes) throw fileError("too-large", fileName);
  let bytes: Buffer;
  try {
    bytes = await ops.readFile(filePath);
  } catch (error) {
    if (errnoOf(error) === "ENOENT") return { kind: "missing" };
    throw fromErrno(error, fileName, "read");
  }
  return { kind: "file", fingerprint: fingerprintOf(bytes) };
}

export interface ReadProjectFile {
  text: string;
  fingerprint: FileFingerprint;
}

/** Reads a project file: size-checked first, never through a link. */
export async function readProjectFile(
  filePath: string,
  ops: ProjectFileOps = nodeProjectFileOps,
): Promise<ReadProjectFile> {
  assertProjectFilePath(filePath);
  const fileName = path.basename(filePath);
  let stat;
  try {
    stat = await ops.lstat(filePath);
  } catch (error) {
    throw fromErrno(error, fileName, "read");
  }
  if (stat.isSymbolicLink()) throw fileError("symbolic-link", fileName);
  if (!stat.isFile()) throw fileError("not-a-file", fileName);
  if (stat.size > MAX_PROJECT_FILE_BYTES)
    throw fileError("too-large", fileName);

  let bytes: Buffer;
  try {
    bytes = await ops.readFile(filePath);
  } catch (error) {
    throw fromErrno(error, fileName, "read");
  }
  // The file may have grown between lstat and read.
  if (bytes.length > MAX_PROJECT_FILE_BYTES)
    throw fileError("too-large", fileName);
  return {
    text: decodeProjectText(bytes, fileName),
    fingerprint: fingerprintOf(bytes),
  };
}

/**
 * Strict UTF-8, the same as the browser import (PROJECT-1.5): a byte order
 * mark is skipped, but bytes that aren't UTF-8 are refused rather than
 * replaced with U+FFFD, which would change the file on its next save.
 */
function decodeProjectText(bytes: Buffer, fileName: string): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw fileError("invalid-encoding", fileName);
  }
}

/**
 * What the destination must look like for a write to go ahead:
 * - `unchanged`: exactly the version this session last read or wrote;
 * - `any`: whatever is there — only after the user chose this destination
 *   in the native Save dialog (which confirms overwriting) or explicitly
 *   chose to overwrite an external change.
 */
export type DestinationExpectation =
  { kind: "unchanged"; fingerprint: FileFingerprint } | { kind: "any" };

/** Stages a write passes through, for failure-injection tests. */
export interface WriteHooks {
  /** Retries for a replace blocked by a transient lock (antivirus, indexer). */
  replaceRetryDelaysMs?: readonly number[];
  sleep?: (ms: number) => Promise<void>;
  randomSuffix?: () => string;
}

const DEFAULT_REPLACE_RETRY_DELAYS_MS = [50, 100, 200, 400, 800] as const;

/**
 * Writes `text` to `filePath` atomically and returns the new fingerprint.
 * On any failure the destination keeps its previous content and the
 * temporary file is removed.
 */
export async function writeProjectFileAtomically(
  filePath: string,
  text: string,
  expectation: DestinationExpectation,
  ops: ProjectFileOps = nodeProjectFileOps,
  hooks: WriteHooks = {},
): Promise<FileFingerprint> {
  assertProjectFilePath(filePath);
  const fileName = path.basename(filePath);
  const bytes = Buffer.from(text, "utf8");
  if (bytes.length > MAX_PROJECT_FILE_BYTES)
    throw fileError("too-large", fileName);

  // 1. The destination must still be the version we expect (and never a
  //    link or a folder). Checked before any work, and again once the new
  //    content is durable, immediately before the replace (PROJECT-1.5):
  //    that second check shrinks the window in which an outside change
  //    could slip in unnoticed from the whole temp-file write and flush to
  //    one read. It can't close it: Windows offers no compare-and-swap
  //    rename (see desktop-files.md).
  const checkDestination = async () => {
    const current = await currentState(filePath, ops);
    if (expectation.kind === "unchanged") {
      if (current.kind === "missing") throw fileError("missing", fileName);
      if (current.fingerprint.sha256 !== expectation.fingerprint.sha256)
        throw fileError("modified-externally", fileName);
    }
  };
  await checkDestination();

  return replaceFileAtomically(
    filePath,
    bytes,
    {
      tempExtension: ".layoutry-tmp",
      maxBytes: MAX_PROJECT_FILE_BYTES,
      beforeReplace: checkDestination,
    },
    ops,
    hooks,
  );
}

/**
 * Steps 2–4 of an atomic write: temporary file, flush, rename over the
 * destination, read-back check. Shared by project files and recovery
 * snapshots (PROJECT-1.4); callers validate the destination first.
 */
export async function replaceFileAtomically(
  filePath: string,
  bytes: Buffer,
  options: {
    tempExtension: string;
    maxBytes: number;
    /** Runs once the temporary file is durable, right before the replace; throwing stops it. */
    beforeReplace?: () => Promise<void>;
  },
  ops: ProjectFileOps = nodeProjectFileOps,
  hooks: WriteHooks = {},
): Promise<FileFingerprint> {
  const fileName = path.basename(filePath);
  const written = fingerprintOf(bytes);

  // 2. A unique, unpredictable temporary file next to the destination, so
  //    the final rename stays on one volume. Exclusive create never
  //    follows or reuses an existing entry.
  const suffix = (
    hooks.randomSuffix ?? (() => randomBytes(12).toString("hex"))
  )();
  const tempPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath, path.extname(filePath))}.${suffix}${options.tempExtension}`,
  );

  let tempCreated = false;
  let replaced = false;
  try {
    let file: WritableFile;
    try {
      file = await ops.createExclusive(tempPath);
      tempCreated = true;
    } catch (error) {
      throw fromErrno(error, fileName, "create");
    }
    try {
      await file.write(bytes);
      await file.sync();
    } catch (error) {
      await file.close().catch(() => undefined);
      throw fromErrno(error, fileName, "write");
    }
    try {
      await file.close();
    } catch (error) {
      throw fromErrno(error, fileName, "write");
    }
    await options.beforeReplace?.();

    // 3. Replace. Retried briefly: antivirus and search indexers hold new
    //    files open for a moment. Never unlink-then-rename.
    const delays =
      hooks.replaceRetryDelaysMs ?? DEFAULT_REPLACE_RETRY_DELAYS_MS;
    const sleep =
      hooks.sleep ??
      ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
    for (let attempt = 0; ; attempt += 1) {
      try {
        await ops.rename(tempPath, filePath);
        replaced = true;
        break;
      } catch (error) {
        const errno = errnoOf(error);
        const transient =
          errno === "EPERM" || errno === "EACCES" || errno === "EBUSY";
        if (!transient || attempt >= delays.length)
          throw fromErrno(error, fileName, "replace");
        await sleep(delays[attempt]);
      }
    }
  } finally {
    if (tempCreated && !replaced)
      await ops.unlink(tempPath).catch(() => undefined);
  }

  // 4. Read back what is now on disk.
  const after = await currentState(filePath, ops, options.maxBytes).catch(
    () => null,
  );
  if (after?.kind !== "file" || after.fingerprint.sha256 !== written.sha256)
    throw fileError("verification-failed", fileName);
  return written;
}
