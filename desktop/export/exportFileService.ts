import { randomBytes } from "node:crypto";
import { promises as nodeFs } from "node:fs";
import path from "node:path";
import { FILE_TOKEN_PATTERN } from "../files/fileCapabilities";
import { InvalidPayloadError, expectKeys, expectToken } from "../files/projectFileService";
import {
  errnoOf,
  fingerprintOf,
  nodeProjectFileOps,
  replaceFileAtomically,
  type FileFingerprint,
  type ProjectFileOps,
  type WriteHooks,
} from "../files/projectFileSystem";

/**
 * Native saving of exported code (EXPORT-1.4), free of Electron so it can
 * be unit-tested. Separate from project files on purpose: its own
 * destination tokens (a project token can't be used here or the reverse),
 * its own fixed file names, and no `.layoutry` writes.
 *
 * The renderer never supplies a path. It asks for a destination — the
 * native Save dialog (one HTML file) or folder picker (separate files) —
 * and gets an opaque token. It then sends the generated files by name;
 * only index.html, styles.css and script.js are accepted, and each is
 * written directly inside the chosen folder. A separate-files export may
 * also send packaged images (BC-07.3), as bytes, named only
 * assets/image-NNN.(png|jpg|gif|webp): they go in an "assets" folder inside
 * the chosen folder, created if missing, and only if it is a real folder.
 *
 * Several files can't be replaced in one atomic step on Windows, so a
 * write is staged: every file is first written and flushed to a temporary
 * file next to its destination (nothing visible changes if that fails),
 * then each is renamed over its destination. If a rename fails, the files
 * already replaced are put back — earlier contents restored, files that
 * didn't exist removed (only if they still hold exactly what this export
 * wrote) — and nothing else in the folder is ever touched. An assets
 * folder this export created is removed again on failure, only if empty.
 * Images are renamed into place first, index.html always last.
 */

export type ExportMode = "standalone" | "separate";

/** The only names an export may write — exactly what exportHtmlCss produces. */
export const EXPORT_FILE_NAMES = ["index.html", "styles.css", "script.js"] as const;
type ExportFileName = (typeof EXPORT_FILE_NAMES)[number];

/** Packaged image names (BC-07.3): the export engine's own numbering, nothing user-chosen. */
const ASSET_PATH = /^assets\/image-\d{3,6}\.(png|jpg|gif|webp)$/;
export const EXPORT_ASSET_FOLDER = "assets";
/** A project holds at most 16 Mi characters, so its embedded images decode to under 12 MiB in total. */
export const MAX_EXPORT_ASSET_BYTES = 16 * 1024 * 1024;
export const MAX_EXPORT_ASSET_TOTAL_BYTES = 64 * 1024 * 1024;
const MAX_EXPORT_ASSETS = 4096;

/**
 * The bytes must really be the image their name says. This is defence in
 * depth at the process boundary: the renderer already checked them fully.
 */
