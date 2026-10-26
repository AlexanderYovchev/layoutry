import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type {
  ImportMode,
  ProjectCommandResult,
  ProjectCommands,
} from "@/features/project/commands/projectCommands";
import type {
  DesktopOpenResult,
  DesktopProjectFiles,
} from "@/features/project/desktop/desktopProjectFiles";
import {
  useProjectDialogStore,
  type ProjectNamePurpose,
  type ProjectSwitch,
} from "@/features/project/stores/useProjectDialogStore";
import {
  selectHasUnsavedProjectChanges,
  useProjectStore,
} from "@/features/project/stores/useProjectStore";
import { loadProjectFromFile } from "@/features/project/utils/loadProjectFromFile";
import { parseProjectFile } from "@/features/project/utils/parseProjectFile";

/**
 * The user-facing project flows: when to confirm, which dialog comes next,
 * and how results are reported. Menus, shortcuts and dialogs call these;
 * the commands they drive contain no UI.
 *
 * Every action that replaces the active project (New, Open, Import, an
 * Explorer/command-line open) — and, in the desktop app, closing the
 * window — asks first when there are unsaved changes, offering Save /
 * Don't Save / Cancel. Save must succeed before anything continues.
 *
 * Where Save goes (PROJECT-1.3):
 * - a project opened from or saved to a file → that file;
 * - a project from the library → the library;
 * - a new project → a file chosen in the native Save dialog (desktop), or
 *   the browser library after naming it (browser).
 * Save As → a new file (desktop) or a new library project (browser).
 */
