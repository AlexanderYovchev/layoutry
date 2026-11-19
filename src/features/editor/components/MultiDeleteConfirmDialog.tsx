"use client";

import { useRef } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { dangerButtonClass, dialogFooterClass, secondaryButtonClass } from "@/components/ui/dialogButtons";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";

/** The dialog's copy (BC-10.2), shared with tests. */
export const MULTI_DELETE_COPY = {
  title: "Delete selected elements?",
  cancel: "Cancel",
  confirm: "Delete elements",
  undoable: "This action can be undone.",
} as const;

/** The multi-cut confirmation's copy (BC-10.5): the same dialog, other words. */
export const MULTI_CUT_COPY = {
  title: "Cut selected elements?",
  cancel: "Cancel",
  confirm: "Cut elements",
  undoable: "The elements can be pasted elsewhere, and the cut can be undone.",
} as const;

/** "You are about to cut 4 selected elements. This will also remove 2 nested elements." */
export function describePendingCut(selectedCount: number, nestedCount: number): string {
  const main = `You are about to cut ${selectedCount} selected elements.`;
  if (nestedCount === 0) return main;
  const nested = nestedCount === 1 ? "1 nested element" : `${nestedCount} nested elements`;
  return `${main} This will also remove ${nested}.`;
}

/** "You are about to delete 4 selected elements." plus the nested elements that go with them, each counted once. */
export function describePendingDeletion(selectedCount: number, nestedCount: number): string {
  const main = `You are about to delete ${selectedCount} selected elements.`;
  if (nestedCount === 0) return main;
  const nested = nestedCount === 1 ? "1 nested element" : `${nestedCount} nested elements`;
  return `${main} This will also remove ${nested} inside them.`;
}

/**
 * The mandatory confirmation for deleting 2+ selected elements (BC-10.2,
 * owner decision 18) — and for cutting them (BC-10.5: a multi-cut removes
 * them too; confirming also puts them on the clipboard). Opened by requestDeleteSelection (keyboard Delete/
 * Backspace and Edit > Delete); nothing changes until "Delete elements".
 * Cancel is focused first, and Escape, the close button and the backdrop
 * all cancel. Confirming revalidates the captured targets in the store
 * (confirmPendingDeletion), and closes the dialog in the same write, so a
 * second click can't delete twice.
 */
export function MultiDeleteConfirmDialog() {
  const pending = useEditorStore((state) => state.pendingDeletion);
  const confirm = useEditorStore((state) => state.confirmPendingDeletion);
  const cancel = useEditorStore((state) => state.cancelPendingDeletion);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const isCut = pending?.kind === "cut";
  const copy = isCut ? MULTI_CUT_COPY : MULTI_DELETE_COPY;

  return (
    <Dialog open={pending !== null} onClose={cancel} title={copy.title} initialFocusRef={cancelRef}>
      {pending && (
        <>
          <p>{(isCut ? describePendingCut : describePendingDeletion)(pending.selectedIds.length, pending.nestedCount)}</p>
          <p className="mt-2">{copy.undoable}</p>
          <div className={dialogFooterClass}>
            <button ref={cancelRef} type="button" onClick={cancel} className={secondaryButtonClass}>
              {copy.cancel}
            </button>
            <button type="button" onClick={confirm} className={dangerButtonClass}>
              {copy.confirm}
            </button>
          </div>
        </>
      )}
    </Dialog>
  );
}
