/**
 * Authored initial Preview visibility (Checkpoint 1.15.6.8.1) — answers a
 * gap the Collapsible-only foundation (1.15.6.8) never needed: a real
 * Dropdown menu must start CLOSED the moment Preview begins, with no
 * click required, while remaining fully visible/editable in Design.
 *
 * Deliberately generic — works on ANY ordinary node, not a Dropdown-
 * specific concept (no `dropdownInitiallyOpen`/`menuInitiallyHidden`
 * field exists or is planned). Lives directly on EditorElementNode,
 * exactly like `lockChildStyles` — a single authored field on the
 * target itself, the smallest architecture that stays serialization-
 * friendly, duplication-safe (plain value, copied by the same `...node`
 * spread every other field already survives cloning through — see
 * cloneNodeWithFreshIds), and history-aware (set via an ordinary
 * document command, never bypassing pushHistory).
 *
 * Strictly separate from the two concerns Checkpoint 1.15.6.8 already
 * established:
 * - `EditorElementNode.interactions` (authored trigger->action->target
 *   bindings) — this field says nothing about WHEN a node starts hidden,
 *   only what happens to it (or another node) on click.
 * - the store's ephemeral `runtimeVisibility` slice (CURRENT visibility
 *   during an active Preview session) — this field is read exactly once,
 *   at the moment Preview is entered, to seed that slice; it is never
 *   itself mutated by clicking (see useEditorStore's enterPreview).
 *
 * `undefined` (the default, and the ONLY value any node had before this
 * checkpoint) means "visible" — the same "absence is the safe, backward-
 * compatible default" convention every other optional field in this
 * document model already follows. This is what makes Collapsible's own
 * content Container (which never sets this field) start visible in
 * Preview exactly as it did in 1.15.6.8, with zero migration.
 */
export type InitialPreviewVisibility = "visible" | "hidden";

export function getInitialPreviewVisibility(node: {
  initialPreviewVisibility?: InitialPreviewVisibility;
}): InitialPreviewVisibility {
  return node.initialPreviewVisibility ?? "visible";
}
