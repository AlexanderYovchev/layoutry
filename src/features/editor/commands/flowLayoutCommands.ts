import { getFlowLayoutSettings } from "@/features/editor/types/flowLayout";
import { clampGridChildPlacement } from "@/features/editor/utils/clampGridChildPlacement";
import type {
  FlexChildSettings,
  FlexContainerSettings,
  FlowDisplayMode,
  GridChildSettings,
  GridContainerSettings,
} from "@/features/editor/types/flowLayout";
import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * Flow-layout document commands (Checkpoint 3.5) — the counterpart to
 * layoutCommands.ts (Free mode), sharing the same immutable/structural-
 * sharing shape: every command returns a new root only along the path
 * that actually changed, and a no-op returns the exact same root
 * reference. Display, Flex settings, and Grid settings are three
 * independent fields on flowLayout — switching display never discards
 * the other two, so Block -> Flex -> Grid -> Flex round-trips restore
 * whatever Flex configuration was last set.
 */

function recurse(
  root: EditorElementNode,
  nodeId: string,
  apply: (node: EditorElementNode) => EditorElementNode,
): EditorElementNode {
  if (root.id === nodeId) return apply(root);
  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = recurse(child, nodeId, apply);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

/** Sets a container's own display mode (block/flex/grid). Existing flex/grid sub-settings are preserved untouched, so switching back restores them. */
export function setFlowDisplayMode(
  root: EditorElementNode,
  nodeId: string,
  display: FlowDisplayMode,
): EditorElementNode {
  return recurse(root, nodeId, (node) => ({
    ...node,
    flowLayout: { ...getFlowLayoutSettings(node), display },
  }));
}

/** Sets a container's own Flex settings, without requiring display to already be "flex" (configuring ahead of switching, or updating retained settings while another display mode is active). */
export function setFlexContainerSettings(
  root: EditorElementNode,
  nodeId: string,
  flex: FlexContainerSettings,
): EditorElementNode {
  return recurse(root, nodeId, (node) => ({
    ...node,
    flowLayout: { ...getFlowLayoutSettings(node), flex },
  }));
}

/**
 * Sets a container's own Grid settings — same "doesn't require display to
 * already be grid" reasoning as setFlexContainerSettings. Also
 * re-clamps every direct child's own gridChild placement against the
 * *new* column/row counts in the same atomic write (Checkpoint 3.5.1):
 * shrinking a Grid from 4 columns to 2 must not leave a child referencing
 * columns 3-4, which would render it unreachable/invisible. Pure
 * arithmetic, same pattern as spacingCommands.setElementPadding
 * re-normalizing a Free container's children when its own bounds change.
 */
export function setGridContainerSettings(
  root: EditorElementNode,
  nodeId: string,
  grid: GridContainerSettings,
): EditorElementNode {
  return recurse(root, nodeId, (node) => {
    const updated = { ...node, flowLayout: { ...getFlowLayoutSettings(node), grid } };
    if (!updated.children?.length) return updated;

    return {
      ...updated,
      children: updated.children.map((child) =>
        child.gridChild ? { ...child, gridChild: clampGridChildPlacement(child.gridChild, grid) } : child,
      ),
    };
  });
}

/** Sets one node's own flex-item settings (grow/shrink/basis/alignSelf) — meaningful only while its parent is Flex, but stored unconditionally like every other retained setting. */
export function setFlexChildSettings(
  root: EditorElementNode,
  nodeId: string,
  flexChild: FlexChildSettings,
): EditorElementNode {
  return recurse(root, nodeId, (node) => ({ ...node, flexChild }));
}

/** Sets one node's own grid-item placement (column/row start + span) — column/row bounds are clamped by the caller (see useEditorStore), which can cheaply look up the parent's current track count; this command just applies whatever it's given. */
export function setGridChildSettings(
  root: EditorElementNode,
  nodeId: string,
  gridChild: GridChildSettings,
): EditorElementNode {
  return recurse(root, nodeId, (node) => ({ ...node, gridChild }));
}
