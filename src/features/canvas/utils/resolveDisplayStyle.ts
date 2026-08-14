import { getDisplaySettings, isValidDisplayFieldValue } from "@/features/editor/types/display";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { CSSProperties } from "react";

/**
 * Pure Canvas resolver for a node's own display/visibility/overflow/
 * interaction CSS (Checkpoint 4.8) — same shape as resolveFilterStyle:
 * emits CSS only for fields actually present and structurally valid,
 * never a guessed default, never throws on malformed loaded-document
 * data (a field that fails isValidDisplayFieldValue is skipped on its
 * own, without preventing every other valid field in the same settings
 * object from still rendering).
 *
 * Every field maps onto its own React CSSProperties key with no
 * formatting step (unlike shadow/filter values, every one of these is
 * already a literal CSS keyword) — written as one explicit block per
 * field (matching resolveBorderRadiusStyle/formatFilterFunctionCss's own
 * "explicit switch/branches over a generic computed-key assignment"
 * precedent) rather than a loop, since TypeScript can't correlate a
 * union-typed loop variable back to CSSProperties' own differently-typed
 * key for each iteration.
 *
 * Deliberately spread AFTER resolveFlowLayoutStyle in every element that
 * calls both (currently only ContainerElement): a container's own
 * `display` here (block/inline/inline-block/none) always wins over
 * flowLayout's own flex/grid arrangement default when explicitly set,
 * matching ordinary CSS authoring (the most specific/most recently
 * applied declaration for a single property wins) — this is a
 * documented, intentional interaction between the two Inspector
 * sections, not a silent bug. "none" is the common, meaningful case
 * (hide the whole element); overriding an active Flex/Grid arrangement
 * with plain "block"/"inline"/"inline-block" is rarer but still an
 * honest, explicit user choice this resolver must respect.
 */
export function resolveDisplayStyle(node: EditorElementNode): CSSProperties {
  const settings = getDisplaySettings(node);
  const style: CSSProperties = {};

  if (settings.display !== undefined && isValidDisplayFieldValue("display", settings.display)) {
    style.display = settings.display;
  }
  if (settings.visibility !== undefined && isValidDisplayFieldValue("visibility", settings.visibility)) {
    style.visibility = settings.visibility;
  }
  // Overflow precedence (Checkpoint 5.4): a valid unified `overflow`
  // shorthand always wins outright over overflowX/overflowY — by
  // construction (withAllOverflow/withOverflowAxis) the two are mutually
  // exclusive, so a valid shorthand means the per-axis fields, if present
  // at all, are stale leftovers from before the node was last committed
  // in Linked mode. Only when the shorthand is absent OR itself malformed
  // does this fall back to the per-axis longhands, each validated and
  // emitted fully independently — a malformed overflowX must never
  // suppress a valid overflowY, or vice versa, and neither may suppress
  // any other Display field above/below. This mirrors, rather than
  // fights, React's own DOM behavior: setting `overflow` and
  // `overflowX`/`overflowY` in the same inline style object is exactly
  // the "shorthand plus longhand for the same box" pattern the legacy
  // resize-clip default (see elementDimensionsStyle's clipOverflowY,
  // gated off the moment any of these three fields is present — see
  // HeadingElement/ParagraphElement/ButtonElement) was already written
  // to avoid colliding with.
  if (settings.overflow !== undefined && isValidDisplayFieldValue("overflow", settings.overflow)) {
    style.overflow = settings.overflow;
  } else {
    if (settings.overflowX !== undefined && isValidDisplayFieldValue("overflowX", settings.overflowX)) {
      style.overflowX = settings.overflowX;
    }
    if (settings.overflowY !== undefined && isValidDisplayFieldValue("overflowY", settings.overflowY)) {
      style.overflowY = settings.overflowY;
    }
  }
  if (settings.pointerEvents !== undefined && isValidDisplayFieldValue("pointerEvents", settings.pointerEvents)) {
    style.pointerEvents = settings.pointerEvents;
  }
  if (settings.cursor !== undefined && isValidDisplayFieldValue("cursor", settings.cursor)) {
    style.cursor = settings.cursor;
  }
  if (settings.userSelect !== undefined && isValidDisplayFieldValue("userSelect", settings.userSelect)) {
    style.userSelect = settings.userSelect;
  }

  return style;
}
