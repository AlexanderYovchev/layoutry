"use client";

import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";
import { getInteractions } from "@/features/editor/types/interactions";
import { findNodeById } from "@/features/editor/utils/findNodeById";
import { EXPANDABLE_CONTROL_TAGS, resolveTriggerAccessibility } from "@/features/editor/utils/triggerAccessibility";

export interface PreviewTriggerAria {
  "aria-expanded"?: "true" | "false";
  "aria-haspopup"?: "dialog";
}

/**
 * The ARIA state a button or link trigger exposes in Preview (BC-02.5,
 * B6), the same state the exported page's runtime keeps:
 * - aria-expanded mirrors the first toggled target's current runtime
 *   visibility;
 * - aria-haspopup="dialog" marks a trigger that opens a dialog.
 * The rules come from resolveTriggerAccessibility, which the export uses
 * too. Design gets nothing: these describe runtime state, and Design has
 * none. Each selector returns a primitive, so a trigger re-renders only
 * when its own state changes.
 */
export function usePreviewTriggerAria(node: EditorElementNode): PreviewTriggerAria {
  const applies = EXPANDABLE_CONTROL_TAGS.has(node.tag) && getInteractions(node).length > 0;
  const expanded = useEditorStore((state) => {
    if (!applies || state.editorMode !== "preview") return undefined;
    const { expandsTargetId } = resolveTriggerAccessibility(getInteractions(node), (nodeId) => findNodeById(state.document, nodeId));
    if (expandsTargetId === undefined) return undefined;
    return state.runtimeVisibility[expandsTargetId] === false ? "false" : "true";
  });
  const opensDialog = useEditorStore((state) => applies && state.editorMode === "preview" && resolveTriggerAccessibility(getInteractions(node), (nodeId) => findNodeById(state.document, nodeId)).opensDialog);
  return {
    ...(expanded !== undefined ? { "aria-expanded": expanded } : {}),
    ...(opensDialog ? { "aria-haspopup": "dialog" } : {}),
  };
}
