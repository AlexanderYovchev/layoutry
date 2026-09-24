/**
 * Components -> Feedback & Overlays (Checkpoint 1.15.6.11.1) — the first
 * Feedback family, following the exact composition architecture Buttons/
 * Navigation/Cards/Forms/Data Display/Interactive already established.
 * The 1.15.6.11 audit's own conclusion drives every choice here: Alert and
 * a non-timed ("Manual") Toast both require ZERO new runtime architecture
 * — no `tag: "alert"`/`tag: "toast"`, no `alertVariant`/`toastVariant`/
 * `toastTimeout` field of any kind. Every factory below returns an
 * ordinary tree of existing primitives (div/h3/p/button) with concrete
 * starter style FIELDS authored directly, and — for the two interactive
 * compositions — the exact same generic `interactions`/
 * `initialPreviewVisibility` vocabulary Collapsible/Dropdown/Modal already
 * use, never a new one.
 *
 * Alert variants (Info/Success/Warning/Error) are four separate factories
 * differing only in authored background/border/title-color fields — the
 * same "separate factories, never a variant field" precedent
 * buttonCompositions.ts already established for Primary/Secondary/
 * Outline/Ghost.
 *
 * Manual Toast's target uses a real, authored `position: fixed` +
 * `zIndex` (Position Foundation, Checkpoint 5.1/5.2/5.3) to pin it to the
 * viewport's bottom-right corner — confirmed by this checkpoint's own
 * live Chromium QA that the Canvas has no transform/zoom ancestor that
 * would give `position: fixed` an unexpected containing block (unlike a
 * genuine CSS zoom implementation would), and that resolvePositionStyle's
 * own spread order (before elementPositionStyle/hostsOwnFreeChildren —
 * see ContainerElement's own doc comment) only yields to Free-layout
 * mechanics, which this composition's Toast target never uses. No
 * timeout, no ToastManager/ToastStack/notification queue — deliberately
 * deferred per the audit (Class 4, needs a new non-history runtime-timer
 * concept this checkpoint does not introduce).
 */

import { createButtonNode } from "@/features/editor/factories/elementFactories";
import { generateNodeId } from "@/features/editor/utils/generateNodeId";
import { applyShadowPreset } from "@/features/editor/types/boxShadow";
import type { BackgroundSettings } from "@/features/editor/types/background";
import type { BorderSettings } from "@/features/editor/types/border";
import type { BorderRadiusSettings } from "@/features/editor/types/borderRadius";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { FlexContainerSettings } from "@/features/editor/types/flowLayout";
import type { PositionSettings } from "@/features/editor/types/position";
import type { ElementSpacing } from "@/features/editor/types/spacing";
import { ZERO_EDGES } from "@/features/editor/types/spacing";
import type { TypographySettings } from "@/features/editor/types/typography";

interface AlertPalette {
  background: string;
  border: string;
  titleColor: string;
}

const ALERT_BODY_COLOR = "#3f3f46"; // shared across variants — only the accent (background/border/title) shifts per variant, matching this checkpoint's own "restrained styling" instruction rather than four separately-tuned body colors.

const ALERT_ROOT_FLEX: FlexContainerSettings = {
  direction: "column",
  wrap: "nowrap",
  justifyContent: "start",
  alignItems: "stretch",
  rowGap: 4,
  columnGap: 4,
};

const ALERT_PADDING: ElementSpacing = { margin: ZERO_EDGES, padding: { top: 16, right: 16, bottom: 16, left: 16 } };

const ALERT_RADIUS: BorderRadiusSettings = {
  topLeft: { value: 8, unit: "px" },
  topRight: { value: 8, unit: "px" },
  bottomRight: { value: 8, unit: "px" },
  bottomLeft: { value: 8, unit: "px" },
};

function alertBorder(color: string): BorderSettings {
  const side = { width: { value: 1, unit: "px" as const }, style: "solid" as const, color };
  return { top: side, right: side, bottom: side, left: side };
}

