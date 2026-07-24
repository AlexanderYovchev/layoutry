import { canContainChildren } from "@/features/editor/rules/insertionRules";
import { isValidMoveTarget } from "@/features/editor/rules/moveValidationRules";
import { findNodeById } from "@/features/editor/utils/findNodeById";
import {
  computeDraggedCenterY,
  resolveDropZone,
  type DropZone,
} from "@/features/editor/utils/resolveDropZone";
import type { EditorElementNode } from "@/features/editor/types/document";

export interface ActiveDropIndicator {
  targetId: string;
  zone: DropZone;
}

interface RectLike {
  top: number;
  height: number;
}

interface ActiveLike {
  data: { current?: Record<string, unknown> };
  rect: { current: { translated: RectLike | null } };
}

interface OverLike {
  id: string | number;
  rect: RectLike;
}

/**
 * The one place "what should the Canvas show as a drop indicator right
 * now" is decided — a pure function wrapped by useActiveDropIndicator so
 * this logic is unit-testable without a real drag. Used for both catalog
 * inserts and existing-node moves; for moves specifically, the result is
 * also checked against isValidMoveTarget so an indicator never appears
 * for a target that would just be rejected on drop (self-descendant,
 * the document root, "inside" a leaf).
 */
export function resolveActiveDropIndicator(
  active: ActiveLike | null,
  over: OverLike | null,
  documentModel: EditorElementNode,
): ActiveDropIndicator | null {
  if (!active?.rect.current.translated || !over) return null;

  const targetId = String(over.id);
  const targetNode = findNodeById(documentModel, targetId);
  if (!targetNode) return null;

  const zone = resolveDropZone(
    over.rect,
    computeDraggedCenterY(active.rect.current.translated),
    canContainChildren(targetNode.tag),
  );

  const dragData = active.data.current;
  if (dragData?.kind === "move" && typeof dragData.nodeId === "string") {
    if (!isValidMoveTarget(documentModel, dragData.nodeId, targetId, zone)) {
      return null;
    }
  }

  return { targetId, zone };
}
