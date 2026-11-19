import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * The editor's own internal clipboard — deliberately not the OS clipboard
 * (no async Clipboard API permission prompts, and paste only ever needs
 * to work within this same document). `nodes` holds the copied/cut
 * subtree's root exactly as it existed in the document at the moment of
 * copy/cut; paste always clones it fresh (see cloneNodeWithFreshIds), so
 * pasting the same clipboard entry twice never produces duplicate ids.
 * `sourceParentId` is the one piece of context paste needs beyond the
 * node itself — see resolveDestinationParent's "original parent, when
 * still valid" fallback.
 */
export interface EditorClipboard {
  operation: "copy" | "cut";
  nodes: EditorElementNode[];
  sourceParentId: string | null;
  /**
   * BC-10.5.1: each root's own parent at copy/cut time, aligned with
   * `nodes` (multi-element copies only; `sourceParentId` is the first of
   * them). Paste uses it for the BC-09.3 rule "a cut current page pasted
   * back into its own Pagination stays current". Editor-only, like the
   * whole clipboard: never saved.
   */
  sourceParentIds?: readonly (string | null)[];
}
