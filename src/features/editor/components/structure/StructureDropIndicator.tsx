import { Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StructureDropIndicatorState } from "@/features/editor/hooks/useStructureDragDrop";

/**
 * BC-12.3 (D2, D10): one absolutely positioned overlay in the tree wrapper
 * (never inside the rows, so hovering never re-renders the tree):
 * - before / after: a horizontal line between rows, starting at the label
 *   indent of the level the element will land at (BC-12.3.1: an ancestor's
 *   level when appending to the end of a container);
 * - inside: the whole row highlighted;
 * - refused: the same shape, dashed red, plus the shared validator's
 *   reason under the row (truncated to the panel width).
 * No transitions, so nothing animates under reduced motion either.
 * Decorative for assistive technology: drops are announced instead.
 */
export function StructureDropIndicator({ indicator }: { indicator: StructureDropIndicatorState }) {
  const refused = indicator.rejection !== null;
  // BC-12.3.1: for a line, `top` is the line's own y (the level and edge are resolved by useStructureDragDrop).
  const lineTop = indicator.top - 1;
  const reasonTop = indicator.zone === "inside" ? indicator.top + indicator.height + 2 : indicator.top + 4;

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
          style={{ top: reasonTop, left: indicator.left, maxWidth: indicator.width }}
        >
          <Ban className="size-3 shrink-0" />
          <span className="min-w-0 truncate">{indicator.reasonText}</span>
        </p>
      )}
    </div>
  );
}
