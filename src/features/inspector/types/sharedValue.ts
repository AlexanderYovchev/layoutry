/**
 * The typed representation of "one value, read across every node in a
 * multi-selection" (Checkpoint 1.15.2, Part H of its own report) — a
 * discriminated union rather than a magic sentinel string like `"MIXED"`
 * living inside a real CSS property type (the brief's own explicit
 * instruction), so a field's real value type never has to widen just to
 * accommodate the "differs across the selection" case.
 */
export type SharedValue<T> = { kind: "same"; value: T } | { kind: "mixed" };

/**
 * Reads `selector(node)` off every node and folds the results into a
 * SharedValue — `"same"` only when every node produced a value that's
 * `===` (or, for the optional `isEqual` override, structurally equal)
 * to the first; `"mixed"` otherwise. Compares whatever `selector` already
 * returns (the SAME effective-vs-authored value every single-selection
 * Inspector control already reads — e.g. getTypographySettings(node).color,
 * not a live-DOM/computed-style read), so a field never goes "mixed"
 * merely because different tags render different browser-native
 * defaults for an unset property — see this checkpoint's own report,
 * section H.
 */
export function resolveSharedValue<TNode, TValue>(
  nodes: readonly TNode[],
  selector: (node: TNode) => TValue,
  isEqual: (a: TValue, b: TValue) => boolean = (a, b) => a === b,
): SharedValue<TValue> {
  if (nodes.length === 0) throw new Error("resolveSharedValue requires at least one node");

  const first = selector(nodes[0]);
  for (let index = 1; index < nodes.length; index += 1) {
    if (!isEqual(selector(nodes[index]), first)) return { kind: "mixed" };
  }
  return { kind: "same", value: first };
}

export function isSameValue<T>(shared: SharedValue<T>): shared is { kind: "same"; value: T } {
  return shared.kind === "same";
}

/**
 * Substitutes `fallback` for a "same but unset" (`value: undefined`)
 * read — most bulk numeric/text fields display SOME concrete value even
 * for a node that never explicitly set the property (the same resolver-
 * level fallback pattern DEFAULT_OBJECT_FIT/getVideoControls already use
 * at the single-node level, e.g. an unset Opacity reads as 100). Genuine
 * disagreement across the selection (`"mixed"`) always passes through
 * unchanged — only the "every node agrees, and agrees on absent" case is
 * ever substituted.
 */
export function withSharedFallback<T>(shared: SharedValue<T | undefined>, fallback: T): SharedValue<T> {
  if (shared.kind === "mixed") return shared;
  return { kind: "same", value: shared.value ?? fallback };
}
