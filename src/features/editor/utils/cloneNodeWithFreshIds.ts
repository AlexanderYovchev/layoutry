import { generateNodeId } from "@/features/editor/utils/generateNodeId";
import { remapInteractionTargets } from "@/features/editor/commands/interactionCommands";
import { getInteractions } from "@/features/editor/types/interactions";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { SvgScene } from "@/features/editor/types/svgScene";

/**
 * Regenerates every vector object's own id within a duplicated SVG's
 * scene (Checkpoint 1.15.6, section 40 of its own brief) — vector ids
 * are editor-local identity exactly like EditorElementNode ids are (see
 * types/svgScene.ts's own top comment), so a duplicated SVG must never
 * share a vector id with its original, the same "fresh id for every
 * node in the subtree" guarantee cloneNodeWithFreshIds already provides
 * for EditorElementNodes. Geometry/style are copied by value via the
 * spread — vector object fields are never mutated in place elsewhere in
 * this codebase, so sharing those references between original and clone
 * is safe.
 */
function cloneSvgSceneWithFreshIds(scene: SvgScene): SvgScene {
  return { objects: scene.objects.map((object) => ({ ...object, id: generateNodeId(object.type) })) };
}

/**
 * Deep-clones a node and its entire subtree, generating a fresh id for
 * every node in it (not just the root) — the one place clipboard paste
 * and duplicate both get a guaranteed-unique subtree from, so neither
 * command needs its own id-remapping logic. dimensions/text/displayName
 * are copied by value via the spread; dimensions objects are never
 * mutated in place elsewhere in this codebase (every resize replaces it
 * with a new object), so sharing that reference between the original and
 * the clone is safe.
 *
 * Checkpoint 1.15.6.8 — also regenerates a fresh id for every authored
 * interaction binding found anywhere in the subtree (Part I, section 43:
 * a duplicated binding must never share its own id with the original),
 * and rewrites any binding's `targetId` that pointed at a node ALSO
 * inside this same cloned subtree to the corresponding fresh id (Part I,
 * sections 40-41) — via a two-pass approach: this function's own
 * recursive walk builds the old-id -> new-id map for every node it
 * clones (`idMap`, populated as a side effect while cloning), then
 * remapInteractionTargets makes one second pass over the now-fully-built
 * clone to rewrite internal references using that complete map. Two
 * passes are required (not one) because a trigger's own clone may be
 * visited before its target's clone exists yet in a single top-down
 * pass, or vice versa — the map must be complete before any reference is
 * resolved against it. A binding whose old `targetId` is NOT a key in
 * `idMap` (the target lived OUTSIDE this cloned subtree) is left
 * completely untouched by the second pass — see remapInteractionTargets's
 * own doc comment for why that External-target case must never be
 * rewritten or cleared.
 */
export function cloneNodeWithFreshIds(node: EditorElementNode): EditorElementNode {
  const idMap = new Map<string, string>();
  const cloned = cloneSubtree(node, idMap);
  return remapInteractionTargets(cloned, idMap);
}

function cloneSubtree(node: EditorElementNode, idMap: Map<string, string>): EditorElementNode {
  const freshId = generateNodeId(node.tag);
  idMap.set(node.id, freshId);

  const interactions = getInteractions(node);

  return {
    ...node,
    id: freshId,
    svgScene: node.svgScene ? cloneSvgSceneWithFreshIds(node.svgScene) : undefined,
    interactions: interactions.length > 0 ? interactions.map((binding) => ({ ...binding, id: generateNodeId("interaction") })) : undefined,
    children: node.children?.map((child) => cloneSubtree(child, idMap)),
  };
}
