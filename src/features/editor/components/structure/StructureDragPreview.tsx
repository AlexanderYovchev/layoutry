import { GripVertical } from "lucide-react";
import { FALLBACK_ELEMENT_ICON, TAG_ICONS } from "@/features/editor/components/structure/elementIcon";

interface StructureDragPreviewProps {
  label: string;
  tag: string;
  /** The number of moved roots (BC-12.4); "+ N elements" is shown only for more than one. */
  count: number;
}

/**
 * BC-12.3 (D13): the compact chip that follows the pointer during a
 * Structure drag — grip, the element's Structure icon and its name, never
 * a rendered copy of the element. Long names truncate. No animation.
 */
export function StructureDragPreview({ label, tag, count }: StructureDragPreviewProps) {
  const Icon = TAG_ICONS[tag] ?? FALLBACK_ELEMENT_ICON;
  return (
    <div
      data-structure-drag-preview=""
      role="img"
      aria-label={count > 1 ? `Moving ${label} and ${count - 1} other ${count === 2 ? "element" : "elements"}` : `Moving ${label}`}
      className="rounded-control border-accent/40 bg-surface-panel text-fg-primary shadow-elevated pointer-events-none flex max-w-56 items-center gap-1.5 border px-2 py-1 text-[13px] font-medium"
    >
      <GripVertical aria-hidden="true" className="text-fg-muted size-3.5 shrink-0" />
      <Icon aria-hidden="true" className="text-accent size-3.5 shrink-0" />
      <span className="min-w-0 truncate">{label}</span>
      {count > 1 && (
        <span data-structure-drag-count={count} className="bg-accent ml-1 shrink-0 rounded-full px-1.5 text-[11px] text-white">
          + {count - 1} {count === 2 ? "element" : "elements"}
        </span>
      )}
    </div>
  );
}
