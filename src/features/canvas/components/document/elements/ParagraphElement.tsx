import { documentNodeAttributes } from "@/features/canvas/utils/documentNodeAttributes";
import type { DocumentElementProps } from "@/features/canvas/types/documentRenderer";

export function ParagraphElement({ node, parentId }: DocumentElementProps) {
  return (
    <p
      {...documentNodeAttributes(node, parentId)}
      className="max-w-prose text-base leading-relaxed text-zinc-600 dark:text-zinc-400"
    >
      {node.text}
    </p>
  );
}
