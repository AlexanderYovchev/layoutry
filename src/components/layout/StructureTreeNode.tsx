import { ChevronDown } from "lucide-react";
import type { StructureTreeNodeData } from "@/components/layout/structureTreeData";

interface StructureTreeNodeProps {
  node: StructureTreeNodeData;
  depth: number;
}

// Bounded lookup so indentation stays on the canonical Tailwind spacing
// scale instead of an inline style; six levels comfortably covers a
// placeholder page outline.
const indentClassesByDepth = [
  "pl-2",
  "pl-6",
  "pl-10",
  "pl-14",
  "pl-18",
  "pl-22",
] as const;

function indentClassName(depth: number) {
  return indentClassesByDepth[Math.min(depth, indentClassesByDepth.length - 1)];
}

export function StructureTreeNode({ node, depth }: StructureTreeNodeProps) {
  const children = node.children ?? [];
  const hasChildren = children.length > 0;

  return (
    <div
      role="treeitem"
      aria-expanded={hasChildren || undefined}
      aria-level={depth + 1}
      aria-selected={false}
    >
      <div
        className={`flex items-center gap-1.5 py-1.5 pr-2 text-sm text-zinc-600 dark:text-zinc-400 ${indentClassName(depth)}`}
      >
        {hasChildren ? (
          <ChevronDown
            aria-hidden="true"
            className="size-3.5 shrink-0 text-zinc-400 dark:text-zinc-600"
          />
        ) : (
          <span aria-hidden="true" className="size-3.5 shrink-0" />
        )}
        <span
          aria-hidden="true"
          className="size-3.5 shrink-0 rounded-sm border border-dashed border-zinc-200 dark:border-zinc-800"
        />
        <span className="truncate">{node.label}</span>
      </div>

      {hasChildren && (
        <div role="group">
          {children.map((child) => (
            <StructureTreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
