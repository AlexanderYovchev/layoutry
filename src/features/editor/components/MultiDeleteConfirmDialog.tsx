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

/** "You are about to delete 4 selected elements." plus the nested elements that go with them, each counted once. */
export function describePendingDeletion(selectedCount: number, nestedCount: number): string {
  const main = `You are about to delete ${selectedCount} selected elements.`;
  if (nestedCount === 0) return main;
  const nested = nestedCount === 1 ? "1 nested element" : `${nestedCount} nested elements`;
  return `${main} This will also remove ${nested} inside them.`;
}

/**
 * The mandatory confirmation for deleting 2+ selected elements (BC-10.2,
 * owner decision 18). Opened by requestDeleteSelection (keyboard Delete/
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

  return (
    <Dialog open={pending !== null} onClose={cancel} title={MULTI_DELETE_COPY.title} initialFocusRef={cancelRef}>
      {pending && (
        <>
          <p>{describePendingDeletion(pending.selectedIds.length, pending.nestedCount)}</p>
          <p className="mt-2">{MULTI_DELETE_COPY.undoable}</p>
          <div className={dialogFooterClass}>
            <button ref={cancelRef} type="button" onClick={cancel} className={secondaryButtonClass}>
              {MULTI_DELETE_COPY.cancel}
            </button>
            <button type="button" onClick={confirm} className={dangerButtonClass}>
              {MULTI_DELETE_COPY.confirm}
            </button>
          </div>
        </>
      )}
    </Dialog>
  );
}
