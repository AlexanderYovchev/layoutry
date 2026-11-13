import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * Whether the node is hidden by authored CSS (BC-08.3): its own or an
 * ancestor's Display is "none", or the nearest authored Visibility on the
 * way down to it is "hidden" (CSS visibility inherits, and a descendant's
 * own "visible" overrides it). Interaction-driven hiding is separate
 * (RuntimeHiddenContext / isRuntimeHidden). Undefined when the node is not
 * in the document.
 */
export function isNodeAuthoredHidden(root: EditorElementNode, nodeId: string): boolean | undefined {
  function visit(node: EditorElementNode, displayNone: boolean, visibilityHidden: boolean): boolean | undefined {
    const none = displayNone || node.display?.display === "none";
    const hidden = node.display?.visibility === undefined ? visibilityHidden : node.display.visibility === "hidden";
    if (node.id === nodeId) return none || hidden;
    for (const child of node.children ?? []) {
      const found = visit(child, none, hidden);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  return visit(root, false, false);
}
