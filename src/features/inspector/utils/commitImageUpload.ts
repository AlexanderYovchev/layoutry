import { setElementSrc } from "@/features/editor/commands/documentCommands";
import { documentFitsSaveLimit } from "@/features/editor/rules/documentSaveLimitGuard";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { findNodeById } from "@/features/editor/utils/findNodeById";

export const IMAGE_COMMIT_MESSAGES = {
  projectTooLarge: "This image would make the project too large to save. Choose a smaller image or remove unused content.",
  targetGone: "The image element was removed before the upload finished. Nothing was changed.",
  otherProject: "A different project was opened before the upload finished. Nothing was changed.",
  sourceChanged: "The image's source changed while the file was being read, so the upload wasn't applied. Nothing was changed.",
} as const;

export type ImageCommitResult = { ok: true } | { ok: false; message: string };

/**
 * Commits a validated upload to the Image it was started for (BC-07.2).
 * Synchronous on purpose: it reads the store's latest state, builds the
 * proposed document with the same pure command the store uses, checks that
 * document against the project's save limit (the replaced source is gone
 * from it, so a replacement is measured as a replacement) and commits it,
 * all in one turn of the event loop, so no other edit can land between the
 * check and the commit. Success is exactly one history entry; every
 * refusal changes nothing (document, history, unsaved state).
 *
 * The upload is refused when the document it started against was replaced
 * (another project opened) or its Image no longer exists, so a finished
 * upload can never land on some other element or in another project.
 *
 * BC-07.4: it is also refused when the Image's source is no longer the one
 * it had when the upload started (`startSrc`): a URL typed, an Undo or Redo
 * of that Image's source while the file was read is newer intent, and a late
 * upload must not silently overwrite it. Edits to anything else are kept.
 */
export function commitImageUpload(target: { nodeId: string; documentSessionId: number; startSrc?: string }, dataUrl: string): ImageCommitResult {
  const state = useEditorStore.getState();
  if (state.documentSessionId !== target.documentSessionId) return { ok: false, message: IMAGE_COMMIT_MESSAGES.otherProject };
  const node = findNodeById(state.document, target.nodeId);
  if (!node || node.tag !== "img") return { ok: false, message: IMAGE_COMMIT_MESSAGES.targetGone };
  if ("startSrc" in target && node.src !== target.startSrc) return { ok: false, message: IMAGE_COMMIT_MESSAGES.sourceChanged };
  if (node.src === dataUrl) return { ok: true };
  const proposed = setElementSrc(state.document, target.nodeId, dataUrl);
  if (!documentFitsSaveLimit(proposed)) return { ok: false, message: IMAGE_COMMIT_MESSAGES.projectTooLarge };
  state.setElementSrc(target.nodeId, dataUrl);
  return { ok: true };
}
