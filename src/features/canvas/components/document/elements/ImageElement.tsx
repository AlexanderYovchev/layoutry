import { Image as ImageIcon } from "lucide-react";
import { documentNodeAttributes } from "@/features/canvas/utils/documentNodeAttributes";
import type { DocumentElementProps } from "@/features/canvas/types/documentRenderer";

/**
 * The document model has no image-source field yet, so this renders an
 * honest "empty image slot" placeholder rather than fabricating a real
 * picture — matches the pattern most visual builders use before an
 * asset is chosen.
 */
export function ImageElement({ node, parentId }: DocumentElementProps) {
  return (
    <div
      {...documentNodeAttributes(node, parentId)}
      className="flex h-40 w-full items-center justify-center rounded-md border border-dashed border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <ImageIcon
        aria-hidden="true"
        className="size-8 text-zinc-300 dark:text-zinc-700"
      />
    </div>
  );
}
