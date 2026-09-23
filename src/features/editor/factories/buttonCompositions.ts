/**
 * Components -> Buttons (Checkpoint 1.15.6.2) — the first real Components
 * family. Every factory here follows this checkpoint's own fundamental
 * rule: a Component is a preconfigured COMPOSITION OF EXISTING PRIMITIVES,
 * never a proprietary document node type. Primary/Secondary/Outline/Ghost
 * Button are each just the existing `button` primitive (see
 * createButtonNode in elementFactories.ts, which this file deliberately
 * does not touch or replace) with concrete starter style FIELDS authored
 * directly — no `buttonVariant` flag, no new EditorElementNode field of
 * any kind. Button Group and Dropdown Button are each just a `div`
 * composed of ordinary `button`/`a` children, following the exact
 * precedent createFooterCompositionNode already established (Checkpoint
 * 1.12.1) — a whole subtree built inline on one returned node, so one
 * `insertElement` call is still exactly one history entry, with zero new
 * architecture required.
 *
 * These live in their own file (unlike footerComposition, which stayed in
 * elementFactories.ts) as the seam this checkpoint's own brief asks for:
 * a future Components family (Navigation, Cards, ...) gets its own sibling
 * file next to this one, never a rewrite of elementFactories.ts itself,
 * which keeps owning the single FACTORIES_BY_TYPE dispatch map every
 * factory (primitive or composition) registers into.
 *
 * IMPORTANT — why ButtonElement.tsx needed no changes: its Tailwind
 * chrome classes (bg-zinc-900/text-white/px-4 py-2/text-sm font-medium)
 * are UNCONDITIONAL, unlike ContainerElement's own legacy classes (which
 * gate behind `!node.background` etc.) — only border-radius/shadow chrome
 * are gated there. That means every style field a preset actually cares
 * about (background, typography.color, spacing, borderRadius) must be
 * explicitly authored below, even where the desired look happens to
 * match the existing dark default — leaving a field unset would NOT
 * "inherit a neutral default," it would keep the dark chrome class
 * active underneath. Outline/Ghost specifically depend on this: without
 * an explicit `typography.color`, the unconditional `text-white` class
 * would render white text on a light/transparent background.
 */

import { generateNodeId } from "@/features/editor/utils/generateNodeId";
import { DEFAULT_LINK_HREF } from "@/features/editor/types/link";
import type { BackgroundSettings } from "@/features/editor/types/background";
import type { BorderRadiusSettings } from "@/features/editor/types/borderRadius";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { FlexContainerSettings } from "@/features/editor/types/flowLayout";
import type { ElementSpacing } from "@/features/editor/types/spacing";
import type { TypographySettings } from "@/features/editor/types/typography";

/** Shared by every Button preset below — a modest, legible starting point, not a design system. */
const BUTTON_PRESET_RADIUS: BorderRadiusSettings = {
  topLeft: { value: 6, unit: "px" },
  topRight: { value: 6, unit: "px" },
  bottomRight: { value: 6, unit: "px" },
  bottomLeft: { value: 6, unit: "px" },
};

const BUTTON_PRESET_SPACING: ElementSpacing = {
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
  padding: { top: 10, right: 20, bottom: 10, left: 20 },
};

function buttonPresetNode(text: string, background: BackgroundSettings | undefined, typography: TypographySettings): EditorElementNode {
  return {
    id: generateNodeId("button"),
    tag: "button",
    text,
    background,
    typography,
    borderRadius: BUTTON_PRESET_RADIUS,
    spacing: BUTTON_PRESET_SPACING,
  };
}

/** Solid, high-emphasis — matches the plain Button primitive's own default dark chrome, now as real authored fields the user can see and edit immediately, rather than invisible fallback classes. */
export function createPrimaryButtonNode(): EditorElementNode {
  return buttonPresetNode("Button", { color: "#18181b" }, { color: "#ffffff" });
}

/** Lighter, medium-emphasis. */
export function createSecondaryButtonNode(): EditorElementNode {
  return buttonPresetNode("Button", { color: "#f4f4f5" }, { color: "#18181b" });
}

/** Transparent fill, visible border — background must be explicit (see this file's own top comment on why an unset field would NOT stay transparent here). */
export function createOutlineButtonNode(): EditorElementNode {
  return {
    ...buttonPresetNode("Button", { color: "transparent" }, { color: "#18181b" }),
    border: {
      top: { width: { value: 1, unit: "px" }, style: "solid", color: "#d4d4d8" },
      right: { width: { value: 1, unit: "px" }, style: "solid", color: "#d4d4d8" },
      bottom: { width: { value: 1, unit: "px" }, style: "solid", color: "#d4d4d8" },
      left: { width: { value: 1, unit: "px" }, style: "solid", color: "#d4d4d8" },
    },
  };
}

/** Minimal — no fill, no border, just legible text; the lowest-emphasis preset. */
export function createGhostButtonNode(): EditorElementNode {
  return buttonPresetNode("Button", { color: "transparent" }, { color: "#18181b" });
}

const BUTTON_GROUP_FLEX: FlexContainerSettings = {
  direction: "row",
  wrap: "nowrap",
  justifyContent: "start",
  alignItems: "center",
  rowGap: 8,
  columnGap: 8,
};

