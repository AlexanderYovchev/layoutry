import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type {
  DesktopOpenedFile,
  DesktopProjectFiles,
  DesktopServiceError,
} from "@/features/project/desktop/desktopProjectFiles";
import { normalizeProjectName } from "@/features/project/rules/projectName";
import {
  DEFAULT_PROJECT_LIMITS,
  type ProjectLimits,
} from "@/features/project/rules/projectLimits";
import {
  ProjectStorageError,
  type ProjectRepository,
  type WriteExpectation,
} from "@/features/project/storage/projectRepository";
import {
  UNSAVED_LOCATION,
  useProjectStore,
  type ProjectLocation,
  type ProjectOperation,
} from "@/features/project/stores/useProjectStore";
import type {
  LayoutryProject,
  ProjectMetadata,
} from "@/features/project/types/projectFile";
import { createBlankDocument } from "@/features/project/utils/createBlankDocument";
import { parseProjectFile } from "@/features/project/utils/parseProjectFile";
import { projectFileName } from "@/features/project/utils/projectFileName";
import {
  createProjectMetadata,
  ProjectSerializationError,
  serializeProject,
  touchProjectMetadata,
} from "@/features/project/utils/serializeProject";

export interface ProjectCommandError {
  title: string;
  message: string;
}

/** The file on disk no longer matches what this session last read or wrote. */
export interface FileConflict {
  reason: "modified" | "missing";
  fileName: string;
}

export type ProjectCommandResult =
  | { ok: true }
  | { ok: false; error: ProjectCommandError }
  /** The user cancelled a native dialog: nothing happened. */
  | { ok: false; cancelled: true }
  /** Saving would overwrite a change made outside Layoutry: nothing was written. */
  | { ok: false; conflict: FileConflict };

/**
 * How an imported project whose id may already be in the library is added:
 * - `keep-id`: the file's identity, when the id is not in the library;
 * - `copy`: a new id, leaving the existing project untouched;
 * - `replace`: overwrite the existing project (explicit user choice only).
 */
export type ImportMode = "keep-id" | "copy" | "replace";

export interface ProjectCommandsOptions {
  repository: ProjectRepository;
  /** Hands a finished `.layoutry` file to the user (the browser download). */
  saveFile: (fileName: string, text: string) => void;
  /** Native `.layoutry` files, in the desktop app only (PROJECT-1.3). */
  desktop?: DesktopProjectFiles | null;
  now?: () => Date;
  limits?: ProjectLimits;
}

/**
 * Project operations (PROJECT-1.2): New, Save, Save As, Open, Import,
 * Download, Delete. They connect the editor store, the project session
 * store, serialization and a ProjectRepository, and contain no UI —
 * confirmation and dialogs are the caller's job.
 *
 * Library operations run one at a time, in request order: a second Save
 * waits for the first and then saves the latest document, so writes can
 * never interleave. The saved baseline is always the exact document and
 * metadata snapshot that was written, set only after the write completed;
 * edits made meanwhile stay unsaved, and a failed write changes nothing.
 */