function alertTitle(text: string, color: string): EditorElementNode {
  const typography: TypographySettings = { fontSize: { value: 15, unit: "px" }, fontWeight: 600, color };
  return { id: generateNodeId("h3"), tag: "h3", text, typography };
}

function alertBody(text: string): EditorElementNode {
  const typography: TypographySettings = { color: ALERT_BODY_COLOR };
  return { id: generateNodeId("p"), tag: "p", text, typography };
}

/** Shared root shape every Alert variant below returns — a flat, non-elevated surface (no box-shadow, unlike Card) since an inline feedback message reads as part of the page's own content, not an elevated floating object. */
function alertRoot(palette: AlertPalette, children: EditorElementNode[]): EditorElementNode {
  const background: BackgroundSettings = { color: palette.background };
  return {
    id: generateNodeId("div"),
    tag: "div",
    flowLayout: { display: "flex", flex: ALERT_ROOT_FLEX },
    background,
    border: alertBorder(palette.border),
    borderRadius: ALERT_RADIUS,
    spacing: ALERT_PADDING,
    children,
  };
}

const INFO_PALETTE: AlertPalette = { background: "#eff6ff", border: "#bfdbfe", titleColor: "#1e40af" };
const SUCCESS_PALETTE: AlertPalette = { background: "#f0fdf4", border: "#bbf7d0", titleColor: "#166534" };
const WARNING_PALETTE: AlertPalette = { background: "#fffbeb", border: "#fde68a", titleColor: "#92400e" };
const ERROR_PALETTE: AlertPalette = { background: "#fef2f2", border: "#fecaca", titleColor: "#991b1b" };

export function createInfoAlertNode(): EditorElementNode {
  return alertRoot(INFO_PALETTE, [
    alertTitle("Information", INFO_PALETTE.titleColor),
    alertBody("Here is some helpful information."),
  ]);
}

export function createSuccessAlertNode(): EditorElementNode {
  return alertRoot(SUCCESS_PALETTE, [
    alertTitle("Success", SUCCESS_PALETTE.titleColor),
    alertBody("Your changes were saved successfully."),
  ]);
}

export function createWarningAlertNode(): EditorElementNode {
  return alertRoot(WARNING_PALETTE, [
    alertTitle("Warning", WARNING_PALETTE.titleColor),
    alertBody("Please review this before continuing."),
  ]);
}

export function createErrorAlertNode(): EditorElementNode {
  return alertRoot(ERROR_PALETTE, [
    alertTitle("Something went wrong", ERROR_PALETTE.titleColor),
    alertBody("Please check your information and try again."),
  ]);
}

/**
 * div (Flex Row) > content div (Flex Column: h3, p), Button "Dismiss"
 * (Checkpoint 1.15.6.11.1, Part 8) — the only interactive Alert this
 * checkpoint adds. Starts visible (`initialPreviewVisibility` left unset
 * — Part 9's own explicit instruction: this is a one-way reveal-then-hide
 * shape, not a hidden-until-shown one, so it must NOT be marked hidden).
 * The Dismiss Button's own `hide` binding targets the ALERT ROOT's own
 * id, known up front since both are constructed in this same factory call
 * — the same "target id known at creation time, no remapping needed
 * until duplication" shape every prior interactive composition
 * (Collapsible, Dropdown, Modal) already uses. Deliberately excluded from
 * generic dismissal (Checkpoint 1.15.6.8.3's own V1 signature requires
 * `toggle`, not `hide` — see dismissibleTargets.ts) — an Alert must never
 * disappear on an unrelated outside click or Escape, only on its own
 * explicit Dismiss.
 */
