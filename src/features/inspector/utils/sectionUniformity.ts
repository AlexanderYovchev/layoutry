import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * When a multi-selection can be edited with the REAL single-selection
 * section (BC-10.4, InspectorSectionFanOut): every selected element has
 * the same tag and identical authored values for everything that section
 * reads. Then:
 * - the section's shown values (including its rendered fallbacks for
 *   unset fields, read from the shown element) are every element's
 *   values. Same tag means same default presentation, and BC-10.3 found
 *   that text elements don't inherit colour or font size from their
 *   containers in Layoutry;
 * - the settings it computes from the shown element are the right next
 *   settings for all of them, so writing them to all is exactly the edit.
 * Otherwise the multi-selection Inspector uses field-level bulk controls
 * (Mixed / Unknown) or an explicit Mixed panel.
 */
export type FanOutSection =
  | "typography"
  | "background"
  | "border"
  | "borderRadius"
  | "boxShadow"
  | "filters"
  | "transform"
  | "transition"
  | "display"
  | "position"
  | "spacing"
  | "layout"
  | "flexChild"
  | "gridChild";

/** The authored fields each section reads from its own element. */
const SECTION_FIELDS: Readonly<Record<FanOutSection, readonly (keyof EditorElementNode)[]>> = {
  typography: ["typography"],
  background: ["background"],
  border: ["border"],
  borderRadius: ["borderRadius", "shape"],
  boxShadow: ["boxShadow"],
  filters: ["filters"],
  transform: ["transform"],
  transition: ["transition"],
  display: ["display"],
  position: ["position"],
  spacing: ["spacing"],
  layout: ["layoutMode", "flowLayout", "childResizePolicy"],
  flexChild: ["flexChild"],
  gridChild: ["gridChild"],
};

/** Child sections also depend on the parent's layout (direction, tracks): those must match too. */
const PARENT_FIELDS: Partial<Record<FanOutSection, readonly (keyof EditorElementNode)[]>> = {
  flexChild: ["layoutMode", "flowLayout"],
  gridChild: ["layoutMode", "flowLayout"],
};

/** A stable text form of a plain JSON-like value (object keys sorted), for structural equality. */
export function stableJson(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const entries = Object.entries(value)
    .filter(([, child]) => child !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`).join(",")}}`;
}

function sameFields(nodes: readonly EditorElementNode[], fields: readonly (keyof EditorElementNode)[]): boolean {
  const signature = (node: EditorElementNode) => stableJson(fields.map((field) => node[field]));
  const first = signature(nodes[0]);
  return nodes.every((node) => signature(node) === first);
}

/**
 * Whether `section` can be edited for all `nodes` with the single-
 * selection editor. `parents[i]` is nodes[i]'s parent (needed for the
 * child-layout sections). False for fewer than two elements.
 */
export function isSectionUniform(
  section: FanOutSection,
  nodes: readonly EditorElementNode[],
  parents: readonly (EditorElementNode | undefined)[],
): boolean {
  if (nodes.length < 2) return false;
  if (!nodes.every((node) => node.tag === nodes[0].tag)) return false;
  if (!sameFields(nodes, SECTION_FIELDS[section])) return false;
  const parentFields = PARENT_FIELDS[section];
  if (!parentFields) return true;
  const known = parents.filter((parent): parent is EditorElementNode => parent !== undefined);
  return known.length === parents.length && sameFields(known, parentFields);
}
