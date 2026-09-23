/**
 * Components -> Interactive (Checkpoint 1.15.6.8) — the first composition
 * to author a generic interaction binding rather than merely styled
 * primitives. Collapsible is deliberately the proof composition the
 * 1.15.6.7 audit recommended over Modal/Toast/Tooltip/etc.: it exercises
 * the full generic vocabulary (a click trigger, a toggle action, an
 * internal-node target, runtime visibility, Design/Preview separation,
 * history, duplication, deletion cleanup) with none of Modal's orthogonal
 * overlay/focus/stacking machinery — no portal, no backdrop, no focus
 * trap, no timers.
 *
 * The tree is ordinary primitives only — div/button/p — with ONE
 * authored interaction binding on the Button, using the exact same
 * generic `EditorElementNode.interactions` field the Inspector's own
 * Interactions section exposes; there is no `tag: "collapsible"` and no
 * `collapsibleOpen`/`componentType` field anywhere. After insertion this
 * is indistinguishable from a user having manually added the same
 * binding to an ordinary Button/Container pair themselves — preserving
 * exactly the same "a Component loses its special identity after
 * insertion" philosophy Buttons/Navigation/Cards/Forms/Data Display
 * already established, now proven for behavior, not just styling.
 */

import { generateNodeId } from "@/features/editor/utils/generateNodeId";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { FlexContainerSettings } from "@/features/editor/types/flowLayout";
import type { ElementSpacing } from "@/features/editor/types/spacing";
import { ZERO_EDGES } from "@/features/editor/types/spacing";

const COLLAPSIBLE_ROOT_FLEX: FlexContainerSettings = {
  direction: "column",
  wrap: "nowrap",
  justifyContent: "start",
  alignItems: "stretch",
  rowGap: 8,
  columnGap: 8,
};

const COLLAPSIBLE_CONTENT_PADDING: ElementSpacing = {
  margin: ZERO_EDGES,
  padding: { top: 12, right: 12, bottom: 12, left: 12 },
};

/**
 * div (Flex Column) > button, div > p — the content Container's own id
 * is generated first so the Button's interaction binding can target it
 * directly by construction; no remapping is needed at creation time
 * (both nodes are created together, in the same factory call, with the
 * relationship already known) — remapping only matters later, when this
 * whole tree is duplicated (see cloneNodeWithFreshIds).
 */
export function createCollapsibleNode(): EditorElementNode {
  const content: EditorElementNode = {
    id: generateNodeId("div"),
    tag: "div",
    flowLayout: { display: "block" },
    spacing: COLLAPSIBLE_CONTENT_PADDING,
    children: [{ id: generateNodeId("p"), tag: "p", text: "Collapsible content" }],
  };

  const trigger: EditorElementNode = {
    id: generateNodeId("button"),
    tag: "button",
    text: "Toggle Content",
    interactions: [{ id: generateNodeId("interaction"), trigger: "click", action: "toggle", targetId: content.id }],
  };

  return {
    id: generateNodeId("div"),
    tag: "div",
    flowLayout: { display: "flex", flex: COLLAPSIBLE_ROOT_FLEX },
    children: [trigger, content],
  };
}
