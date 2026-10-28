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
  /**
   * "lg" for list-style content; "xl" for a wide dialog whose body fills
   * the remaining viewport height and lays out its own scrolling regions
   * (the code export dialog). Defaults to "md".
   */
  size?: "md" | "lg" | "xl";
  /** While true, Escape, the backdrop and the Close button don't close it (an operation is in progress). */
  closeDisabled?: boolean;
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  initialFocusRef,
  size = "md",
  closeDisabled = false,
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
        if (event.target === dialogRef.current && !closeDisabled) {
          dialogRef.current?.close();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          if (!closeDisabled) dialogRef.current?.close();
        }
      }}
      className={cn(
        "rounded-surface border-line bg-surface-panel text-fg-primary shadow-elevated m-auto w-full border p-0 backdrop:bg-slate-950/40",
        size === "lg" ? "max-w-xl" : size === "xl" ? "max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-5xl flex-col open:flex" : "max-w-md",
      )}
    >
      <div className="border-line-subtle flex items-center justify-between border-b px-4 py-3">
        <h2 id={headingId} className="text-sm font-semibold">
          {title}
        </h2>
        <button
          type="button"
          aria-label="Close"
          disabled={closeDisabled}
          onClick={() => dialogRef.current?.close()}
          className="rounded-control-sm ease-studio text-fg-secondary hover:bg-surface-hover hover:text-fg-primary focus-visible:outline-accent active:bg-surface-selected flex size-7 items-center justify-center transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
      <div className={cn("text-fg-secondary px-4 py-4 text-sm", size === "xl" && "flex min-h-0 flex-1 flex-col")}>{children}</div>
    </dialog>
  );
}
