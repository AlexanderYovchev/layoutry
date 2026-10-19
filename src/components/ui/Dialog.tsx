"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Dialog({ open, onClose, title, children }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const headingId = useId();

  useEffect(() => {
    const dialogEl = dialogRef.current;
    if (!dialogEl) return;

    if (open && !dialogEl.open) {
      previouslyFocused.current = document.activeElement as HTMLElement | null;
      dialogEl.showModal();
    } else if (!open && dialogEl.open) {
      dialogEl.close();
    }
  }, [open]);

  useEffect(() => {
    const dialogEl = dialogRef.current;
    if (!dialogEl) return;

    function handleClose() {
      onClose();
      previouslyFocused.current?.focus();
    }

    dialogEl.addEventListener("close", handleClose);
    return () => dialogEl.removeEventListener("close", handleClose);
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      tabIndex={-1}
      aria-labelledby={headingId}
      onClick={(event) => {
        if (event.target === dialogRef.current) {
          dialogRef.current?.close();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          dialogRef.current?.close();
        }
      }}
      className="rounded-surface border-line bg-surface-panel text-fg-primary shadow-elevated w-full max-w-md border p-0 backdrop:bg-slate-950/40"
    >
      <div className="border-line-subtle flex items-center justify-between border-b px-4 py-3">
        <h2 id={headingId} className="text-sm font-semibold">
          {title}
        </h2>
        <button
          type="button"
          aria-label="Close"
          onClick={() => dialogRef.current?.close()}
          className="rounded-control-sm ease-studio text-fg-secondary hover:bg-surface-hover hover:text-fg-primary focus-visible:outline-accent active:bg-surface-selected flex size-7 items-center justify-center transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
      <div className="text-fg-secondary px-4 py-4 text-sm">{children}</div>
    </dialog>
  );
}
