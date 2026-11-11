import type { EditorElementNode } from "@/features/editor/types/document";

/** Answers whether a document can still be saved as a project file. */
export type DocumentSaveLimitGuard = (document: EditorElementNode) => boolean;

let registeredGuard: DocumentSaveLimitGuard | undefined;

/**
 * Lets the project feature, which owns the `.layoutry` format and its size
 * limit, tell the editor whether a proposed document still fits (BC-07.2).
 * The editor can't import the project feature (that feature already depends
 * on the editor), so the project workspace registers its check here when it
 * mounts. Returns the unregister function. With nothing registered, as in
 * editor-only unit tests, every document fits.
 */
export function registerDocumentSaveLimitGuard(guard: DocumentSaveLimitGuard): () => void {
  registeredGuard = guard;
  return () => {
    if (registeredGuard === guard) registeredGuard = undefined;
  };
}

/** Whether `document` can still be saved, by the registered project rule. */
export function documentFitsSaveLimit(document: EditorElementNode): boolean {
  return registeredGuard ? registeredGuard(document) : true;
}

const EMBEDDED_DATA_URL = /^\s*data:/i;

/**
 * Whether a subtree carries inline `data:` image or media data in a source
 * field (src, poster or a background image) — the only content that can
 * make a copy large enough to matter. Paste and duplicate check the save
 * limit only then, so ordinary copies cost nothing extra. Iterative.
 */
export function subtreeHasEmbeddedData(root: EditorElementNode): boolean {
  const pending: EditorElementNode[] = [root];
  while (pending.length > 0) {
    const node = pending.pop()!;
    if (
      (node.src !== undefined && EMBEDDED_DATA_URL.test(node.src)) ||
      (node.poster !== undefined && EMBEDDED_DATA_URL.test(node.poster)) ||
      (node.background?.image !== undefined && EMBEDDED_DATA_URL.test(node.background.image))
    )
      return true;
    if (node.children) pending.push(...node.children);
  }
  return false;
}
