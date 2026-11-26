import type { EditorElementNode } from "@/features/editor/types/document";
import { getLayoutMode } from "@/features/editor/types/layout";
import type { StateAtom } from "@/features/editor/types/styleRules";

/**
 * BC-17.2 — context predicates (BC-17.1.3 Report 1 §5.6, Report 2 A1–A2).
 * Whether a capability applies to a node IN ITS CURRENT CONTEXT (parent
 * layout, own position, display), with one of two kinds of "no":
 *
 * - inapplicable: the CSS would have no effect here (a CSS fact);
 * - limitation: the CSS would work, but the editor deliberately doesn't
 *   offer it here (an editor fact, with its reason).
 *
 * Pure: reads only the document model, never the DOM, never mutates.
 */

export type StylingApplicability =
  | { status: "applicable" }
  | { status: "inapplicable"; reason: string }
  | { status: "limitation"; reason: string };

const APPLICABLE: StylingApplicability = { status: "applicable" };
const inapplicable = (reason: string): StylingApplicability => ({
  status: "inapplicable",
  reason,
});
const limitation = (reason: string): StylingApplicability => ({
  status: "limitation",
  reason,
});

export type ContextCapability =
  | "float"
  | "clear"
  | "shapeOutside"
  | "physicalInsets"
  | "logicalInsets"
  | "logicalSize"
  | "firstLine"
  | "firstLetter";

export type ParentLayout = "flow" | "flex" | "grid" | "free" | "none";

/** How the parent lays this node out. */
export function parentLayoutOf(
  parent: EditorElementNode | undefined,
): ParentLayout {
  if (!parent) return "none";
  if (getLayoutMode(parent) === "free") return "free";
  const display = parent.flowLayout?.display;
  return display === "flex" ? "flex" : display === "grid" ? "grid" : "flow";
}

function isOutOfFlow(node: EditorElementNode): boolean {
  const position = node.position?.position;
  return position === "absolute" || position === "fixed";
}

/** Inline, flex and grid boxes are not block containers, so ::first-line/::first-letter don't apply. */
function isBlockContainer(node: EditorElementNode): boolean {
  const ownLayout = node.flowLayout?.display;
  if (ownLayout === "flex" || ownLayout === "grid") return false;
  const display = node.display?.display;
  return display !== "inline";
}

const FREE_CHILD_GEOMETRY =
  "A Free-layout child is placed by its own geometry (left/top/width/height), which the Canvas owns.";

export function evaluateContextCapability(
  capability: ContextCapability,
  node: EditorElementNode,
  parent: EditorElementNode | undefined,
  facts: { float?: string } = {},
): StylingApplicability {
  const layout = parentLayoutOf(parent);
  switch (capability) {
    case "float":
    case "clear":
      if (layout === "free")
        return inapplicable(
          "Free-layout children are absolutely positioned, so float has no effect.",
        );
      if (layout === "flex")
        return inapplicable("Float has no effect on a Flexbox item.");
      if (layout === "grid")
        return inapplicable("Float has no effect on a Grid item.");
      if (isOutOfFlow(node))
        return inapplicable(
          "Float has no effect on an absolutely or fixed positioned element.",
        );
      return APPLICABLE;
    case "shapeOutside": {
      const floating = evaluateContextCapability("float", node, parent);
      if (floating.status !== "applicable") return floating;
      return facts.float === undefined || facts.float === "none"
        ? inapplicable("Needs a float.")
        : APPLICABLE;
    }
    case "physicalInsets":
    case "logicalInsets":
    case "logicalSize":
      return layout === "free" ? limitation(FREE_CHILD_GEOMETRY) : APPLICABLE;
    case "firstLine":
    case "firstLetter":
      return isBlockContainer(node)
        ? APPLICABLE
        : inapplicable(
            "Only block containers have a first line (not inline, Flexbox or Grid containers).",
          );
  }
}

/** Fields that may only be authored for the Default state (editor limitations, Report 1 §4.10.3, §4.11.2). */
export const DEFAULT_STATE_ONLY_TYPOGRAPHY_FIELDS: readonly string[] = [
  "direction",
  "unicodeBidi",
  "writingMode",
  "textOrientation",
];
export const DIRECTION_STATE_LIMITATION =
  "Direction and writing mode can only be set for the Default state: a state-dependent direction would make the logical-side mapping unpredictable.";
export const COUNTER_STATE_LIMITATION =
  "Counters can only be changed in the Default state: changing them on hover or focus would renumber unrelated elements.";

const VECTOR_SELF_FOCUS: ReadonlySet<StateAtom> = new Set([
  "focus",
  "focus-visible",
  "focus-within",
]);

/**
 * Vector objects are never focusable (no tabindex, role, link or
 * interaction is authored on them; Report 3 §7.5.2), so their own focus
 * states can never match. Focus styling of a graphic comes from its
 * focusable ancestor (an ancestor condition), which stays applicable.
 */
export function vectorObjectSelfAtomApplicability(
  atom: StateAtom,
): StylingApplicability {
  return VECTOR_SELF_FOCUS.has(atom)
    ? inapplicable(
        "Vector objects can't receive keyboard focus; style the focusable element that contains the graphic instead.",
      )
    : APPLICABLE;
}
