"use client";

import {
  selectHasUnsavedChanges,
  useEditorStore,
} from "@/features/editor/stores/useEditorStore";
import { useProjectStore } from "@/features/project/stores/useProjectStore";

/**
 * Reactive form of selectHasUnsavedProjectChanges: the document differs
 * from its saved baseline, or the project was renamed since it was saved.
 * Selection, hover, Preview and panel changes never affect it.
 */
export function useHasUnsavedProjectChanges(): boolean {
  const documentChanged = useEditorStore(selectHasUnsavedChanges);
  const nameChanged = useProjectStore(
    (project) => project.savedName !== project.metadata.name,
  );
  return documentChanged || nameChanged;
}
