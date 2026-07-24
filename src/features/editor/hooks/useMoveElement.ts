import { isValidMoveTarget } from "@/features/editor/rules/moveValidationRules";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { DropZone } from "@/features/editor/utils/resolveDropZone";

/**
 * The move counterpart to useInsertElement — the single pipeline both
 * Canvas move drags call through. Validity is checked here too (not
 * just inside moveNode) so a rejected move never even reaches the store,
 * keeping this hook's contract explicit: calling it with an invalid
 * request is always a safe no-op, never a silent partial mutation.
 */
export function useMoveElement() {
  const documentModel = useEditorStore((state) => state.document);
  const moveElement = useEditorStore((state) => state.moveElement);

  return function move(nodeId: string, targetId: string, zone: DropZone) {
    if (!isValidMoveTarget(documentModel, nodeId, targetId, zone)) return;
    moveElement(nodeId, targetId, zone);
  };
}
