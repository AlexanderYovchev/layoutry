"use client";

import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Focused when the dialog opens, instead of the first focusable element (Close). */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** "lg" for list-style content; defaults to "md". */
  size?: "md" | "lg";
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  initialFocusRef,
  size = "md",
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const headingId = useId();

  useEffect(() => {
    const dialogEl = dialogRef.current;
    if (!dialogEl) return;

    if (open && !dialogEl.open) {
      previouslyFocused.current = document.activeElement as HTMLElement | null;
      dialogEl.showModal();
      initialFocusRef?.current?.focus();
    } else if (!open && dialogEl.open) {
      dialogEl.close();
    }
  }, [open, initialFocusRef]);

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
      className={cn(
        "rounded-surface border-line bg-surface-panel text-fg-primary shadow-elevated m-auto w-full border p-0 backdrop:bg-slate-950/40",
        size === "lg" ? "max-w-xl" : "max-w-md",
      )}
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