function hasImageSignature(bytes: Uint8Array, extension: string): boolean {
  const starts = (offset: number, values: readonly number[]) => values.every((value, index) => bytes[offset + index] === value);
  const ascii = (offset: number, text: string) => starts(offset, Array.from(text, (char) => char.charCodeAt(0)));
  switch (extension) {
    case "png":
      return starts(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "jpg":
      return starts(0, [0xff, 0xd8, 0xff]);
    case "gif":
      return ascii(0, "GIF87a") || ascii(0, "GIF89a");
    case "webp":
      return ascii(0, "RIFF") && ascii(8, "WEBP");
    default:
      return false;
  }
}

/** A 20,000-element page (the project maximum) exports ~1.9 MB of CSS; this leaves wide headroom. */
export const MAX_EXPORT_FILE_CHARACTERS = 16 * 1024 * 1024;
export const MAX_EXPORT_TOTAL_CHARACTERS = 32 * 1024 * 1024;
/** Existing files are read (to restore them on failure) only up to this size. */
const MAX_REPLACED_FILE_BYTES = 64 * 1024 * 1024;
const MAX_SUGGESTED_NAME_LENGTH = 260;
const MAX_DESTINATIONS_PER_OWNER = 4;
const HTML_EXTENSIONS = [".html", ".htm"];
const TEMP_EXTENSION = ".layoutry-export-tmp";

export interface ExportServiceError {
  code: string;
  message: string;
}

export type ChooseExportDestinationResult =
  | { status: "cancelled" }
  | { status: "chosen"; destination: { token: string; label: string } }
  | { status: "error"; error: ExportServiceError };

export type WriteExportFilesResult =
  | { status: "saved"; label: string; fileNames: string[] }
  | { status: "conflict"; label: string; existing: string[] }
  | { status: "error"; error: ExportServiceError };

/** fs calls, injectable so tests can fail any step. */
export interface ExportFileOps extends Omit<ProjectFileOps, "lstat"> {
  lstat: (filePath: string) => Promise<{ size: number; isFile(): boolean; isDirectory(): boolean; isSymbolicLink(): boolean }>;
  /** Creates one folder (not recursive); fails if anything exists there. */
  mkdir: (folderPath: string) => Promise<void>;
  /** Removes one folder, only if it is empty. */
  rmdir: (folderPath: string) => Promise<void>;
}

export const nodeExportFileOps: ExportFileOps = {
  ...nodeProjectFileOps,
  lstat: (filePath) => nodeFs.lstat(filePath),
  mkdir: async (folderPath) => {
    await nodeFs.mkdir(folderPath);
  },
  rmdir: (folderPath) => nodeFs.rmdir(folderPath),
};

export interface ExportFileServiceOptions {
  /** Native Save dialog for one HTML file (which confirms replacing an existing file). */
  showSaveHtmlDialog: (defaultPath: string) => Promise<string | null>;
  /** Native folder picker. */
  showFolderDialog: (defaultFolder: string) => Promise<string | null>;
  /** Folder for the first dialog, e.g. Documents. */
  defaultFolder: () => string;
  ops?: ExportFileOps;
  writeHooks?: WriteHooks;
  createToken?: () => string;
}

type TargetState = { kind: "missing" } | { kind: "file"; fingerprint: FileFingerprint; bytes: Buffer };

type Destination =
  | {
      kind: "file";
      folder: string;
      filePath: string;
      label: string;
      /** What was at the path when the Save dialog confirmed replacing it. */
      confirmed: FileFingerprint | null;
    }
  | { kind: "folder"; folder: string; label: string };

interface Target {
  /** index.html, styles.css, script.js, or assets/image-NNN.ext. */
  name: string;
  filePath: string;
  /** The name the user sees: the chosen file name, or the fixed name in the folder. */
  label: string;
  bytes: Buffer;
}

/** A validated write request's files. */
interface ExportPayload {
  texts: Map<ExportFileName, string>;
  /** BC-07.3: packaged images, by their assets/ path. */
  assets: Map<string, Buffer>;
}

class ExportError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ExportError";
  }
}

function folderLabel(folder: string): string {
  return path.basename(folder) || folder;
}

/** A file name only, ending in .html or .htm — any folder part is discarded. */
export function safeSuggestedHtmlName(value: unknown): string {
  if (typeof value !== "string" || value.length > MAX_SUGGESTED_NAME_LENGTH) throw new InvalidPayloadError("suggested name must be a short string");
  const base = path.win32
    .basename(path.posix.basename(value))
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/^[.\s]+|[.\s]+$/g, "");
  if (!base) return "index.html";
  return HTML_EXTENSIONS.includes(path.extname(base).toLowerCase()) ? base : `${base}.html`;
}

function assertAbsolutePath(filePath: string): void {
  if (filePath.length === 0 || filePath.length > 32_000 || filePath.includes("\0") || !path.isAbsolute(filePath))
    throw new ExportError("invalid-path", "That location can't be used for an export. Choose another folder.");
}

