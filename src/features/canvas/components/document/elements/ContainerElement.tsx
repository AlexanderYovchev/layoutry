import { documentNodeAttributes } from "@/features/canvas/utils/documentNodeAttributes";
import type { DocumentElementProps } from "@/features/canvas/types/documentRenderer";

export function ContainerElement({
  node,
  parentId,
  children,
}: DocumentElementProps) {
  return (
    <div
      {...documentNodeAttributes(node, parentId)}
      className="flex flex-col items-start gap-4 rounded-lg border border-zinc-100 p-8 dark:border-zinc-900"
    >
      {children}
    </div>
  );
}
