import { generateNodeId } from "@/features/editor/utils/generateNodeId";
import { getInteractions, withInteractions, type InteractionAction, type InteractionBinding } from "@/features/editor/types/interactions";
import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * Interaction binding CRUD (Checkpoint 1.15.6.8) — the same immutable,
 * structural-sharing shape every other command in this directory already
 * uses (see documentCommands.ts's own top comment): each function walks
 * the tree once, rebuilds only the path that actually changed, and
 * returns the SAME root reference back for a genuine no-op (missing
 * node, missing binding, or an update that changes nothing) so the store
 * layer's own `document === state.document` check can skip pushing a
 * history entry for it, exactly like setElementText/setElementHref
 * already do.
 *
 * Deliberately its OWN small file, not folded into documentCommands.ts —
 * this is a new, self-contained concern (the first node-to-node reference
 * this document model has ever had) with its own cleanup/remap rules,
 * not a variation on an existing per-field setter.
 */

function updateNode(root: EditorElementNode, nodeId: string, updater: (node: EditorElementNode) => EditorElementNode): EditorElementNode {
  if (root.id === nodeId) return updater(root);
  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = updateNode(child, nodeId, updater);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

/**
 * Adds one new binding to `nodeId` (Checkpoint 1.15.6.8, Part G/section
 * 31) — always a fresh id (generateNodeId's own convention, applied to
 * this new document concept exactly like every EditorElementNode already
 * uses it), appended after any existing bindings on that node. A no-op
 * (same root returned) if `nodeId` doesn't resolve.
 */
export function addInteraction(
  root: EditorElementNode,
  nodeId: string,
  binding: { trigger: "click"; action: InteractionAction; targetId: string },
): EditorElementNode {
  return updateNode(root, nodeId, (node) => {
    const next: InteractionBinding = { id: generateNodeId("interaction"), ...binding };
    return { ...node, interactions: [...getInteractions(node), next] };
  });
}

/**
 * Patches one existing binding's action and/or target (section 32) — a
 * true no-op (same node, same root) when the patch changes nothing, so an
 * Inspector control re-committing its own current value never pushes a
 * spurious history entry, matching every other Inspector field's own
 * no-op convention in this codebase.
 */
export function updateInteraction(
  root: EditorElementNode,
  nodeId: string,
  interactionId: string,
  patch: Partial<Pick<InteractionBinding, "action" | "targetId">>,
): EditorElementNode {
  return updateNode(root, nodeId, (node) => {
    const current = getInteractions(node);
    let changed = false;
    const next = current.map((binding) => {
      if (binding.id !== interactionId) return binding;
      const updated = { ...binding, ...patch };
      if (updated.action === binding.action && updated.targetId === binding.targetId) return binding;
      changed = true;
      return updated;
    });
    return changed ? { ...node, interactions: next } : node;
  });
}

/** Removes one binding by its own id (section 33) — a no-op if it's already gone. Collapses back to `undefined` once the node has no bindings left (withInteractions), never a stray `interactions: []`. */
export function removeInteraction(root: EditorElementNode, nodeId: string, interactionId: string): EditorElementNode {
  return updateNode(root, nodeId, (node) => {
    const current = getInteractions(node);
    const next = current.filter((binding) => binding.id !== interactionId);
    if (next.length === current.length) return node;
    return { ...node, interactions: withInteractions(next) };
  });
}

/**
 * Strips every binding anywhere in the tree whose `targetId` falls inside
 * `deletedIds` (Checkpoint 1.15.6.8, Part H) — the automatic cleanup the
 * 1.15.6.7 audit recommended over either leaving a broken reference or
 * blocking the deletion. Callers (deleteSelection/cutSelection) run this
 * against the document AFTER removing the node(s), in the same immutable
 * pass, before the single pushHistory call — so "delete Target B" and
 * "clean up every binding that pointed at it" are always one atomic
 * document mutation and one history entry, never two (Undo restores
 * both the node and the binding together for free, since it's one
 * snapshot). A single-pass tree walk, not one pass per deleted id.
 */
export function removeInteractionsTargeting(root: EditorElementNode, deletedIds: ReadonlySet<string>): EditorElementNode {
  if (deletedIds.size === 0) return root;

  let nextChildren = root.children;
  if (root.children) {
    let childrenChanged = false;
    const mapped = root.children.map((child) => {
      const updatedChild = removeInteractionsTargeting(child, deletedIds);
      if (updatedChild !== child) childrenChanged = true;
      return updatedChild;
    });
    if (childrenChanged) nextChildren = mapped;
  }

  const current = getInteractions(root);
  const filtered = current.filter((binding) => !deletedIds.has(binding.targetId));
  const interactionsChanged = filtered.length !== current.length;

  if (!interactionsChanged) {
    return nextChildren !== root.children ? { ...root, children: nextChildren } : root;
  }

  return { ...root, children: nextChildren, interactions: withInteractions(filtered) };
}

/**
 * Rewrites every INTERNAL target reference inside a cloned subtree
 * (Checkpoint 1.15.6.8, Part I) using the old-id -> new-id map
 * cloneNodeWithFreshIds builds while cloning — an EXTERNAL target (one
 * whose old id never appears in the map, because it lived outside the
 * cloned subtree) is left completely untouched, matching the approved
 * audit's rule: "Original Button -> External Target" stays pointed at
 * that same external target after duplication, never silently retargeted
 * or cleared just because it wasn't cloned alongside it.
 */
export function remapInteractionTargets(node: EditorElementNode, idMap: ReadonlyMap<string, string>): EditorElementNode {
  const children = node.children?.map((child) => remapInteractionTargets(child, idMap));
  const childrenChanged = children ? children.some((child, index) => child !== node.children![index]) : false;

  const current = getInteractions(node);
  let interactionsChanged = false;
  const nextInteractions = current.map((binding) => {
    const remapped = idMap.get(binding.targetId);
    if (!remapped || remapped === binding.targetId) return binding;
    interactionsChanged = true;
    return { ...binding, targetId: remapped };
  });

  if (!childrenChanged && !interactionsChanged) return node;
  return {
    ...node,
    children: childrenChanged ? children : node.children,
    interactions: interactionsChanged ? nextInteractions : node.interactions,
  };
}
