/**
 * The single place a document node id is ever generated. Uses a short
 * random suffix rather than a per-tag counter so a freshly inserted
 * node can never collide with an existing fixture id (e.g. "button-1"
 * already exists) without needing to scan the tree first. Stable once
 * generated — future history and export both depend on that.
 */
export function generateNodeId(tag: string): string {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${tag}-${suffix}`;
}
