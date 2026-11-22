import { GripVertical } from "lucide-react";
import { FALLBACK_ELEMENT_ICON, TAG_ICONS } from "@/features/editor/components/structure/elementIcon";

interface StructureDragPreviewProps {
  label: string;
  tag: string;
  /** BC-12.4 multi-drag will pass more than 1; a count is shown only then. */
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
      className="rounded-control border-accent/40 bg-surface-panel text-fg-primary shadow-elevated pointer-events-none flex max-w-56 items-center gap-1.5 border px-2 py-1 text-[13px] font-medium"
    >
      <GripVertical aria-hidden="true" className="text-fg-muted size-3.5 shrink-0" />
      <Icon aria-hidden="true" className="text-accent size-3.5 shrink-0" />
      <span className="min-w-0 truncate">{label}</span>
      {count > 1 && <span className="bg-accent ml-1 text-white shrink-0 rounded-full px-1.5 text-[11px]">{count}</span>}
    </div>
  );
}