/**
 * Container > Button x3 (Checkpoint 1.15.6.2, section 17) — an ordinary
 * Flex Row wrapper around three ordinary Button primitives, each with its
 * own fresh id and independently selectable/resizable/editable, exactly
 * like any other Flow/Flex parent-child pair already is. No proprietary
 * ButtonGroup node; deleting the wrapper's own flowLayout would leave
 * three buttons stacked in plain Block flow, which is a perfectly valid
 * (if less useful) fallback, not a broken state.
 */
export function createButtonGroupNode(): EditorElementNode {
  return {
    id: generateNodeId("div"),
    tag: "div",
    flowLayout: { display: "flex", flex: BUTTON_GROUP_FLEX },
    spacing: { margin: { top: 0, right: 0, bottom: 0, left: 0 }, padding: { top: 0, right: 0, bottom: 0, left: 0 } },
    children: [
      { id: generateNodeId("button"), tag: "button", text: "Option 1" },
      { id: generateNodeId("button"), tag: "button", text: "Option 2" },
      { id: generateNodeId("button"), tag: "button", text: "Option 3" },
    ],
  };
}

const DROPDOWN_ROOT_FLEX: FlexContainerSettings = {
  direction: "column",
  wrap: "nowrap",
  justifyContent: "start",
  alignItems: "stretch",
  rowGap: 8,
  columnGap: 8,
};

const DROPDOWN_MENU_FLEX: FlexContainerSettings = {
  direction: "column",
  wrap: "nowrap",
  justifyContent: "start",
  alignItems: "stretch",
  rowGap: 4,
  columnGap: 4,
};

/**
 * Container > (Button, Container > Link x3) (Checkpoint 1.15.6.2,
 * sections 19-27; upgraded in Checkpoint 1.15.6.8.1 using the generic
 * interaction foundation proven by Collapsible). The Button now carries
 * an ordinary `click -> toggle -> menu.id` binding — the exact same
 * generic `EditorElementNode.interactions` field Collapsible uses, never
 * a Dropdown-specific `dropdownOpen`/`dropdownTargetId` field — and the
 * menu Container carries an authored `initialPreviewVisibility: "hidden"`
 * (Checkpoint 1.15.6.8.1's own generic addition, also not Dropdown-
 * specific: any node can use it). In DESIGN the menu still renders fully
 * visible/selectable/editable regardless of that authored value — see
 * DocumentNodeRenderer's own runtime-visibility check, which only ever
 * applies while `editorMode === "preview"`. In a fresh PREVIEW session
 * the menu starts closed with no click required (seeded by
 * buildInitialRuntimeVisibility on enterPreview), and the Button's own
 * binding toggles it open/closed exactly like Collapsible's content.
 *
 * The whole tree still uses ordinary managed Flex layout (root: column,
 * trigger Button above the menu Container), not Free/absolute
 * positioning or any floating/anchored overlay system — deliberately
 * deferred (see this checkpoint's own report, Part I): true anchored
 * positioning, viewport-collision handling, and outside-click/Escape
 * dismissal are all real future capabilities, not smuggled in here as
 * Dropdown-specific behavior.
 */
export function createDropdownButtonNode(): EditorElementNode {
  const menu: EditorElementNode = {
    id: generateNodeId("div"),
    tag: "div",
    flowLayout: { display: "flex", flex: DROPDOWN_MENU_FLEX },
    background: { color: "#ffffff" },
    border: {
      top: { width: { value: 1, unit: "px" }, style: "solid", color: "#e4e4e7" },
      right: { width: { value: 1, unit: "px" }, style: "solid", color: "#e4e4e7" },
      bottom: { width: { value: 1, unit: "px" }, style: "solid", color: "#e4e4e7" },
      left: { width: { value: 1, unit: "px" }, style: "solid", color: "#e4e4e7" },
    },
    borderRadius: BUTTON_PRESET_RADIUS,
    spacing: { margin: { top: 0, right: 0, bottom: 0, left: 0 }, padding: { top: 8, right: 8, bottom: 8, left: 8 } },
    initialPreviewVisibility: "hidden",
    children: [
      { id: generateNodeId("a"), tag: "a", text: "Item 1", href: DEFAULT_LINK_HREF },
      { id: generateNodeId("a"), tag: "a", text: "Item 2", href: DEFAULT_LINK_HREF },
      { id: generateNodeId("a"), tag: "a", text: "Item 3", href: DEFAULT_LINK_HREF },
    ],
  };

  const trigger: EditorElementNode = {
    id: generateNodeId("button"),
    tag: "button",
    text: "Menu",
    interactions: [{ id: generateNodeId("interaction"), trigger: "click", action: "toggle", targetId: menu.id }],
  };

  return {
    id: generateNodeId("div"),
    tag: "div",
    flowLayout: { display: "flex", flex: DROPDOWN_ROOT_FLEX },
    spacing: { margin: { top: 0, right: 0, bottom: 0, left: 0 }, padding: { top: 0, right: 0, bottom: 0, left: 0 } },
    children: [trigger, menu],
  };
}
