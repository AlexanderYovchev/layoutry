import type { DismissibleRelationship } from "@/features/editor/utils/dismissibleTargets";

/**
 * Whether `eventTarget` falls inside a relationship's own logical region
 * (Checkpoint 1.15.6.8.3, Part B/section 5) — the UNION of the trigger's
 * own DOM subtree and the target's own DOM subtree, since trigger and
 * target are ordinary SIBLING EditorElementNodes (e.g. the Dropdown
 * Button and its menu Container), not parent/child — plain DOM
 * containment of the trigger alone would be insufficient.
 *
 * Deliberately takes already-resolved elements rather than ids/a document
 * query, so this stays a pure, easily unit-testable function against
 * plain jsdom elements — the caller (CanvasInteractionBoundary) owns
 * resolving `[data-node-id]` to a real Element via the DOM, the one
 * place this app already has that lookup convention.
 */
export function isEventInsideRelationshipRegion(
  eventTarget: Element,
  triggerElement: Element | null,
  targetElement: Element | null,
): boolean {
  return Boolean(triggerElement?.contains(eventTarget)) || Boolean(targetElement?.contains(eventTarget));
}

/**
 * Resolves both of a relationship's own elements from the live DOM via
 * the existing `data-node-id` convention (documentNodeAttributes) — no
 * second identity mechanism. Returns null for either side that isn't
 * currently rendered (already-deleted node, or a target the runtime
 * override is hiding — see DocumentNodeRenderer), which
 * isEventInsideRelationshipRegion already treats safely as "not inside."
 */
export function resolveRelationshipElements(
  root: ParentNode,
  relationship: DismissibleRelationship,
): { triggerElement: Element | null; targetElement: Element | null } {
  return {
    triggerElement: root.querySelector(`[data-node-id="${CSS.escape(relationship.triggerId)}"]`),
    targetElement: root.querySelector(`[data-node-id="${CSS.escape(relationship.targetId)}"]`),
  };
}
