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

const MODAL_CONTENT_FLEX: FlexContainerSettings = {
  direction: "column",
  wrap: "nowrap",
  justifyContent: "start",
  alignItems: "stretch",
  rowGap: 12,
  columnGap: 12,
};

const MODAL_CONTENT_SPACING: ElementSpacing = {
  margin: ZERO_EDGES,
  padding: ZERO_EDGES,
};

/**
 * Modal (Checkpoint 1.15.6.9) — the first Interactive composition to use
 * a genuine `tag: "dialog"` (DialogElement/documentNodeComponents.ts)
 * rather than an ordinary div standing in for an overlay, and the first
 * composition where TWO different triggers (Open, Close) target the
 * exact SAME node — a real, deliberate exercise of
 * cloneNodeWithFreshIds/remapInteractionTargets' own two-pass id-map
 * design (both already handle this correctly per-binding, with zero new
 * code: see this checkpoint's own report, section W).
 *
 * Open/Close use `show`/`hide`, not `toggle` (Part I, section 38 of this
 * checkpoint's own brief) — the semantic intent is explicit per button,
 * which also has a real architectural consequence documented in the
 * report (section V): findDismissibleRelationships' V1 rule only ever
 * qualifies a `click`+`toggle` relationship, so this Dialog is correctly,
 * automatically EXCLUDED from Checkpoint 1.15.6.8.3's generic outside-
 * click/Escape dismissal — no broadening of that utility was needed or
 * made. Backdrop click and native Escape are instead owned entirely by
 * DialogElement itself, using the browser's own native `<dialog>`
 * lifecycle (showModal/close/the native `close` event) — see its own doc
 * comment.
 *
 * Dialog's own box owns no Flow/Flex/Grid layout of its own
 * (supportsChildLayout: false — elementCapabilities.ts); the actual
 * Flex-column/gap/padding arrangement of Heading/Paragraph/Close Button
 * lives one level down, on this ordinary content Container, exactly the
 * "dialog > content Container" shape this checkpoint's own brief asks
 * for (Part 5).
 */
export function createModalNode(): EditorElementNode {
  // The dialog's own id is decided before any of its ancestors/descendants
  // are built — the same "target id known up front, no remapping needed
  // at creation time" shape createCollapsibleNode/createDropdownButtonNode
  // already use, now proven for TWO different triggers (Open, Close)
  // referencing the exact same id.
  const dialogId = generateNodeId("dialog");

  const closeButton: EditorElementNode = {
    id: generateNodeId("button"),
    tag: "button",
    text: "Close",
    interactions: [{ id: generateNodeId("interaction"), trigger: "click", action: "hide", targetId: dialogId }],
  };

  const content: EditorElementNode = {
    id: generateNodeId("div"),
    tag: "div",
    flowLayout: { display: "flex", flex: MODAL_CONTENT_FLEX },
    spacing: MODAL_CONTENT_SPACING,
    children: [
      { id: generateNodeId("h2"), tag: "h2", text: "Modal Title" },
      { id: generateNodeId("p"), tag: "p", text: "Modal content goes here." },
      closeButton,
    ],
  };

  const dialog: EditorElementNode = {
    id: dialogId,
    tag: "dialog",
    initialPreviewVisibility: "hidden",
    spacing: { margin: ZERO_EDGES, padding: { top: 24, right: 24, bottom: 24, left: 24 } },
    children: [content],
  };

  const openButton: EditorElementNode = {
    id: generateNodeId("button"),
    tag: "button",
    text: "Open Modal",
    interactions: [{ id: generateNodeId("interaction"), trigger: "click", action: "show", targetId: dialogId }],
  };

  return {
    id: generateNodeId("div"),
    tag: "div",
    flowLayout: { display: "flex", flex: COLLAPSIBLE_ROOT_FLEX },
    children: [openButton, dialog],
  };
}
