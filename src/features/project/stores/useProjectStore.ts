import { create } from "zustand";
import {
  selectHasUnsavedChanges,
  type useEditorStore,
} from "@/features/editor/stores/useEditorStore";
import type { ProjectLibraryEntry } from "@/features/project/storage/projectRepository";
import type { ProjectMetadata } from "@/features/project/types/projectFile";
import { createProjectMetadata } from "@/features/project/utils/serializeProject";

export type ProjectOperation =
  "save" | "save-as" | "open" | "import" | "delete";

export interface ProjectToast {
  /** Increments per toast so the same message twice still re-announces. */
  id: number;
  message: string;
}

export interface ProjectLibraryState {
  status: "idle" | "loading" | "ready" | "error";
  entries: ProjectLibraryEntry[];
  /** User-facing reason when `status` is "error". */
  error: string | null;
}

/**
 * The active project's session (PROJECT-1.2): its identity and the saved
 * baseline for metadata, kept apart from the editor store, which owns only
 * the authored document and its own saved baseline (`persistedDocument`).
 */
export interface ProjectSessionState {
  /** The active project. A rename lands here immediately. */
  metadata: ProjectMetadata;
  /**
   * The name at the last successful save, open or import — the metadata
   * baseline. `null` means nothing stored matches this project any more
   * (its library record was deleted), so it counts as unsaved.
   */
  savedName: string | null;
  /**
   * `updatedAt` of the library record this session last wrote or opened;
   * `null` while the project isn't in the library (a new project). Saves
   * use it to detect another tab's newer save.
   */
  libraryRevision: string | null;
  /** The library operation in flight, if any. */
  operation: ProjectOperation | null;
  library: ProjectLibraryState;
  toast: ProjectToast | null;

  /** Makes `metadata` the active project, clean, after New / Open / Import / Save As. */
  activateProject: (
    metadata: ProjectMetadata,
    libraryRevision: string | null,
  ) => void;
  renameProject: (name: string) => void;
  /**
   * Records a successful write of `saved`, built from the `snapshot`
   * metadata read when the save started. A rename made while the write was
   * in flight is kept and stays unsaved. Ignored if another project has
   * become active since.
   */
  recordSave: (snapshot: ProjectMetadata, saved: ProjectMetadata) => void;
  /** The active project's library record was deleted: it is unsaved again. */
  detachFromLibrary: () => void;
  setOperation: (operation: ProjectOperation | null) => void;
  setLibrary: (library: ProjectLibraryState) => void;
  showToast: (message: string) => void;
  dismissToast: () => void;
}

// The startup project is new and untouched: its name is its own baseline.
const initialMetadata = createProjectMetadata();

export const useProjectStore = create<ProjectSessionState>()((set) => ({
  metadata: initialMetadata,
  savedName: initialMetadata.name,
  libraryRevision: null,
  operation: null,
  library: { status: "idle", entries: [], error: null },
  toast: null,

  activateProject: (metadata, libraryRevision) =>
    set({ metadata, savedName: metadata.name, libraryRevision }),
  renameProject: (name) =>
    set((state) =>
      state.metadata.name === name
        ? state
        : { metadata: { ...state.metadata, name } },
    ),
  recordSave: (snapshot, saved) =>
    set((state) =>
      state.metadata.id !== snapshot.id
        ? state
        : {
            metadata:
              state.metadata === snapshot
                ? saved
                : { ...state.metadata, updatedAt: saved.updatedAt },
            savedName: saved.name,
            libraryRevision: saved.updatedAt,
          },
    ),
  detachFromLibrary: () => set({ savedName: null, libraryRevision: null }),
  setOperation: (operation) => set({ operation }),
  setLibrary: (library) => set({ library }),
  showToast: (message) =>
    set((state) => ({ toast: { id: (state.toast?.id ?? 0) + 1, message } })),
  dismissToast: () => set({ toast: null }),
}));

type EditorStateSnapshot = ReturnType<typeof useEditorStore.getState>;

/** True when the document or the project name differs from what was last saved. */
export function selectHasUnsavedProjectChanges(
  project: Pick<ProjectSessionState, "metadata" | "savedName">,
  editor: Pick<EditorStateSnapshot, "document" | "persistedDocument">,
): boolean {
  return (
    selectHasUnsavedChanges(editor) ||
    project.savedName !== project.metadata.name
  );
}
