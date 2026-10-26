import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type {
  ImportMode,
  ProjectCommandResult,
  ProjectCommands,
} from "@/features/project/commands/projectCommands";
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

/**
 * The user-facing project flows (PROJECT-1.2): when to confirm, which
 * dialog comes next, and how results are reported. Menus, shortcuts and
 * dialogs call these; the commands they drive contain no UI.
 *
 * Every action that replaces the active project (New, Open, Import) asks
 * first when there are unsaved changes — document edits or a rename —
 * and offers to save them.
 */
export function createProjectWorkflow(commands: ProjectCommands) {
  const ui = () => useProjectDialogStore.getState();
  const session = () => useProjectStore.getState();

  function hasUnsavedChanges(): boolean {
    return selectHasUnsavedProjectChanges(session(), useEditorStore.getState());
  }

  function report(result: ProjectCommandResult): boolean {
    if (!result.ok) ui().showDialog({ kind: "error", error: result.error });
    return result.ok;
  }

  async function runSwitch(pending: ProjectSwitch): Promise<boolean> {
    const result =
      pending.kind === "new"
        ? await commands.newProject()
        : pending.kind === "open"
          ? await commands.open(pending.id)
          : await commands.importProject(pending.project, pending.mode);
    if (result.ok) ui().setLibraryOpen(false);
    return report(result);
  }

  function requestSwitch(pending: ProjectSwitch): Promise<boolean> {
    if (hasUnsavedChanges()) {
      ui().showDialog({ kind: "discard", pending });
      return Promise.resolve(false);
    }
    return runSwitch(pending);
  }

  return {
    commands,
    hasUnsavedChanges,

    newProject: () => requestSwitch({ kind: "new" }),

    showLibrary() {
      ui().setLibraryOpen(true);
      void commands.refreshLibrary();
    },

    openProject: (id: string) => requestSwitch({ kind: "open", id }),

    /** Saves in place; a project that isn't in the library is named first. */
    async save(): Promise<boolean> {
      if (session().libraryRevision === null) {
        ui().showDialog({ kind: "name", purpose: "first-save" });
        return false;
      }
      return report(await commands.save());
    },

    saveAs() {
      ui().showDialog({ kind: "name", purpose: "save-as" });
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
     * Answers the unsaved-changes prompt. "save" saves first (in place, with
     * the current name) and continues only if that save succeeded.
     */
    async resolveDiscard(choice: "save" | "discard"): Promise<boolean> {
      const dialog = ui().dialog;
      if (dialog?.kind !== "discard") return false;
      ui().closeDialog();
      if (choice === "save" && !report(await commands.save())) return false;
      return runSwitch(dialog.pending);
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