export function createProjectCommands({
  repository,
  saveFile,
  desktop = null,
  now = () => new Date(),
  limits = DEFAULT_PROJECT_LIMITS,
}: ProjectCommandsOptions) {
  const editor = () => useEditorStore.getState();
  const session = () => useProjectStore.getState();

  let queueTail: Promise<ProjectCommandResult> | null = null;

  /**
   * Runs library operations one at a time. With nothing queued, the
   * operation starts synchronously, so the snapshot it saves is the state at
   * the moment the user asked — not after their next keystroke.
   */
  function exclusive(
    operation: ProjectOperation | null,
    task: () => Promise<ProjectCommandResult>,
  ): Promise<ProjectCommandResult> {
    const start = async (): Promise<ProjectCommandResult> => {
      session().setOperation(operation);
      try {
        return await task();
      } catch (error) {
        return { ok: false, error: describeFailure(error) };
      } finally {
        session().setOperation(null);
      }
    };
    const run = queueTail ? queueTail.then(start) : start();
    queueTail = run;
    void run.then(() => {
      if (queueTail === run) queueTail = null;
    });
    return run;
  }

  function editInProgress(): ProjectCommandResult | null {
    if (editor().transactionSnapshot === null) return null;
    return failure(
      "Finish the current edit first",
      "Finish or cancel the current drag, resize or drawing, then try again.",
    );
  }

  async function refreshLibrary(): Promise<void> {
    const { library, setLibrary } = session();
    setLibrary({ ...library, status: "loading" });
    try {
      setLibrary({
        status: "ready",
        entries: await repository.list(),
        error: null,
      });
    } catch (error) {
      setLibrary({
        status: "error",
        entries: [],
        error: describeFailure(error).message,
      });
    }
  }

  /** Lets go of the previous file's token once another location is active. */
  function releaseReplacedFile(previous: ProjectLocation) {
    const current = session().location;
    if (
      desktop &&
      previous.kind === "file" &&
      !(current.kind === "file" && current.token === previous.token)
    )
      desktop.releaseProjectFile(previous.token);
  }

  function activate(
    metadata: ProjectMetadata,
    location: ProjectLocation,
  ): void {
    const previous = session().location;
    session().activateProject(metadata, location);
    releaseReplacedFile(previous);
  }

  async function writeProject(
    project: LayoutryProject,
    expectation: WriteExpectation,
  ): Promise<void> {
    const text = serializeProject(project, limits);
    await repository.write({ metadata: project.metadata, text }, expectation);
  }

  return {
    refreshLibrary,

    /** Starts a fresh, unsaved project with an empty page. Never saves. */
    newProject(): Promise<ProjectCommandResult> {
      return exclusive(null, async () => {
        editor().replaceDocument(createBlankDocument());
        activate(createProjectMetadata({ now: now() }), UNSAVED_LOCATION);
        return { ok: true };
      });
    },

    /**
     * Saves the active project to the library under its own id. `name`
     * names a project on its first save.
     */
    save(options: { name?: string } = {}): Promise<ProjectCommandResult> {
      return exclusive("save", async () => {
        const blocked = editInProgress();
        if (blocked) return blocked;

        const snapshot = session().metadata;
        const document = editor().document;
        const location = session().location;
        const revision = location.kind === "library" ? location.revision : null;
        const saved = touchProjectMetadata(
          options.name === undefined
            ? snapshot
            : { ...snapshot, name: options.name },
          now(),
        );
        await writeProject(
          { metadata: saved, document },
          revision === null
            ? { kind: "new" }
            : { kind: "revision", updatedAt: revision },
        );

        if (session().metadata.id === snapshot.id) {
          editor().markDocumentPersisted(document);
          session().recordSave(snapshot, saved, {
            kind: "library",
            revision: saved.updatedAt,
          });
          releaseReplacedFile(location);
        }
        session().showToast(`Saved “${saved.name}”`);
        void refreshLibrary();
        return { ok: true };
      });
    },

    /**
     * Saves the current document as a separate, new project and switches to
     * it once the write succeeded. The original project is left as stored.
     */
    saveAs(name: string): Promise<ProjectCommandResult> {
      return exclusive("save-as", async () => {
        const blocked = editInProgress();
        if (blocked) return blocked;

        const previousId = session().metadata.id;
        const document = editor().document;
        const created = createProjectMetadata({ name, now: now() });
        await writeProject({ metadata: created, document }, { kind: "new" });

        if (session().metadata.id === previousId) {
          editor().markDocumentPersisted(document);
          activate(created, { kind: "library", revision: created.updatedAt });
        }
        session().showToast(`Saved as “${created.name}”`);
        void refreshLibrary();
        return { ok: true };
      });
    },

    /** Opens a library project, replacing the editor document atomically. */
    open(id: string): Promise<ProjectCommandResult> {
      return exclusive("open", async () => {
        const stored = await repository.read(id);
        const parsed = parseProjectFile(stored.text, limits);
        if (!parsed.ok)
          return failure(
            "This project can't be opened",
            `The saved project is damaged: ${parsed.error.message}`,
          );
        if (parsed.project.metadata.id !== id)
          return failure(
            "This project can't be opened",
            "The saved project is damaged: its contents belong to a different project.",
          );

        editor().replaceDocument(parsed.project.document);
        activate(parsed.project.metadata, {
          kind: "library",
          revision: stored.metadata.updatedAt,
        });
        session().showToast(`Opened “${parsed.project.metadata.name}”`);
        return { ok: true };
      });
    },

    /** The library's summary for `id`, or null. Used to detect import id collisions. */
    async findInLibrary(
      id: string,
    ): Promise<
      | { ok: true; existing: ProjectMetadata | null }
      | { ok: false; error: ProjectCommandError }
    > {
      try {
        return { ok: true, existing: await repository.find(id) };
      } catch (error) {
        return { ok: false, error: describeFailure(error) };
      }
    },

    /**
     * Adds an already-validated project (from loadProjectFromFile) to the
     * library and makes it active. Nothing changes unless the write succeeds.
     */
    importProject(
      project: LayoutryProject,
      mode: ImportMode,
    ): Promise<ProjectCommandResult> {
      return exclusive("import", async () => {
        const metadata =
          mode === "copy"
            ? createProjectMetadata({ name: project.metadata.name, now: now() })
            : project.metadata;
        await writeProject(
          { metadata, document: project.document },
          mode === "replace" ? { kind: "overwrite" } : { kind: "new" },
        );

        editor().replaceDocument(project.document);
        activate(metadata, { kind: "library", revision: metadata.updatedAt });
        session().showToast(`Imported “${metadata.name}”`);
        void refreshLibrary();
        return { ok: true };
      });
    },

    /**
     * Makes an opened native file (already validated by the caller with
     * parseProjectFile) the active project, replacing the document
     * atomically. Desktop only.
     */
    openFile(
      file: DesktopOpenedFile,
      project: LayoutryProject,
    ): Promise<ProjectCommandResult> {
      return exclusive("open", async () => {
        editor().replaceDocument(project.document);
        activate(project.metadata, {
          kind: "file",
          token: file.token,
          fileName: file.fileName,
        });
        session().showToast(`Opened ${file.fileName}`);
        return { ok: true };
      });
    },

    /**
     * Saves to a native `.layoutry` file (desktop). Without `saveAs`, a
     * project that already has a file is written back to it; otherwise the
     * native Save dialog picks the destination, and the project takes the
     * file's name. Save As always creates a new project identity, like the
     * library's Save As; the first save of a new project keeps its own.
     *
     * Nothing changes unless the write succeeds. `force` overwrites a file
     * that changed outside Layoutry, after the user confirmed it.
     */
    saveToFile(
      options: { saveAs?: boolean; force?: boolean } = {},
    ): Promise<ProjectCommandResult> {
      const saveAs = options.saveAs ?? false;
      return exclusive(saveAs ? "save-as" : "save", async () => {
        if (!desktop)
          return failure(
            "Files aren't available here",
            "Saving to files needs the Layoutry desktop app.",
          );
        const blocked = editInProgress();
        if (blocked) return blocked;

        const previous = session().location;
        let target: { token: string; fileName: string };
        let chosen = false;
        if (!saveAs && previous.kind === "file") {
          target = previous;
        } else {
          const choice = await desktop.chooseSaveLocation(
            projectFileName(session().metadata.name),
          );
          if (choice.status === "cancelled")
            return { ok: false, cancelled: true };
          if (choice.status === "error") return fileFailure(choice.error);
          target = choice.target;
          chosen = true;
        }

        // Taken after the dialog: this exact snapshot is what gets written.
        const snapshot = session().metadata;
        const document = editor().document;
        const name = chosen
          ? (nameFromFileName(target.fileName) ?? snapshot.name)
          : snapshot.name;
        const saved = saveAs
          ? createProjectMetadata({ name, now: now() })
          : touchProjectMetadata({ ...snapshot, name }, now());
        let text: string;
        try {
          text = serializeProject({ metadata: saved, document }, limits);
        } catch (error) {
          if (chosen) desktop.releaseProjectFile(target.token);
          throw error;
        }

        const result = await desktop.writeProjectFile(
          target.token,
          text,
          options.force ?? false,
        );
        if (result.status !== "saved") {
          if (chosen) desktop.releaseProjectFile(target.token);
          return result.status === "conflict"
            ? {
                ok: false,
                conflict: { reason: result.reason, fileName: result.fileName },
              }
            : fileFailure(result.error);
        }

        const location: ProjectLocation = {
          kind: "file",
          token: target.token,
          fileName: target.fileName,
        };
        if (session().metadata.id === snapshot.id) {
          editor().markDocumentPersisted(document);
          if (saveAs) activate(saved, location);
          else {
            session().recordSave(snapshot, saved, location);
            releaseReplacedFile(previous);
          }
        } else if (chosen) {
          // Another project became active meanwhile: don't adopt the file.
          desktop.releaseProjectFile(target.token);
        }
        session().showToast(`Saved ${target.fileName}`);
        return { ok: true };
      });
    },

    /** Resolves once every queued operation has finished. */
    whenIdle(): Promise<void> {
      return (queueTail ?? Promise.resolve()).then(() => undefined);
    },

    /**
     * Downloads the current document and metadata as a `.layoutry` file.
     * Changes nothing: not the library, not the saved baseline.
     */
    download(): ProjectCommandResult {
      const blocked = editInProgress();
      if (blocked) return blocked;
      try {
        const metadata = touchProjectMetadata(session().metadata, now());
        const text = serializeProject(
          { metadata, document: editor().document },
          limits,
        );
        const fileName = projectFileName(metadata.name);
        saveFile(fileName, text);
        session().showToast(`Downloaded ${fileName}`);
        return { ok: true };
      } catch (error) {
        return { ok: false, error: describeFailure(error) };
      }
    },

    /**
     * Permanently deletes a library project. Deleting the active project
     * keeps it open, as an unsaved project.
     */
    remove(id: string, name?: string): Promise<ProjectCommandResult> {
      return exclusive("delete", async () => {
        await repository.remove(id);
        if (session().metadata.id === id) session().detachFromLibrary();
        session().showToast(
          name === undefined ? "Project deleted" : `Deleted “${name}”`,
        );
        void refreshLibrary();
        return { ok: true };
      });
    },
  };
}

