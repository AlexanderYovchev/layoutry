import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * BC-17.2 — the generated-id prefix contract (BC-17.1.3 Report 1 §11).
 *
 * Later checkpoints generate HTML ids of their own (SVG definitions,
 * Tabs ids for aria-controls/aria-labelledby). They must never collide
 * with an id the user authored (`htmlId`). Authored ids are NOT
 * restricted — no existing id is renamed or rejected, so no migration is
 * needed. Instead the generator picks the first prefix in "ly-",
 * "ly1-", "ly2-", … that no authored htmlId in the document starts with.
 * Deterministic for a given document; generated ids are then
 * `${prefix}<token>` with tokens from [a-z0-9-] only.
 */
export const GENERATED_ID_BASE_PREFIX = "ly";

export function chooseGeneratedIdPrefix(authoredIds: Iterable<string>): string {
  const ids = [...authoredIds];
  for (let attempt = 0; ; attempt += 1) {
    const prefix = `${GENERATED_ID_BASE_PREFIX}${attempt === 0 ? "" : attempt}-`;
    if (!ids.some((id) => id.startsWith(prefix))) return prefix;
  }
}

/** Every authored htmlId in the document (iterative). */
export function collectAuthoredHtmlIds(root: EditorElementNode): string[] {
  const ids: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.htmlId) ids.push(node.htmlId);
    stack.push(...(node.children ?? []));
  }
  return ids;
}

/** The prefix generated ids in this document must use. */
export function generatedIdPrefixFor(root: EditorElementNode): string {
  return chooseGeneratedIdPrefix(collectAuthoredHtmlIds(root));
}
