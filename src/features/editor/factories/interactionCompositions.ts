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
import { applyShadowPreset } from "@/features/editor/types/boxShadow";
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

const TAB_CONTROLS_FLEX: FlexContainerSettings = {
  direction: "row",
  wrap: "nowrap",
  justifyContent: "start",
  alignItems: "stretch",
  rowGap: 8,
  columnGap: 8,
};

const TAB_PANELS_FLEX: FlexContainerSettings = {
  direction: "column",
  wrap: "nowrap",
  justifyContent: "start",
  alignItems: "stretch",
  rowGap: 8,
  columnGap: 8,
};

const TAB_PANEL_CONTENT_FLEX: FlexContainerSettings = {
  direction: "column",
  wrap: "nowrap",
  justifyContent: "start",
  alignItems: "stretch",
  rowGap: 8,
  columnGap: 8,
};

function tabPanel(id: string, hidden: boolean, title: string, body: string): EditorElementNode {
  return {
    id,
    tag: "div",
    ...(hidden ? { initialPreviewVisibility: "hidden" as const } : {}),
    flowLayout: { display: "flex", flex: TAB_PANEL_CONTENT_FLEX },
    spacing: COLLAPSIBLE_CONTENT_PADDING,
    children: [
      { id: generateNodeId("h3"), tag: "h3", text: title, typography: { fontSize: { value: 16, unit: "px" }, fontWeight: 600 } },
      { id: generateNodeId("p"), tag: "p", text: body },
    ],
  };
}

function tabButton(text: string, bindings: { targetId: string; action: "show" | "hide" }[]): EditorElementNode {
  return {
    id: generateNodeId("button"),
    tag: "button",
    text,
    interactions: bindings.map(({ targetId, action }) => ({ id: generateNodeId("interaction"), trigger: "click", action, targetId })),
  };
}

/**
 * div (Flex Column) > Tab Controls div (Flex Row) > button x3, Panels div
 * (Flex Column) > panel div x3 (Checkpoint 1.15.6.11.2) — the central
 * architectural proof the 1.15.6.11 audit set out to confirm: a single
 * trigger node can already own MULTIPLE click bindings, and
 * executeInteractionsForNode (useEditorStore.ts) already applies every
 * one of them in a single state update. Each Tab Button therefore owns
 * exactly three ordinary bindings — one `show` (its own panel) and two
 * `hide` (the other two panels) — using the EXACT SAME generic
 * `EditorElementNode.interactions` array every other composition already
 * uses. No `switchTab`/`showOnly`/`activeTab` action or field was added
 * or needed; this is not a new interaction primitive, only a new
 * *arrangement* of the existing one.
 *
 * Panel 1 starts visible (the ordinary default — no
 * `initialPreviewVisibility` written at all, exactly like any other
 * node); Panels 2 and 3 start hidden, the same generic field Dropdown's
 * menu/Modal's Dialog/Toast's target already use. All three panels remain
 * fully visible and independently editable in Design regardless of this
 * authored state (DocumentNodeRenderer's own isRuntimeHidden formula is
 * Preview-only) — zero special-casing needed for that either.
 *
 * Deliberately excluded from generic dismissal (Checkpoint 1.15.6.8.3):
 * every binding here is `show`/`hide`, never `toggle`, so
 * findDismissibleRelationships' V1 signature never qualifies any of them
 * — outside-click/Escape must never close a Tab panel, and this is true
 * automatically, with no exclusion logic written for Tabs specifically.
 *
 * No ARIA tablist/tab/tabpanel semantics, no aria-selected/aria-controls,
 * no keyboard arrow navigation, and no active-tab visual styling are
 * implemented — Layoutry has no generic ARIA/attributes infrastructure to
 * build them honestly on (see the 1.15.6.11 audit's own Part 22/R). This
 * is explicitly a visual click-switching composition, not semantic Tabs.
 */
export function createBasicTabsNode(): EditorElementNode {
  const panel1Id = generateNodeId("div");
  const panel2Id = generateNodeId("div");
  const panel3Id = generateNodeId("div");

  const tab1 = tabButton("Tab 1", [
    { targetId: panel1Id, action: "show" },
    { targetId: panel2Id, action: "hide" },
    { targetId: panel3Id, action: "hide" },
  ]);
  const tab2 = tabButton("Tab 2", [
    { targetId: panel1Id, action: "hide" },
    { targetId: panel2Id, action: "show" },
    { targetId: panel3Id, action: "hide" },
  ]);
  const tab3 = tabButton("Tab 3", [
    { targetId: panel1Id, action: "hide" },
    { targetId: panel2Id, action: "hide" },
    { targetId: panel3Id, action: "show" },
  ]);

  const controls: EditorElementNode = {
    id: generateNodeId("div"),
    tag: "div",
    flowLayout: { display: "flex", flex: TAB_CONTROLS_FLEX },
    children: [tab1, tab2, tab3],
  };

  const panels: EditorElementNode = {
    id: generateNodeId("div"),
    tag: "div",
    flowLayout: { display: "flex", flex: TAB_PANELS_FLEX },
    children: [
      tabPanel(panel1Id, false, "Tab 1 Content", "This is the content for the first tab."),
      tabPanel(panel2Id, true, "Tab 2 Content", "This is the content for the second tab."),
      tabPanel(panel3Id, true, "Tab 3 Content", "This is the content for the third tab."),
    ],
  };

  return {
    id: generateNodeId("div"),
    tag: "div",
    flowLayout: { display: "flex", flex: COLLAPSIBLE_ROOT_FLEX },
    children: [controls, panels],
  };
}