export type ProjectCommands = ReturnType<typeof createProjectCommands>;

/** "Landing page.layoutry" → "Landing page", if that is a valid project name. */
export function nameFromFileName(fileName: string): string | null {
  const stem = fileName.replace(/\.layoutry$/i, "");
  const result = normalizeProjectName(stem);
  return result.ok ? result.name : null;
}

const FILE_ERROR_TITLES: Record<string, string> = {
  "not-found": "File not found",
  "permission-denied": "Permission denied",
  locked: "The file is in use",
  "disk-full": "The disk is full",
  "too-large": "This file is too large",
  "not-a-file": "This isn't a project file",
  "symbolic-link": "Links can't be opened or saved",
  "invalid-path": "This location can't be used",
  "verification-failed": "The save couldn't be verified",
  "invalid-token": "Layoutry lost access to this file",
};

function fileFailure(error: DesktopServiceError): ProjectCommandResult {
  return failure(
    FILE_ERROR_TITLES[error.code] ?? "The file couldn't be saved",
    error.message,
  );
}

function failure(title: string, message: string): ProjectCommandResult {
  return { ok: false, error: { title, message } };
}

function describeFailure(error: unknown): ProjectCommandError {
  if (error instanceof ProjectStorageError) {
    const titles: Record<ProjectStorageError["code"], string> = {
      unavailable: "Project storage isn't available",
      blocked: "Project storage is busy",
      "quota-exceeded": "Not enough storage space",
      "not-found": "Project not found",
      conflict: "Project changed elsewhere",
      corrupted: "This project can't be opened",
      failed: "Project storage failed",
    };
    return { title: titles[error.code], message: error.message };
  }
  if (error instanceof ProjectSerializationError)
    return {
      title: "This project couldn't be written",
      message: `Layoutry found a problem in the document and saved nothing: ${error.message}`,
    };
  return {
    title: "Something went wrong",
    message: "The operation couldn't be completed. Nothing was changed.",
  };
}
