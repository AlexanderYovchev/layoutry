import { documentNodeAttributes } from "@/features/canvas/utils/documentNodeAttributes";
import type { DocumentElementProps } from "@/features/canvas/types/documentRenderer";

export function BodyElement({ node, parentId, children }: DocumentElementProps) {
  return (
    <div
      {...documentNodeAttributes(node, parentId)}
      className="flex flex-col gap-8 p-10 sm:p-14"
    >
      {children}
    </div>
  );
}