const DRAWER_CONTENT_FLEX: FlexContainerSettings = {
  direction: "column",
  wrap: "nowrap",
  justifyContent: "start",
  alignItems: "stretch",
  rowGap: 12,
  columnGap: 12,
};

/**
 * Drawer (Checkpoint 1.15.6.11.3) — the exact same genuine `tag: "dialog"`
 * Modal already uses, with ordinary authored CSS distinguishing the two:
 * no `tag: "drawer"`, no `drawerSide`/`isDrawer` field, no second Dialog
 * implementation. The feasibility gate for this (proving native
 * `showModal()` can anchor to the right edge and span full height without
 * fighting DialogElement's own Preview-only centering fix) was verified
 * live BEFORE this factory was written — see this checkpoint's own report,
 * Parts A-C — and required exactly one small, generic change to
 * DialogElement itself (see its own doc comment on `hasExplicitPosition`),
 * not a Drawer-specific renderer branch.
 *
 * The Dialog authors:
 * - `position: { position: "fixed", top: 0, right: 0, bottom: 0, left:
 *   "auto" }` — reusing the pre-existing, already-generic Position field
 *   (Checkpoint 5.1-5.3). The explicit `left: "auto"` is load-bearing, not
 *   redundant: Chrome's own `dialog:modal` UA rule sets `inset: 0` (all
 *   four sides), and an author who only overrides top/right/bottom leaves
 *   the UA's own `left: 0` in effect, over-constraining the box and
 *   silently pinning it to the LEFT edge instead (confirmed live during
 *   this checkpoint's own feasibility probe).
 * - `dimensions: { preferredWidth: 360, preferredHeight: 480, offsetX: 0,
 *   offsetY: 0 }` — the same pre-existing per-node resize-stamp every
 *   resizable element already uses (Checkpoint 3.4.3), not a new concept;
 *   it is what gives the Drawer a real, editable, resizable box in Design
 *   (480 tall is a reasonable Design-mode default — full-viewport height
 *   only applies in Preview, via DialogElement's own conditional `height:
 *   auto` override reacting to the explicit `position` above).
 *
 * No `vh`/percentage unit was added anywhere: full-height in Preview comes
 * entirely from ordinary CSS abspos resolution (`top: 0; bottom: 0; height:
 * auto` -> the browser solves height to fill the gap), confirmed live to
 * track viewport height dynamically, not a one-time computed number.
 */
export function createDrawerNode(): EditorElementNode {
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
    flowLayout: { display: "flex", flex: DRAWER_CONTENT_FLEX },
    spacing: MODAL_CONTENT_SPACING,
    children: [
      { id: generateNodeId("h2"), tag: "h2", text: "Drawer" },
      { id: generateNodeId("p"), tag: "p", text: "Add navigation, settings, filters, or other content here." },
      closeButton,
    ],
  };

  const dialog: EditorElementNode = {
    id: dialogId,
    tag: "dialog",
    initialPreviewVisibility: "hidden",
    position: { position: "fixed", top: { value: 0, unit: "px" }, right: { value: 0, unit: "px" }, bottom: { value: 0, unit: "px" }, left: "auto" },
    dimensions: { preferredWidth: 360, preferredHeight: 480, offsetX: 0, offsetY: 0 },
    background: { color: "#ffffff" },
    boxShadow: applyShadowPreset("floatingCard"),
    spacing: { margin: ZERO_EDGES, padding: { top: 24, right: 24, bottom: 24, left: 24 } },
    children: [content],
  };

  const openButton: EditorElementNode = {
    id: generateNodeId("button"),
    tag: "button",
    text: "Open Drawer",
    interactions: [{ id: generateNodeId("interaction"), trigger: "click", action: "show", targetId: dialogId }],
  };

  return {
    id: generateNodeId("div"),
    tag: "div",
    flowLayout: { display: "flex", flex: COLLAPSIBLE_ROOT_FLEX },
    children: [openButton, dialog],
  };
}
