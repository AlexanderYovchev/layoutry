import { documentNodeAttributes } from "@/features/canvas/utils/documentNodeAttributes";
import type { DocumentElementProps } from "@/features/canvas/types/documentRenderer";

export function ButtonElement({ node, parentId }: DocumentElementProps) {
  return (
    <button
      type="button"
      {...documentNodeAttributes(node, parentId)}
      className="inline-flex w-fit items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm dark:bg-zinc-50 dark:text-zinc-900"
    >
      {node.text}
    </button>
  );
}