export function createDismissibleAlertNode(): EditorElementNode {
  const rootId = generateNodeId("div");

  const dismissButton: EditorElementNode = {
    ...createButtonNode(),
    text: "Dismiss",
    interactions: [{ id: generateNodeId("interaction"), trigger: "click", action: "hide", targetId: rootId }],
  };

  const content: EditorElementNode = {
    id: generateNodeId("div"),
    tag: "div",
    flowLayout: { display: "flex", flex: { ...ALERT_ROOT_FLEX, alignItems: "start" } },
    flexChild: { grow: 1, shrink: 1, basis: "auto", alignSelf: "auto" },
    spacing: { margin: ZERO_EDGES, padding: ZERO_EDGES },
    children: [alertTitle("Information", INFO_PALETTE.titleColor), alertBody("Here is some helpful information.")],
  };

  return {
    id: rootId,
    tag: "div",
    flowLayout: {
      display: "flex",
      flex: { direction: "row", wrap: "nowrap", justifyContent: "start", alignItems: "start", rowGap: 12, columnGap: 12 },
    },
    background: { color: INFO_PALETTE.background },
    border: alertBorder(INFO_PALETTE.border),
    borderRadius: ALERT_RADIUS,
    spacing: ALERT_PADDING,
    children: [content, dismissButton],
  };
}

const TOAST_CONTENT_FLEX: FlexContainerSettings = {
  direction: "column",
  wrap: "nowrap",
  justifyContent: "start",
  alignItems: "stretch",
  rowGap: 8,
  columnGap: 8,
};

const TOAST_ROOT_FLEX: FlexContainerSettings = {
  direction: "column",
  wrap: "nowrap",
  justifyContent: "start",
  alignItems: "start",
  rowGap: 12,
  columnGap: 12,
};

/**
 * Bottom-right, a modest above-content stacking value — real authored
 * PositionSettings (Checkpoint 5.1/5.2/5.3), not a new field. `zIndex: 50`
 * is a plain, ordinary authored choice (not an editor-reserved value —
 * z-index authoring here works exactly like it would for any other node);
 * Modal/Drawer-style native-`<dialog>` components need no such value at
 * all (top-layer promotion already ignores document z-index — see
 * CanvasInteractionBoundary's own `isolation: isolate` comment), but this
 * Toast is an ordinary Container, not a native dialog, so it genuinely
 * needs one to reliably paint above ordinary page content.
 */
const TOAST_POSITION: PositionSettings = {
  position: "fixed",
  right: { value: 24, unit: "px" },
  bottom: { value: 24, unit: "px" },
  zIndex: 50,
};

/**
 * div (wrapper) > Button "Show Toast", Toast div (Checkpoint 1.15.6.11.1,
 * Part 14) — a MANUAL Toast only: Show uses `show` (not `toggle` — Part
 * 16's own explicit instruction, since "show" is the semantically correct
 * one-way reveal a repeated click should never accidentally undo), Close
 * uses `hide`. The Toast target's own id is known up front, exactly like
 * Dismissible Alert above. `initialPreviewVisibility: "hidden"` is what
 * makes it start hidden the moment Preview begins (Design still renders
 * it fully, per DocumentNodeRenderer's own isRuntimeHidden formula — zero
 * new code needed for that, the same free behavior Dropdown/Modal already
 * proved). Deliberately excluded from generic dismissal for the same
 * reason as Dismissible Alert: `show`/`hide`, never `toggle`.
 */
