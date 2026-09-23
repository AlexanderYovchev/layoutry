/**
 * Generic Interaction Binding (Checkpoint 1.15.6.8) — the smallest V1
 * vocabulary recommended by the 1.15.6.7 audit: a trigger, an action, and
 * a target, and nothing else. Deliberately click-only and three actions
 * for this checkpoint — no hover/focus/submit/keyboard/timer triggers, no
 * open/close/navigate/scrollTo/animate actions, no conditions, no
 * branching, no sequences. This is authored, persistent DOCUMENT data
 * (see EditorElementNode.interactions) — the trigger→target relationship
 * itself is what the user intends to happen, not runtime state; whether
 * the target is CURRENTLY visible right now during a Preview session is
 * a completely separate, ephemeral concern (see useEditorStore's own
 * `runtimeVisibility` slice).
 *
 * `targetId` is always an internal editor node id (generateNodeId's own
 * output), never an authored `htmlId` — `htmlId` has no uniqueness
 * guarantee at all (see EditorElementNode.htmlId's own doc comment),
 * while internal ids are the one identity every other cross-cutting
 * system (selection, history, drag, duplication) already trusts. This is
 * also the FIRST node-to-node reference ever added to this document
 * model (`href` is a URL string, not a pointer to another
 * EditorElementNode) — see cloneNodeWithFreshIds for how duplication
 * keeps such a reference correct.
 */
export type InteractionTrigger = "click";

export type InteractionAction = "show" | "hide" | "toggle";

export interface InteractionBinding {
  /** This binding's own stable identity — never an array index, never targetId, never reused across bindings (generated via the same generateNodeId every document node id already uses, e.g. `generateNodeId("interaction")`). Needed so update/remove can address one specific binding even when a node has several. */
  id: string;
  trigger: InteractionTrigger;
  action: InteractionAction;
  /** The internal editor node id this binding acts on when it fires. May point outside the owning node's own subtree (an "external" target — see cloneNodeWithFreshIds's own doc comment for why duplication must NOT rewrite that case). */
  targetId: string;
}

/** A node with no authored interactions returns an empty array, never undefined — every caller (Inspector, executor, cleanup/remap commands) can iterate unconditionally. */
export function getInteractions(node: { interactions?: InteractionBinding[] }): InteractionBinding[] {
  return node.interactions ?? [];
}

/**
 * Normalizes an empty binding list back to `undefined` rather than
 * storing `interactions: []` (Checkpoint 1.15.6.8, section 8) — the same
 * "unset means genuinely absent, not an empty collection" convention
 * `boxShadow`/`children` already follow elsewhere in this document model,
 * so a node that has never had an interaction and a node whose last
 * interaction was just removed are indistinguishable in storage.
 */
export function withInteractions(interactions: InteractionBinding[]): InteractionBinding[] | undefined {
  return interactions.length > 0 ? interactions : undefined;
}
