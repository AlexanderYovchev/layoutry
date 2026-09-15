import { generateNodeId } from "@/features/editor/utils/generateNodeId";
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
 */
export function cloneNodeWithFreshIds(node: EditorElementNode): EditorElementNode {
  return {
    ...node,
    id: generateNodeId(node.tag),
    svgScene: node.svgScene ? cloneSvgSceneWithFreshIds(node.svgScene) : undefined,
    children: node.children?.map(cloneNodeWithFreshIds),
  };
}