export function createProjectWorkflow(
  commands: ProjectCommands,
  desktop: DesktopProjectFiles | null = null,
) {
  const ui = () => useProjectDialogStore.getState();
  const session = () => useProjectStore.getState();

  function hasUnsavedChanges(): boolean {
    return selectHasUnsavedProjectChanges(session(), useEditorStore.getState());
  }

  /** Shows what went wrong; a cancelled dialog is silent. */
  function report(result: ProjectCommandResult): boolean {
    if (result.ok) return true;
    if ("error" in result)
      ui().showDialog({ kind: "error", error: result.error });
    else if ("conflict" in result)
      ui().showDialog({ kind: "file-conflict", conflict: result.conflict });
    return false;
  }

  /** Save in place, wherever the project lives, without asking for a name. */
  function saveInPlace(): Promise<ProjectCommandResult> {
    const location = session().location;
    if (location.kind === "file" || (desktop && location.kind === "unsaved"))
      return commands.saveToFile();
    return commands.save();
  }

  function releaseSwitch(pending: ProjectSwitch) {
    if (pending.kind === "open-file")
      desktop?.releaseProjectFile(pending.file.token);
    if (pending.kind === "close") desktop?.respondToCloseRequest(false);
  }

  async function runSwitch(pending: ProjectSwitch): Promise<boolean> {
    if (pending.kind === "close") {
      desktop?.respondToCloseRequest(true);
      return true;
    }
    const result =
      pending.kind === "new"
        ? await commands.newProject()
        : pending.kind === "open"
          ? await commands.open(pending.id)
          : pending.kind === "open-file"
            ? await commands.openFile(pending.file, pending.project)
            : await commands.importProject(pending.project, pending.mode);
    if (result.ok) ui().setLibraryOpen(false);
    else releaseSwitch(pending);
    return report(result);
  }

  function requestSwitch(pending: ProjectSwitch): Promise<boolean> {
    if (hasUnsavedChanges()) {
      const replaced = ui().dialog;
      if (replaced?.kind === "discard") releaseSwitch(replaced.pending);
      ui().showDialog({ kind: "discard", pending });
      return Promise.resolve(false);
    }
    return runSwitch(pending);
  }

  /** Validates an opened native file, then switches to it (asking first if needed). */
  async function openDesktopResult(
    result: DesktopOpenResult,
  ): Promise<boolean> {
    if (result.status === "cancelled" || result.status === "none") return false;
    if (result.status === "error") {
      ui().showDialog({
        kind: "error",
        error: {
          title: "This file can't be opened",
          message: result.error.message,
        },
      });
      return false;
    }
    const parsed = parseProjectFile(result.file.text);
    if (!parsed.ok) {
      desktop?.releaseProjectFile(result.file.token);
      ui().showDialog({
        kind: "error",
        error: {
          title: `“${result.file.fileName}” can't be opened`,
          message: parsed.error.path
            ? `${parsed.error.message} (at ${parsed.error.path})`
            : parsed.error.message,
        },
      });
      return false;
    }
    return requestSwitch({
      kind: "open-file",
      file: result.file,
      project: parsed.project,
    });
  }

  return {
    commands,
    hasUnsavedChanges,
    isDesktop: desktop !== null,

    newProject: () => requestSwitch({ kind: "new" }),

    showLibrary() {
      ui().setLibraryOpen(true);
      void commands.refreshLibrary();
    },

    openProject: (id: string) => requestSwitch({ kind: "open", id }),

    /** Desktop: the native Open dialog. */
    async openFile(): Promise<boolean> {
      if (!desktop) return false;
      return openDesktopResult(await desktop.openProjectFile());
    },

    /** Desktop: the next file from Explorer, the command line or a second launch. */
    async openPendingFile(): Promise<boolean> {
      if (!desktop) return false;
      return openDesktopResult(await desktop.takePendingProjectFile());
    },

    async save(): Promise<boolean> {
      const location = session().location;
      if (location.kind === "unsaved" && !desktop) {
        ui().showDialog({ kind: "name", purpose: "first-save" });
        return false;
      }
      return report(await saveInPlace());
    },

    async saveAs(): Promise<boolean> {
      if (desktop) return report(await commands.saveToFile({ saveAs: true }));
      ui().showDialog({ kind: "name", purpose: "save-as" });
      return false;
    },

    rename() {
      ui().showDialog({ kind: "name", purpose: "rename" });
    },

    /** `name` has already passed normalizeProjectName. */
    async submitName(
      purpose: ProjectNamePurpose,
      name: string,
    ): Promise<boolean> {
      ui().closeDialog();
      if (purpose === "rename") {
        session().renameProject(name);
        return true;
      }
      return report(
        purpose === "save-as"
          ? await commands.saveAs(name)
          : await commands.save({ name }),
      );
    },

    download: () => report(commands.download()),

    /** Validates a chosen file, then imports it (resolving an id collision first). */
    async importFile(file: Blob): Promise<boolean> {
      const loaded = await loadProjectFromFile(file);
      if (!loaded.ok) {
        ui().showDialog({
          kind: "error",
          error: {
            title: "This file can't be imported",
            message: loaded.error.path
              ? `${loaded.error.message} (at ${loaded.error.path})`
              : loaded.error.message,
          },
        });
        return false;
      }
      const lookup = await commands.findInLibrary(loaded.project.metadata.id);
      if (!lookup.ok) return report(lookup);
      if (lookup.existing) {
        ui().showDialog({
          kind: "import-collision",
          project: loaded.project,
          existing: lookup.existing,
        });
        return false;
      }
      return requestSwitch({
        kind: "import",
        project: loaded.project,
        mode: "keep-id",
      });
    },

    resolveImportCollision(
      mode: Exclude<ImportMode, "keep-id">,
    ): Promise<boolean> {
      const dialog = ui().dialog;
      if (dialog?.kind !== "import-collision") return Promise.resolve(false);
      ui().closeDialog();
      return requestSwitch({ kind: "import", project: dialog.project, mode });
    },

    /**
     * Answers the unsaved-changes prompt. "save" saves in place first and
     * continues only if that save succeeded (a cancelled Save dialog, a
     * conflict or an error all stop here, keeping the project open).
     */
    async resolveDiscard(choice: "save" | "discard"): Promise<boolean> {
      const dialog = ui().dialog;
      if (dialog?.kind !== "discard") return false;
      ui().closeDialog();
      if (choice === "save" && !report(await saveInPlace())) {
        releaseSwitch(dialog.pending);
        return false;
      }
      return runSwitch(dialog.pending);
    },

    /** Cancel on the unsaved-changes prompt: nothing changes, the window stays open. */
    cancelDiscard() {
      const dialog = ui().dialog;
      if (dialog?.kind !== "discard") return;
      ui().closeDialog();
      releaseSwitch(dialog.pending);
    },

    /**
     * The file changed or vanished outside Layoutry. "overwrite" replaces
     * it with this version after the user's explicit confirmation;
     * "save-as" keeps both.
     */
    async resolveFileConflict(
      choice: "overwrite" | "save-as",
    ): Promise<boolean> {
      if (ui().dialog?.kind !== "file-conflict") return false;
      ui().closeDialog();
      if (choice === "overwrite")
        return report(await commands.saveToFile({ force: true }));
      return report(await commands.saveToFile({ saveAs: true }));
    },

    /**
     * Desktop: the window is closing. Waits for any save in flight, then
     * closes at once if everything is saved, otherwise asks.
     */
    async requestClose(): Promise<void> {
      if (!desktop) return;
      await commands.whenIdle();
      const dialog = ui().dialog;
      if (dialog?.kind === "discard" && dialog.pending.kind === "close") return;
      if (!hasUnsavedChanges()) {
        desktop.respondToCloseRequest(true);
        return;
      }
      await requestSwitch({ kind: "close" });
    },

    requestDelete(id: string, name: string | null) {
      ui().showDialog({ kind: "delete", id, name });
    },

    async confirmDelete(): Promise<boolean> {
      const dialog = ui().dialog;
      if (dialog?.kind !== "delete") return false;
      ui().closeDialog();
      return report(await commands.remove(dialog.id, dialog.name ?? undefined));
    },
  };
}

export type ProjectWorkflow = ReturnType<typeof createProjectWorkflow>;
