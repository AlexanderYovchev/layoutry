import { Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StructureDropIndicatorState } from "@/features/editor/hooks/useStructureDragDrop";

/**
 * BC-12.3 (D2, D10): one absolutely positioned overlay in the tree wrapper
 * (never inside the rows, so hovering never re-renders the tree):
 * - before / after: a horizontal line at the row's top / bottom edge,
 *   starting at the row's label indent;
 * - inside: the whole row highlighted;
 * - refused: the same shape, dashed red, plus the shared validator's
 *   reason under the row (truncated to the panel width).
 * No transitions, so nothing animates under reduced motion either.
 * Decorative for assistive technology: drops are announced instead.
 */
export function StructureDropIndicator({ indicator }: { indicator: StructureDropIndicatorState }) {
  const refused = indicator.rejection !== null;
  const lineTop = indicator.zone === "before" ? indicator.top - 1 : indicator.top + indicator.height - 1;

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0" data-structure-drop-indicator={indicator.zone} data-refused={refused ? "true" : undefined}>
      {indicator.zone === "inside" ? (
        <div
          className={cn(
            "rounded-control absolute border-2",
            refused ? "border-dashed border-red-500 bg-red-500/5" : "border-accent bg-accent/15",
          )}
          style={{ top: indicator.top, left: indicator.left, width: indicator.width, height: indicator.height }}
        />
      ) : (
        <div
          className={cn("absolute h-0.5 rounded-full", refused ? "border-t-2 border-dashed border-red-500" : "bg-accent")}
          style={{ top: lineTop, left: indicator.left, width: indicator.width }}
        />
      )}
      {indicator.reasonText && (
        <p
          data-structure-drop-reason=""
          className="rounded-control-sm bg-surface-panel absolute flex items-center gap-1 border border-red-500/40 px-1.5 py-0.5 text-[11px] text-red-700 shadow-sm dark:text-red-400"
          style={{ top: indicator.top + indicator.height + 2, left: indicator.left, maxWidth: indicator.width }}
        >
          <Ban className="size-3 shrink-0" />
          <span className="min-w-0 truncate">{indicator.reasonText}</span>
        </p>
      )}
    </div>
  );
}
