import { assetIdentifierSlug } from "@/features/editor/types/counters";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { KeyframesDefinition } from "@/features/editor/types/styleAssets";

/*
 * BC-17.3.1 QA-4 — the keyframe dependency FOUNDATION that BC-17.3 owes
 * (BC-17.1.3 Report 1 §8.2 "keyframes emitted once per referenced id",
 * §8.4 "dependency index … keyframe dependencies"; Roadmap BC-17.3 item 2).
 *
 * Implemented here: reference discovery (one function), deterministic CSS
 * identifiers, and — in compileKeyframes.ts / printStyleRules.ts — the
 * compilation and printing of the referenced definitions, once each. The
 * compiler cache keys a node on the identifiers it references and emits
 * one document-level keyframes chunk.
 *
 * Deferred to BC-17.11 (NOT here): the animation group and any field that
 * references a keyframes definition (animation-name and the other
 * longhands), keyframe authoring, Design playback, reduced-motion animation
 * rules and the Motion Inspector. Until then no document can reference a
 * definition, so keyframeRefsOf returns [] and nothing is emitted.
 */

/**
 * The keyframes definition ids a node's styling references — the single
 * discovery point every surface and the cache use. BC-17.11 adds the
 * references (the animation group's animation-name) here; the BC-17.2 model
 * has no field that can reference a definition yet.
 */
export function keyframeRefsOf(node: EditorElementNode): string[] {
  void node;
  return [];
}

/** Every keyframes definition id referenced anywhere in the document, in first-reference order. */
export function referencedKeyframes(document: EditorElementNode): string[] {
  const ids = new Set<string>();
  const visit = (node: EditorElementNode) => {
    for (const id of keyframeRefsOf(node)) ids.add(id);
    for (const child of node.children ?? []) visit(child);
  };
  visit(document);
  return [...ids];
}

/**
 * CSS identifiers for a document's keyframes definitions, in definition
 * order: `k-<slug(name)>` in [a-z0-9-], -2, -3… on collision. Deterministic
 * for the same definitions; the "k-" prefix keeps them clear of every CSS
 * keyword and of the editor's own keyframes (fade-in, fade-in-up).
 */
export function keyframesCssIdentifiers(
  definitions: readonly KeyframesDefinition[],
): Map<string, string> {
  const used = new Set<string>();
  const identifiers = new Map<string, string>();
  for (const definition of definitions) {
    const base = `k-${assetIdentifierSlug(definition.name, "keyframes")}`;
    let candidate = base;
    for (let suffix = 2; used.has(candidate); suffix += 1)
      candidate = `${base}-${suffix}`;
    used.add(candidate);
    identifiers.set(definition.id, candidate);
  }
  return identifiers;
}
