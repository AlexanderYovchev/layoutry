"use client";

import { useContext } from "react";
import { canActivateInteractions } from "@/features/editor/rules/accessibilityAttributes";
import { InteractionTargetsContext } from "@/features/canvas/components/document/previewRuntimeContext";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";
import { getInteractions } from "@/features/editor/types/interactions";
import { findNodeById, findParentId } from "@/features/editor/utils/findNodeById";
import { EXPANDABLE_CONTROL_TAGS, resolveTriggerAccessibility } from "@/features/editor/utils/triggerAccessibility";

export interface PreviewTriggerAria {
  "aria-controls"?: string;
  "aria-expanded"?: "true" | "false";
  "aria-haspopup"?: "dialog";
}

/**
 * The ARIA state a button or link trigger exposes in Preview (BC-02.5,
 * B6; aria-controls since BC-02.5.1), the same state and relationships the
 * exported page has:
 * - aria-controls lists the ids of the targets it acts on, which are the
 *   same ids the export writes (resolveInteractionTargets). Hidden targets
 *   stay mounted, so the ids always exist in the DOM;
 * - aria-expanded mirrors the first toggled target's current runtime
 *   visibility;
 * - aria-haspopup="dialog" marks a trigger that opens a dialog.
 * The rules come from resolveTriggerAccessibility and
 * resolveInteractionTargets, which the export uses too. Design gets
 * nothing: these describe runtime state, and Design has none. Each store
 * selector returns a primitive, so a trigger re-renders only when its own
 * state changes.
 */
export function usePreviewTriggerAria(node: EditorElementNode): PreviewTriggerAria {
  // A control that can't activate (disabled, or a Pagination current page)
  // controls nothing (BC-09.2.1, BC-09.3), as on the exported page.
  const hasBindings = EXPANDABLE_CONTROL_TAGS.has(node.tag) && getInteractions(node).length > 0;
  const activatable = useEditorStore((state) => {
    if (!hasBindings) return false;
    const parentId = findParentId(state.document, node.id);
    return canActivateInteractions(node, parentId ? findNodeById(state.document, parentId) : undefined);
  });
  const applies = hasBindings && activatable;
  const targets = useContext(InteractionTargetsContext);
  const isPreview = useEditorStore((state) => state.editorMode === "preview");
  const expanded = useEditorStore((state) => {
    if (!applies || state.editorMode !== "preview") return undefined;
    const { expandsTargetId } = resolveTriggerAccessibility(getInteractions(node), (nodeId) => findNodeById(state.document, nodeId));
    if (expandsTargetId === undefined) return undefined;
    return state.runtimeVisibility[expandsTargetId] === false ? "false" : "true";
  });
  const opensDialog = useEditorStore((state) => applies && state.editorMode === "preview" && resolveTriggerAccessibility(getInteractions(node), (nodeId) => findNodeById(state.document, nodeId)).opensDialog);
  const controls = applies && isPreview ? [...new Set(getInteractions(node).map((binding) => targets.get(binding.targetId)?.domId).filter((id): id is string => id !== undefined))].join(" ") : "";
  return {
    ...(controls !== "" ? { "aria-controls": controls } : {}),
    ...(expanded !== undefined ? { "aria-expanded": expanded } : {}),
    ...(opensDialog ? { "aria-haspopup": "dialog" } : {}),
  };
}
