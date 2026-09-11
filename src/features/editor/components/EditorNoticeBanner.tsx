"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";

const AUTO_DISMISS_MS = 4000;

/**
 * The editor's one shared transient, non-modal message banner (Checkpoint
 * 1.15.3, sections 20-23) — no toast/snackbar infrastructure existed
 * anywhere in this app before this checkpoint (confirmed by audit), so
 * this is deliberately the smallest reusable primitive that satisfies the
 * brief: one visible message, auto-dismissing, never blocking Canvas
 * interaction (pointer-events-none on the wrapper, the click-through
 * button excepted). Reads the store's single `editorNotice` slot rather
 * than owning any state itself — every producer (currently: blocked
 * style-protection attempts) just calls showEditorNotice, and this is the
 * one place that turns that into something visible.
 *
 * The auto-dismiss timer restarts only when `editorNotice.id` changes, not
 * on every render — `id` only increments when the message text itself
 * changes (see nextEditorNoticeState in useEditorStore), so a continuous
 * stream of identical blocked-attempt notices (e.g. dragging a locked
 * Free child) never perpetually extends how long the banner stays up
 * (section 23's own anti-spam requirement).
 */
export function EditorNoticeBanner() {
  const notice = useEditorStore((state) => state.editorNotice);
  const dismissEditorNotice = useEditorStore((state) => state.dismissEditorNotice);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => dismissEditorNotice(), AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally keyed on notice.id only, not the whole notice object (see doc comment above).
  }, [notice?.id, dismissEditorNotice]);

  if (!notice) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto flex max-w-md items-start gap-2 rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-700 shadow-lg dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
      >
        <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-500" />
        <p className="flex-1">{notice.message}</p>
      </div>
    </div>
  );
}