/** User-facing errors: names the file or folder, never the full path. */
function errorFromErrno(error: unknown, name: string, folder: string): ExportError {
  if (error instanceof ExportError) return error;
  switch (errnoOf(error)) {
    case "ENOENT":
    case "ENOTDIR":
      return new ExportError("not-found", `The folder “${folder}” no longer exists. Choose another folder.`);
    case "EACCES":
    case "EPERM":
    case "EROFS":
      return new ExportError("permission-denied", `Layoutry can't write “${name}” in “${folder}”: it is open in another program, or the folder is protected. Close the other program or choose another folder.`);
    case "EBUSY":
      return new ExportError("locked", `“${name}” is open in another program. Close it and try again, or choose another folder.`);
    case "ENOSPC":
    case "EDQUOT":
      return new ExportError("disk-full", `There isn't enough disk space to export to “${folder}”. Free up space or choose another drive.`);
    case "EISDIR":
      return new ExportError("not-a-file", `“${name}” in “${folder}” is a folder, so it can't be replaced by an exported file.`);
    case "ENAMETOOLONG":
    case "EINVAL":
      return new ExportError("invalid-path", `“${folder}” can't hold an export (the path is too long or invalid). Choose another folder.`);
    default:
      return new ExportError("failed", `Layoutry couldn't write “${name}” in “${folder}”.`);
  }
}

function expectMode(value: unknown): ExportMode {
  if (value !== "standalone" && value !== "separate") throw new InvalidPayloadError("mode must be standalone or separate");
  return value;
}

function expectFiles(value: unknown): ExportPayload {
  if (!Array.isArray(value) || value.length < 1 || value.length > EXPORT_FILE_NAMES.length + MAX_EXPORT_ASSETS)
    throw new InvalidPayloadError("files must be an array of 1–3 files plus packaged images");
  const files = new Map<ExportFileName, string>();
  const assets = new Map<string, Buffer>();
  let total = 0;
  let assetTotal = 0;
  for (const entry of value) {
    if (typeof entry === "object" && entry !== null && "bytes" in entry) {
      const asset = expectKeys(entry, ["path", "bytes"]);
      const assetPath = asset.path;
      const match = typeof assetPath === "string" ? ASSET_PATH.exec(assetPath) : null;
      if (typeof assetPath !== "string" || !match) throw new InvalidPayloadError("unexpected asset name");
      if (assets.has(assetPath)) throw new InvalidPayloadError("duplicate asset");
      if (!(asset.bytes instanceof Uint8Array)) throw new InvalidPayloadError("asset bytes must be a Uint8Array");
      if (asset.bytes.length === 0 || asset.bytes.length > MAX_EXPORT_ASSET_BYTES) throw new InvalidPayloadError("asset size out of range");
      if (!hasImageSignature(asset.bytes, match[1])) throw new InvalidPayloadError("asset bytes don't match its type");
      assetTotal += asset.bytes.length;
      if (assetTotal > MAX_EXPORT_ASSET_TOTAL_BYTES) throw new InvalidPayloadError("assets too large");
      assets.set(assetPath, Buffer.from(asset.bytes));
      continue;
    }
    const file = expectKeys(entry, ["path", "content"]);
    const name = EXPORT_FILE_NAMES.find((candidate) => candidate === file.path);
    if (!name) throw new InvalidPayloadError("unexpected export file name");
    if (files.has(name)) throw new InvalidPayloadError("duplicate export file");
    if (typeof file.content !== "string") throw new InvalidPayloadError("file content must be a string");
    if (file.content.length > MAX_EXPORT_FILE_CHARACTERS) throw new InvalidPayloadError("export file too large");
    total += file.content.length;
    if (total > MAX_EXPORT_TOTAL_CHARACTERS) throw new InvalidPayloadError("export too large");
    files.set(name, file.content);
  }
  if (files.size === 0) throw new InvalidPayloadError("an export needs at least index.html");
  return { texts: files, assets };
}

