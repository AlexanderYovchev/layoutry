import type { MediaFitSettings } from "@/features/editor/types/mediaFit";
import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * Sets one node's own media-fit settings (Checkpoint 3.5.1) — same
 * immutable/structural-sharing shape as every other Checkpoint 3.5
 * command (flowLayoutCommands.ts, spacingCommands.ts): returns a new root
 * only along the path that actually changed, and a no-op returns the
 * exact same root reference. Meaningful only for a media-capable tag, but
 * stored unconditionally like every other retained per-node setting —
 * the resolver/UI layer is responsible for only reading/showing it where
 * relevant. `mediaFit` is the caller's complete next settings object
 * (already the "unset -> undefined" result of withMediaFitField/
 * withMediaFitPosition/clearMediaFitPosition for a reset/clear —
 * Checkpoint 5.6), overwritten wholesale rather than merged here, exactly
 * like setBackgroundSettings/setTypographySettings — merging semantics
 * belong one layer up, at the Inspector row that knows which field(s)
 * it's changing.
 */
export function setMediaFitSettings(
  root: EditorElementNode,
  nodeId: string,
  mediaFit: MediaFitSettings | undefined,
): EditorElementNode {
  if (root.id === nodeId) return { ...root, mediaFit };

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = setMediaFitSettings(child, nodeId, mediaFit);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}
