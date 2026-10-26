"use client";

import { useEffect } from "react";
import { CheckCircle2 } from "lucide-react";
import { useProjectStore } from "@/features/project/stores/useProjectStore";

const AUTO_DISMISS_MS = 3500;

/**
 * Non-blocking success feedback for project operations (saved, opened,
 * imported…), in the same style as EditorNoticeBanner. Shown only after an
 * operation has completed; failures use a dialog instead.
 */
export function ProjectToast() {
  const toast = useProjectStore((state) => state.toast);
  const dismissToast = useProjectStore((state) => state.dismissToast);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(dismissToast, AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [toast, dismissToast]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-50 flex justify-center px-4">
      <div role="status" aria-live="polite" aria-label="Project status">
        {toast && (
          <div className="rounded-card border-line bg-surface-panel text-fg-primary shadow-elevated flex max-w-md items-center gap-2 border px-3.5 py-2 text-sm">
            <CheckCircle2
              aria-hidden="true"
              className="text-success size-4 shrink-0"
            />
            <p className="min-w-0 truncate">{toast.message}</p>
          </div>
        )}
      </div>
    </div>
  );
}
