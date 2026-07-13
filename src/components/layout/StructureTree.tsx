import { StructureTreeNode } from "@/components/layout/StructureTreeNode";
import {
  structureTreeRoot,
  structureTreeRootLabel,
} from "@/components/layout/structureTreeData";

/**
 * Placeholder page-outline tree. Establishes the visual hierarchy
 * (indentation, expand affordance, nesting, future icon slot) only —
 * selection, reordering, drag and drop, and canvas sync are all deferred.
 */
export function StructureTree() {
  return (
    <div>
      <p className="px-2 pb-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {structureTreeRootLabel}
      </p>
      <div role="tree" aria-label="Page structure">
        <StructureTreeNode node={structureTreeRoot} depth={0} />
      </div>
    </div>
  );
}
