import { findNodeById } from "@/features/editor/utils/findNodeById";
import { getInteractions } from "@/features/editor/types/interactions";
import { getInitialPreviewVisibility } from "@/features/editor/types/previewVisibility";
import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * One currently-open, dismissible trigger->target relationship
 * (Checkpoint 1.15.6.8.3) — derived at read time, never stored. There is
 * no `overlayOwnerId`/`activeOverlayId`/persistent dismissal metadata
 * anywhere; this is the entire "registry," recomputed from the three
 * pieces of state that already exist (the document's own authored
 * `interactions`/`initialPreviewVisibility`, and the store's ephemeral
 * `runtimeVisibility`) every time a dismissal decision is needed.
 */
export interface DismissibleRelationship {
  triggerId: string;
  targetId: string;
  bindingId: string;
}

/**
 * The V1 dismissibility signature (Checkpoint 1.15.6.8.2's own approved
 * rule, section 9): a relationship qualifies for generic outside-click/
 * Escape dismissal only when ALL of the following hold —
 *
 *   1. trigger is "click" and action is "toggle" (not "show"/"hide" —
 *      section 40's own explicit "toggle-class only" restriction; a V1
 *      `show` target is deliberately NOT made dismissible, since nothing
 *      about a one-way reveal implies "and also closable by clicking
 *      elsewhere").
 *   2. the target's own AUTHORED `initialPreviewVisibility` is "hidden" —
 *      this is what excludes Collapsible entirely (section 8/37): its
 *      content never sets this field, so it can never appear in this
 *      list, no matter how many times its own toggle fires. A generic
 *      node with `initialPreviewVisibility: "hidden"` driven by a `show`
 *      binding is ALSO excluded by rule 1 above, not this rule alone —
 *      both conditions must hold together.
 *   3. the target is CURRENTLY open (`runtimeVisibility[targetId] ===
 *      true`) — a closed Dropdown has nothing to dismiss.
 *
 * A single document traversal (mirroring buildInitialRuntimeVisibility's
 * own "one pass, not a rescan per event" precedent in useEditorStore) —
 * called fresh on every pointerdown/Escape rather than cached, since the
 * document is small and this must always reflect the CURRENT
 * runtimeVisibility, which changes on every toggle.
 */
export function findDismissibleRelationships(
  document: EditorElementNode,
  runtimeVisibility: Record<string, boolean>,
): DismissibleRelationship[] {
  const relationships: DismissibleRelationship[] = [];

  function visit(node: EditorElementNode) {
    for (const binding of getInteractions(node)) {
      if (binding.trigger !== "click" || binding.action !== "toggle") continue;
      if (runtimeVisibility[binding.targetId] !== true) continue;

      const target = findNodeById(document, binding.targetId);
      if (!target) continue;
      if (getInitialPreviewVisibility(target) !== "hidden") continue;

      relationships.push({ triggerId: node.id, targetId: binding.targetId, bindingId: binding.id });
    }
    node.children?.forEach(visit);
  }

  visit(document);
  return relationships;
}