export function createExportFileService(options: ExportFileServiceOptions) {
  const ops = options.ops ?? nodeExportFileOps;
  const hooks = options.writeHooks ?? {};
  const createToken = options.createToken ?? (() => randomBytes(16).toString("hex"));
  const owners = new Map<number, Map<string, Destination>>();
  let lastFolder: string | null = null;

  function issue(ownerId: number, destination: Destination): string {
    let tokens = owners.get(ownerId);
    if (!tokens) {
      tokens = new Map();
      owners.set(ownerId, tokens);
    }
    let token = createToken();
    while (tokens.has(token)) token = createToken();
    tokens.set(token, destination);
    while (tokens.size > MAX_DESTINATIONS_PER_OWNER) {
      const oldest = tokens.keys().next().value;
      if (oldest === undefined) break;
      tokens.delete(oldest);
    }
    return token;
  }

  /** A real folder — not a symbolic link or junction (lstat reports both as links). */
  async function assertRealFolder(folder: string): Promise<void> {
    let stat;
    try {
      stat = await ops.lstat(folder);
    } catch (error) {
      throw errorFromErrno(error, folderLabel(folder), folderLabel(folder));
    }
    if (stat.isSymbolicLink())
      throw new ExportError("symbolic-link", `“${folderLabel(folder)}” is a shortcut link (symbolic link or junction). Layoutry only exports into real folders; choose the folder it points to.`);
    if (!stat.isDirectory()) throw new ExportError("not-a-folder", `“${folderLabel(folder)}” isn't a folder.`);
  }

  async function observe(target: Pick<Target, "filePath" | "label">, folder: string): Promise<TargetState> {
    let stat;
    try {
      stat = await ops.lstat(target.filePath);
    } catch (error) {
      if (errnoOf(error) === "ENOENT") return { kind: "missing" };
      throw errorFromErrno(error, target.label, folderLabel(folder));
    }
    if (stat.isSymbolicLink())
      throw new ExportError("symbolic-link", `“${target.label}” in “${folderLabel(folder)}” is a shortcut link (symbolic link or junction). Layoutry doesn't write through links; remove it or choose another folder.`);
    if (!stat.isFile()) throw new ExportError("not-a-file", `“${target.label}” in “${folderLabel(folder)}” is a folder, so it can't be replaced by an exported file.`);
    if (stat.size > MAX_REPLACED_FILE_BYTES)
      throw new ExportError("too-large", `“${target.label}” in “${folderLabel(folder)}” is too large for Layoutry to replace safely. Choose another folder.`);
    let bytes: Buffer;
    try {
      bytes = await ops.readFile(target.filePath);
    } catch (error) {
      if (errnoOf(error) === "ENOENT") return { kind: "missing" };
      throw errorFromErrno(error, target.label, folderLabel(folder));
    }
    return { kind: "file", fingerprint: fingerprintOf(bytes), bytes };
  }

  function sameState(a: TargetState, b: TargetState): boolean {
    if (a.kind === "missing" || b.kind === "missing") return a.kind === b.kind;
    return a.fingerprint.sha256 === b.fingerprint.sha256;
  }

  async function chooseStandalone(ownerId: number, suggestedName: unknown): Promise<ChooseExportDestinationResult> {
    const suggested = safeSuggestedHtmlName(suggestedName);
    const chosen = await options.showSaveHtmlDialog(path.join(lastFolder ?? options.defaultFolder(), suggested));
    if (chosen === null) return { status: "cancelled" };
    assertAbsolutePath(chosen);
    let filePath = chosen;
    if (!HTML_EXTENSIONS.includes(path.extname(filePath).toLowerCase())) {
      filePath = `${filePath}.html`;
      // The dialog confirmed replacing the name it showed, not this one.
      const exists = await ops.lstat(filePath).then(
        () => true,
        () => false,
      );
      if (exists) throw new ExportError("invalid-path", `“${path.basename(filePath)}” already exists. Choose another name, ending in .html.`);
    }
    const folder = path.dirname(filePath);
    await assertRealFolder(folder);
    const state = await observe({ filePath, label: path.basename(filePath) }, folder);
    lastFolder = folder;
    const label = folderLabel(folder);
    return {
      status: "chosen",
      destination: {
        token: issue(ownerId, { kind: "file", folder, filePath, label, confirmed: state.kind === "file" ? state.fingerprint : null }),
        label: path.basename(filePath),
      },
    };
  }

  async function chooseFolder(ownerId: number): Promise<ChooseExportDestinationResult> {
    const chosen = await options.showFolderDialog(lastFolder ?? options.defaultFolder());
    if (chosen === null) return { status: "cancelled" };
    assertAbsolutePath(chosen);
    const folder = path.resolve(chosen);
    await assertRealFolder(folder);
    lastFolder = folder;
    const label = folderLabel(folder);
    return { status: "chosen", destination: { token: issue(ownerId, { kind: "folder", folder, label }), label } };
  }

  function targetsFor(destination: Destination, payload: ExportPayload): Target[] {
    const { texts: files, assets } = payload;
    const textBytes = (name: ExportFileName) => Buffer.from(files.get(name) ?? "", "utf8");
    if (destination.kind === "file") {
      if (files.size !== 1 || !files.has("index.html") || assets.size > 0) throw new InvalidPayloadError("a single-file export is exactly index.html");
      return [{ name: "index.html", filePath: destination.filePath, label: path.basename(destination.filePath), bytes: textBytes("index.html") }];
    }
    if (!files.has("index.html") || !files.has("styles.css")) throw new InvalidPayloadError("a separate-files export needs index.html and styles.css");
    const assetsFolder = path.join(destination.folder, EXPORT_ASSET_FOLDER);
    // Images first and index.html last: until it is in place, the folder never links to files that aren't there yet.
    const imageTargets: Target[] = [...assets.entries()].map(([name, bytes]) => {
      const filePath = path.join(assetsFolder, name.slice(EXPORT_ASSET_FOLDER.length + 1));
      // Engine-numbered names can't escape the assets folder; checked anyway.
      if (path.dirname(filePath) !== assetsFolder) throw new InvalidPayloadError("export file outside its folder");
      return { name, filePath, label: name, bytes };
    });
    const order: ExportFileName[] = ["styles.css", "script.js", "index.html"];
    const textTargets = order
      .filter((name) => files.has(name))
      .map((name) => {
        const filePath = path.join(destination.folder, name);
        // Fixed names can't escape the folder; checked anyway.
        if (path.dirname(filePath) !== destination.folder) throw new InvalidPayloadError("export file outside its folder");
        return { name, filePath, label: name, bytes: textBytes(name) };
      });
    return [...imageTargets, ...textTargets];
  }

  /**
   * The assets folder an image export writes into (BC-07.3): missing (to be
   * created) or a real folder. A link (symbolic link or junction) or a file
   * there is refused before anything is read or written through it.
   */
  async function inspectAssetsFolder(folder: string): Promise<"missing" | "folder"> {
    const assetsFolder = path.join(folder, EXPORT_ASSET_FOLDER);
    let stat;
    try {
      stat = await ops.lstat(assetsFolder);
    } catch (error) {
      if (errnoOf(error) === "ENOENT") return "missing";
      throw errorFromErrno(error, EXPORT_ASSET_FOLDER, folderLabel(folder));
    }
    if (stat.isSymbolicLink())
      throw new ExportError(
        "symbolic-link",
        `“${EXPORT_ASSET_FOLDER}” in “${folderLabel(folder)}” is a shortcut link (symbolic link or junction). Layoutry doesn't write through links; remove it or choose another folder.`,
      );
    if (!stat.isDirectory())
      throw new ExportError(
        "not-a-folder",
        `“${EXPORT_ASSET_FOLDER}” in “${folderLabel(folder)}” is a file, so the exported images can't go in an assets folder there. Rename it or choose another folder.`,
      );
    return "folder";
  }

  /** Next to its target, so the final rename never crosses folders or volumes. */
  function tempPathFor(target: Target): string {
    const suffix = (hooks.randomSuffix ?? (() => randomBytes(12).toString("hex")))();
    return path.join(path.dirname(target.filePath), `.${path.basename(target.filePath, path.extname(target.filePath))}.${suffix}${TEMP_EXTENSION}`);
  }

  async function renameWithRetry(from: string, to: string): Promise<void> {
    const delays = hooks.replaceRetryDelaysMs ?? [50, 100, 200, 400, 800];
    const sleep = hooks.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
    for (let attempt = 0; ; attempt += 1) {
      try {
        await ops.rename(from, to);
        return;
      } catch (error) {
        const errno = errnoOf(error);
        if (!(errno === "EPERM" || errno === "EACCES" || errno === "EBUSY") || attempt >= delays.length) throw error;
        await sleep(delays[attempt]);
      }
    }
  }

  /** Puts replaced files back; returns the labels it could not restore. */
  async function rollBack(replaced: { target: Target; before: TargetState; written: FileFingerprint }[], folder: string): Promise<string[]> {
    const unrestored: string[] = [];
    for (const { target, before, written } of [...replaced].reverse()) {
      try {
        if (before.kind === "file") {
          await replaceFileAtomically(target.filePath, before.bytes, { tempExtension: TEMP_EXTENSION, maxBytes: MAX_REPLACED_FILE_BYTES }, ops, hooks);
        } else {
          // Removed only while it is still exactly what this export wrote.
          const now = await observe(target, folder);
          if (now.kind === "file" && now.fingerprint.sha256 === written.sha256) await ops.unlink(target.filePath);
          else if (now.kind === "file") unrestored.push(target.label);
        }
      } catch {
        unrestored.push(target.label);
      }
    }
    return unrestored;
  }

  async function writeFiles(destination: Destination, targets: Target[], overwrite: boolean): Promise<WriteExportFilesResult> {
    const { folder } = destination;
    const shownFolder = folderLabel(folder);
    await assertRealFolder(folder);
    const hasImages = targets.some((target) => target.name.startsWith(`${EXPORT_ASSET_FOLDER}/`));
    const assetsFolder = path.join(folder, EXPORT_ASSET_FOLDER);
    // Checked before any file inside it is looked at, so nothing is ever read through a link.
    const assetsFolderState = hasImages ? await inspectAssetsFolder(folder) : "folder";

    const before = new Map<Target, TargetState>();
    for (const target of targets) before.set(target, await observe(target, folder));

    if (!overwrite) {
      const existing = targets.filter((target) => {
        const state = before.get(target);
        if (state?.kind !== "file") return false;
        // The Save dialog already confirmed replacing this exact file.
        return !(destination.kind === "file" && destination.confirmed?.sha256 === state.fingerprint.sha256);
      });
      if (existing.length > 0) return { status: "conflict", label: destination.kind === "file" ? shownFolder : destination.label, existing: existing.map((target) => target.label) };
    }

    // 0. BC-07.3: the assets folder, when this export brings images and it doesn't exist yet.
    let createdAssetsFolder = false;
    if (hasImages && assetsFolderState === "missing") {
      try {
        await ops.mkdir(assetsFolder);
      } catch (error) {
        throw errorFromErrno(error, EXPORT_ASSET_FOLDER, shownFolder);
      }
      createdAssetsFolder = true;
    }
    // Only ever a folder this export created, and only while it is empty (rmdir refuses otherwise).
    const removeCreatedAssetsFolder = async () => {
      if (createdAssetsFolder) await ops.rmdir(assetsFolder).catch(() => undefined);
    };

    // 1. Stage: every file written and flushed to a temporary file. Nothing visible has changed yet.
    const staged = new Map<Target, { tempPath: string; written: FileFingerprint }>();
    const discardStaged = async () => {
      for (const { tempPath } of staged.values()) await ops.unlink(tempPath).catch(() => undefined);
    };
    for (const target of targets) {
      const bytes = target.bytes;
      const tempPath = tempPathFor(target);
      let file;
      try {
        file = await ops.createExclusive(tempPath);
      } catch (error) {
        await discardStaged();
        await removeCreatedAssetsFolder();
        throw errorFromErrno(error, target.label, shownFolder);
      }
      staged.set(target, { tempPath, written: fingerprintOf(bytes) });
      try {
        await file.write(bytes);
        await file.sync();
        await file.close();
      } catch (error) {
        await file.close().catch(() => undefined);
        await discardStaged();
        await removeCreatedAssetsFolder();
        throw errorFromErrno(error, target.label, shownFolder);
      }
    }

    // 2. Replace, one file at a time; on any failure put back what was replaced.
    const replaced: { target: Target; before: TargetState; written: FileFingerprint }[] = [];
    for (const target of targets) {
      const stage = staged.get(target);
      const expected = before.get(target);
      if (!stage || !expected) continue;
      let failure: ExportError | null = null;
      try {
        // Re-checked right before the replace: a file created or changed
        // since the conflict check is never overwritten unseen.
        if (!sameState(expected, await observe(target, folder)))
          failure = new ExportError("changed", `“${target.label}” in “${shownFolder}” changed while Layoutry was exporting.`);
        else await renameWithRetry(stage.tempPath, target.filePath);
      } catch (error) {
        failure = errorFromErrno(error, target.label, shownFolder);
      }
      if (failure) {
        await discardStaged();
        const unrestored = await rollBack(replaced, folder);
        await removeCreatedAssetsFolder();
        const outcome =
          unrestored.length === 0
            ? replaced.length === 0
              ? "Nothing was exported or changed."
              : "Nothing was exported: the files already replaced were put back as they were."
            : `Some files couldn't be put back as they were: ${unrestored.join(", ")}. Check “${shownFolder}” before using it.`;
        return { status: "error", error: { code: failure.code, message: `${failure.message} ${outcome}` } };
      }
      staged.delete(target);
      replaced.push({ target, before: expected, written: stage.written });
    }

    // 3. Read back what is now on disk.
    for (const { target, written } of replaced) {
      const now = await observe(target, folder).catch(() => null);
      if (now?.kind !== "file" || now.fingerprint.sha256 !== written.sha256)
        return {
          status: "error",
          error: { code: "verification-failed", message: `“${target.label}” was saved, but reading it back didn't match. Export again, or choose another folder.` },
        };
    }
    return { status: "saved", label: destination.kind === "file" ? shownFolder : destination.label, fileNames: targets.map((target) => target.label) };
  }

  return {
    async chooseDestination(ownerId: number, payload: unknown): Promise<ChooseExportDestinationResult> {
      const request = expectKeys(payload, ["mode", "suggestedName"]);
      const mode = expectMode(request.mode);
      if (typeof request.suggestedName !== "string" || request.suggestedName.length > MAX_SUGGESTED_NAME_LENGTH)
        throw new InvalidPayloadError("suggested name must be a short string");
      try {
        return mode === "standalone" ? await chooseStandalone(ownerId, request.suggestedName) : await chooseFolder(ownerId);
      } catch (error) {
        if (error instanceof InvalidPayloadError) throw error;
        const failure = errorFromErrno(error, "the export", "the chosen folder");
        return { status: "error", error: { code: failure.code, message: failure.message } };
      }
    },

    async write(ownerId: number, payload: unknown): Promise<WriteExportFilesResult> {
      const request = expectKeys(payload, ["token", "files", "overwrite"]);
      const token = expectToken(request.token);
      if (typeof request.overwrite !== "boolean") throw new InvalidPayloadError("overwrite must be a boolean");
      const exportFiles = expectFiles(request.files);
      const destination = FILE_TOKEN_PATTERN.test(token) ? owners.get(ownerId)?.get(token) : undefined;
      if (!destination)
        return { status: "error", error: { code: "invalid-token", message: "Layoutry no longer has access to that destination. Save again and choose where to save." } };
      const targets = targetsFor(destination, exportFiles);
      try {
        const result = await writeFiles(destination, targets, request.overwrite);
        // One successful write per choice: the next export asks again.
        if (result.status === "saved") owners.get(ownerId)?.delete(token);
        return result;
      } catch (error) {
        const failure = errorFromErrno(error, "the export", folderLabel(destination.folder));
        return { status: "error", error: { code: failure.code, message: `${failure.message} Nothing was exported or changed.` } };
      }
    },

    /** Drops every destination of a closed or crashed window. */
    revokeOwner(ownerId: number): void {
      owners.delete(ownerId);
    },
  };
}

export type ExportFileService = ReturnType<typeof createExportFileService>;
