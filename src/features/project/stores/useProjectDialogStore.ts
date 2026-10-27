import { create } from "zustand";
import type {
  FileConflict,
  ImportMode,
  ProjectCommandError,
} from "@/features/project/commands/projectCommands";
import type { DesktopOpenedFile } from "@/features/project/desktop/desktopProjectFiles";
import type { ProjectLocation } from "@/features/project/stores/useProjectStore";
import type {
  LayoutryProject,
  ProjectMetadata,
} from "@/features/project/types/projectFile";
import type { RecoveryGroup } from "@/features/project/types/recoveryRecord";

/**
 * An action that replaces the active project — or, in the desktop app,
 * closes the window — held while the user confirms.
 */
export type ProjectSwitch =
  | { kind: "new" }
  | { kind: "open"; id: string }
  | { kind: "import"; project: LayoutryProject; mode: ImportMode }
  | { kind: "open-file"; file: DesktopOpenedFile; project: LayoutryProject }
  /** PROJECT-1.4: recovered work, validated, and the groups still on offer. */
  | {
      kind: "restore";
      project: LayoutryProject;
      location: ProjectLocation;
      group: RecoveryGroup;
      others: RecoveryGroup[];
    }
  | { kind: "close" };

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
  | { kind: "file-conflict"; conflict: FileConflict }
  /**
   * PROJECT-1.4: recovered work of ended sessions. Updated in place (never
   * closed and reopened) while a restore or discard runs.
   */
  | {
      kind: "recovery";
      groups: RecoveryGroup[];
      error: { groupKey: string; message: string } | null;
      busy: boolean;
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
