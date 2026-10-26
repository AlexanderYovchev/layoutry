import { create } from "zustand";
import type {
  ImportMode,
  ProjectCommandError,
} from "@/features/project/commands/projectCommands";
import type {
  LayoutryProject,
  ProjectMetadata,
} from "@/features/project/types/projectFile";

/** An action that replaces the active project, held while the user confirms. */
export type ProjectSwitch =
  | { kind: "new" }
  | { kind: "open"; id: string }
  | { kind: "import"; project: LayoutryProject; mode: ImportMode };

export type ProjectNamePurpose = "first-save" | "save-as" | "rename";

/** The modal on top. The library dialog can sit underneath it. */
export type ProjectDialog =
  | { kind: "name"; purpose: ProjectNamePurpose }
  | { kind: "discard"; pending: ProjectSwitch }
  | { kind: "delete"; id: string; name: string | null }
  | {
      kind: "import-collision";
      project: LayoutryProject;
      existing: ProjectMetadata;
    }
  | { kind: "error"; error: ProjectCommandError };

interface ProjectDialogState {
  libraryOpen: boolean;
  dialog: ProjectDialog | null;
  setLibraryOpen: (open: boolean) => void;
  showDialog: (dialog: ProjectDialog) => void;
  closeDialog: () => void;
  /**
   * Closes the top dialog only if it is still of `kind`. A native <dialog>
   * reports its own closing asynchronously, by which time a dialog of
   * another kind may already have replaced it.
   */
  closeDialogOfKind: (kind: ProjectDialog["kind"]) => void;
}

/** Which project dialogs are open (PROJECT-1.2). UI state only, never persisted. */
export const useProjectDialogStore = create<ProjectDialogState>()((set) => ({
  libraryOpen: false,
  dialog: null,
  setLibraryOpen: (libraryOpen) => set({ libraryOpen }),
  showDialog: (dialog) => set({ dialog }),
  closeDialog: () => set({ dialog: null }),
  closeDialogOfKind: (kind) =>
    set((state) => (state.dialog?.kind === kind ? { dialog: null } : state)),
}));
