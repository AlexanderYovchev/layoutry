import type { EditorElementNode } from "@/features/editor/types/document";
import type { SvgPrimitiveKind, SvgViewBox } from "@/features/editor/types/svg";

/**
 * SVG's five dedicated single-node setters (Checkpoint 1.15.5) — same
 * immutable/structural-sharing shape every other single-field setter in
 * documentCommands.ts/borderRadiusCommands.ts/shapeCommands.ts already
 * uses: a new root only along the path that actually changed, a true
 * no-op (same reference) if nodeId doesn't exist or the value doesn't
 * change. Kept in their own file rather than folded into
 * documentCommands.ts for the same "cohesive, sizeable concern of its
 * own" reason shapeCommands.ts/borderRadiusCommands.ts already are.
 *
 * setSvgKind/setSvgViewBox are vector CONTENT (never guarded by Parent
 * Style Protection — see the store's own wiring); setSvgFill/setSvgStroke/
 * setSvgStrokeWidth are visual STYLING (guarded exactly like every other
 * CSS command). This file only implements the pure document mutation for
 * each field — the guard/no-guard decision is made once, at the store
 * layer, which is the single place that distinction actually matters.
 */
export function setSvgKind(root: EditorElementNode, nodeId: string, kind: SvgPrimitiveKind): EditorElementNode {
  if (root.id === nodeId) {
    if (root.svgKind === kind) return root;
    return { ...root, svgKind: kind };
  }

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = setSvgKind(child, nodeId, kind);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

/** Width/height are floored at 1 here — the one defensive clamp point every caller (Inspector, future programmatic writers) funnels through, matching setFreeChildGeometry's identical "the command itself never trusts the caller for safety" convention. minX/minY pass through unclamped (negative is valid). */
export function setSvgViewBox(root: EditorElementNode, nodeId: string, viewBox: SvgViewBox): EditorElementNode {
  if (root.id === nodeId) {
    const safeViewBox: SvgViewBox = {
      minX: viewBox.minX,
      minY: viewBox.minY,
      width: Math.max(1, viewBox.width),
      height: Math.max(1, viewBox.height),
    };
    if (
      root.svgViewBox?.minX === safeViewBox.minX &&
      root.svgViewBox?.minY === safeViewBox.minY &&
      root.svgViewBox?.width === safeViewBox.width &&
      root.svgViewBox?.height === safeViewBox.height
    ) {
      return root;
    }
    return { ...root, svgViewBox: safeViewBox };
  }

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = setSvgViewBox(child, nodeId, viewBox);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

export function setSvgFill(root: EditorElementNode, nodeId: string, fill: string | undefined): EditorElementNode {
  if (root.id === nodeId) {
    if (root.svgFill === fill) return root;
    return { ...root, svgFill: fill };
  }

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = setSvgFill(child, nodeId, fill);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

/** `undefined` is the real "None" state (see resolveSvgStroke) — never destructively touches svgStrokeWidth, which is preserved independently (section 17 of this checkpoint's own brief). */
export function setSvgStroke(root: EditorElementNode, nodeId: string, stroke: string | undefined): EditorElementNode {
  if (root.id === nodeId) {
    if (root.svgStroke === stroke) return root;
    return { ...root, svgStroke: stroke };
  }

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = setSvgStroke(child, nodeId, stroke);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

export function setSvgStrokeWidth(root: EditorElementNode, nodeId: string, strokeWidth: number): EditorElementNode {
  if (root.id === nodeId) {
    const safeWidth = Math.max(0, strokeWidth);
    if (root.svgStrokeWidth === safeWidth) return root;
    return { ...root, svgStrokeWidth: safeWidth };
  }

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = setSvgStrokeWidth(child, nodeId, strokeWidth);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}
