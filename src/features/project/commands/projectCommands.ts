import { useEditorStore } from "@/features/editor/stores/useEditorStore";
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
  useProjectStore,
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

export type ProjectCommandResult =
  { ok: true } | { ok: false; error: ProjectCommandError };

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
        session().activateProject(createProjectMetadata({ now: now() }), null);
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
        const revision = session().libraryRevision;
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
          session().recordSave(snapshot, saved);
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
          session().activateProject(created, created.updatedAt);
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
        session().activateProject(
          parsed.project.metadata,
          stored.metadata.updatedAt,
        );
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
        session().activateProject(metadata, metadata.updatedAt);
        session().showToast(`Imported “${metadata.name}”`);
        void refreshLibrary();
        return { ok: true };
      });
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
