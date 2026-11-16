"use client";

import { useContext } from "react";
import { RuntimeHiddenContext } from "@/features/canvas/components/document/previewRuntimeContext";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { isNodeAuthoredHidden } from "@/features/editor/utils/isNodeAuthoredHidden";

/**
 * The one Preview iframe lifecycle rule (BC-08.3, extended to generic
 * Embeds in BC-08.3.1): an iframe exists in Preview only while its element
 * is shown — not hidden by an interaction on itself or any ancestor
 * (RuntimeHiddenContext, ancestor-aware), and not hidden by authored
 * Display none / Visibility hidden on itself or an ancestor. Callers
 * render NO iframe when this is false, which ends the framed document
 * (so its media and sound stop); a later `true` mounts a fresh one.
 *
 * Pure derivation from editor state already in the store and context: no
 * effects, listeners or timers, so nothing can fire late and re-create a
 * removed frame, and nothing is written to the document.
 */
export function usePreviewFrameShown(nodeId: string, isPreview: boolean): boolean {
  const runtimeHidden = useContext(RuntimeHiddenContext);
  const authoredHidden = useEditorStore((state) => (isPreview ? isNodeAuthoredHidden(state.document, nodeId) === true : false));
  return isPreview && !runtimeHidden && !authoredHidden;
}
