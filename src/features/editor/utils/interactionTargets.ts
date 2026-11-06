import type { EditorElementNode } from "@/features/editor/types/document";
import { getInteractions } from "@/features/editor/types/interactions";
import { getInitialPreviewVisibility } from "@/features/editor/types/previewVisibility";

/**
 * A node whose visibility an interaction can change, with the id
 * assistive technology references it by (aria-controls).
 */
export interface InteractionTarget {
  /** Document-order integer, starting at 1. */
  token: number;
  nodeId: string;
  /** A native <dialog> opens modally when shown; anything else is hidden or shown. */
  kind: "element" | "dialog";
  /** Visible when the page loads (the authored initial visibility). */
  initiallyVisible: boolean;
  /**
   * The authored id when it is valid and unique, otherwise a generated
   * `ly-target-<token>`. Absent when an authored id exists but is
   * duplicated: it cannot be referenced reliably, nor replaced.
   */
  domId?: string;
  /** True when `domId` was generated and must be written onto the element. */
  generatedDomId: boolean;
}

/** The authored-id rule (export's identity()): non-empty, no whitespace, not the reserved `ly-` prefix. */
export function isUsableAuthoredId(htmlId: string | undefined): htmlId is string {
  return htmlId !== undefined && htmlId !== "" && !/\s/.test(htmlId) && !htmlId.startsWith("ly-");
}

/** Every node in document (pre-)order. */
export function documentPreOrder(document: EditorElementNode): EditorElementNode[] {
  const nodes: EditorElementNode[] = [];
  const stack = [document];
  for (let node = stack.pop(); node; node = stack.pop()) {
    nodes.push(node);
    if (node.children) for (let index = node.children.length - 1; index >= 0; index--) stack.push(node.children[index]);
  }
  return nodes;
}

/**
 * Every interaction target of a document, in document order (BC-02.5.1,
 * moved here from the export's buildExportBehaviors unchanged). Preview
 * and the HTML export both read it, so a trigger's aria-controls names
 * the same element with the same id in both. A target is every node a
 * binding points at, plus every dialog that is open when the page loads
 * (it opens modally even without a binding). The result depends only on
 * the document, so ids are stable across renders and state changes, and
 * unique: generated ids use the reserved `ly-` prefix, which authored
 * ids may not use.
 */
export function resolveInteractionTargets(document: EditorElementNode): InteractionTarget[] {
  const nodes = documentPreOrder(document);
  const nodeIds = new Set(nodes.map((node) => node.id));
  const idCounts = new Map<string, number>();
  for (const node of nodes) if (isUsableAuthoredId(node.htmlId)) idCounts.set(node.htmlId, (idCounts.get(node.htmlId) ?? 0) + 1);

  const targetIds = new Set<string>();
  for (const node of nodes) {
    for (const binding of getInteractions(node)) if (nodeIds.has(binding.targetId)) targetIds.add(binding.targetId);
    if (node.tag === "dialog" && getInitialPreviewVisibility(node) !== "hidden") targetIds.add(node.id);
  }

  const targets: InteractionTarget[] = [];
  for (const node of nodes) {
    if (!targetIds.has(node.id)) continue;
    const token = targets.length + 1;
    const authoredIdUsable = isUsableAuthoredId(node.htmlId) && idCounts.get(node.htmlId) === 1;
    const hasDuplicatedAuthoredId = isUsableAuthoredId(node.htmlId) && !authoredIdUsable;
    targets.push({
      token,
      nodeId: node.id,
      kind: node.tag === "dialog" ? "dialog" : "element",
      initiallyVisible: getInitialPreviewVisibility(node) !== "hidden",
      ...(authoredIdUsable ? { domId: node.htmlId } : hasDuplicatedAuthoredId ? {} : { domId: `ly-target-${token}` }),
      generatedDomId: !authoredIdUsable && !hasDuplicatedAuthoredId,
    });
  }
  return targets;
}