export function createManualToastNode(): EditorElementNode {
  const toastId = generateNodeId("div");

  const showButton: EditorElementNode = {
    ...createButtonNode(),
    text: "Show Toast",
    interactions: [{ id: generateNodeId("interaction"), trigger: "click", action: "show", targetId: toastId }],
  };

  const closeButton: EditorElementNode = {
    ...createButtonNode(),
    text: "Close",
    interactions: [{ id: generateNodeId("interaction"), trigger: "click", action: "hide", targetId: toastId }],
  };

  const toast: EditorElementNode = {
    id: toastId,
    tag: "div",
    initialPreviewVisibility: "hidden",
    flowLayout: { display: "flex", flex: TOAST_ROOT_FLEX },
    background: { color: "#ffffff" },
    border: alertBorder("#e4e4e7"),
    borderRadius: ALERT_RADIUS,
    boxShadow: applyShadowPreset("floatingCard"),
    spacing: { margin: ZERO_EDGES, padding: { top: 16, right: 16, bottom: 16, left: 16 } },
    position: TOAST_POSITION,
    children: [
      {
        id: generateNodeId("div"),
        tag: "div",
        flowLayout: { display: "flex", flex: TOAST_CONTENT_FLEX },
        spacing: { margin: ZERO_EDGES, padding: ZERO_EDGES },
        children: [
          { id: generateNodeId("h3"), tag: "h3", text: "Notice", typography: { fontSize: { value: 15, unit: "px" }, fontWeight: 600, color: "#18181b" } },
          alertBody("This is a manually dismissed toast message."),
        ],
      },
      closeButton,
    ],
  };

  return {
    id: generateNodeId("div"),
    tag: "div",
    flowLayout: { display: "flex", flex: { direction: "column", wrap: "nowrap", justifyContent: "start", alignItems: "start", rowGap: 0, columnGap: 0 } },
    children: [showButton, toast],
  };
}

const POPOVER_ROOT_FLEX: FlexContainerSettings = {
  direction: "column",
  wrap: "nowrap",
  justifyContent: "start",
  alignItems: "start",
  rowGap: 8,
  columnGap: 8,
};

const POPOVER_PANEL_FLEX: FlexContainerSettings = {
  direction: "column",
  wrap: "nowrap",
  justifyContent: "start",
  alignItems: "stretch",
  rowGap: 8,
  columnGap: 8,
};

/**
 * div (Flex Column) > Button "Open Popover" (click->toggle->panel), Panel
 * div (Flex Column, initialPreviewVisibility: hidden) > h3, p (Checkpoint
 * 1.15.6.11.2). Architecturally identical to createDropdownButtonNode
 * (interactionCompositions.ts) — the 1.15.6.11 audit's own conclusion was
 * that Popover IS Dropdown's own pattern under a different name, so this
 * deliberately reuses it verbatim rather than inventing a second one:
 * the same managed Flex-Column stacked layout (trigger above panel, no
 * Free/absolute positioning, no anchored/floating overlay system — kept
 * out per this checkpoint's own explicit "keep V1 simple" instruction),
 * the same single `click -> toggle -> panel.id` binding, and the same
 * `initialPreviewVisibility: "hidden"` on the panel. Generic dismissal
 * (Checkpoint 1.15.6.8.3) already qualifies this relationship with zero
 * new code, exactly like Dropdown's own menu.
 */
export function createPopoverNode(): EditorElementNode {
  const panelId = generateNodeId("div");

  const trigger: EditorElementNode = {
    ...createButtonNode(),
    text: "Open Popover",
    interactions: [{ id: generateNodeId("interaction"), trigger: "click", action: "toggle", targetId: panelId }],
  };

  const panel: EditorElementNode = {
    id: panelId,
    tag: "div",
    initialPreviewVisibility: "hidden",
    flowLayout: { display: "flex", flex: POPOVER_PANEL_FLEX },
    background: { color: "#ffffff" },
    border: alertBorder("#e4e4e7"),
    borderRadius: ALERT_RADIUS,
    boxShadow: applyShadowPreset("medium"),
    spacing: { margin: ZERO_EDGES, padding: { top: 16, right: 16, bottom: 16, left: 16 } },
    children: [
      { id: generateNodeId("h3"), tag: "h3", text: "Popover Title", typography: { fontSize: { value: 15, unit: "px" }, fontWeight: 600, color: "#18181b" } },
      alertBody("Popover content goes here."),
    ],
  };

  return {
    id: generateNodeId("div"),
    tag: "div",
    flowLayout: { display: "flex", flex: POPOVER_ROOT_FLEX },
    children: [trigger, panel],
  };
}
