import { getProgressMax } from "@/features/editor/types/progress";
import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * Sets nodeId's own determinate Value (Checkpoint 1.15.6.12.4) — only
 * meaningful for `tag: "progress"` (wrong-tag targets are a safe no-op,
 * matching setTableColumnCount's own tag-guard shape). `value: undefined`
 * is the genuine, intentional way to ENTER indeterminate state — see
 * setElementProgressIndeterminate, which is the Inspector's own dedicated
 * entry point for that transition, but this command honors `undefined`
 * directly too since it's the same semantic write either way. A defined
 * value is clamped to `[0, effective Max]` here, at write time — an
 * editor-owned policy (Part G of this checkpoint's own brief), not left to
 * rely on native browser coercion, which only affects the rendered IDL
 * property and would silently let the document itself drift out of range.
 * No-op-guarded: committing the exact already-clamped value again pushes
 * no history entry.
 */
export function setElementProgressValue(
  root: EditorElementNode,
  nodeId: string,
  value: number | undefined,
): EditorElementNode {
  if (root.id === nodeId) {
    if (root.tag !== "progress") return root;

    const nextValue = value === undefined || !Number.isFinite(value)
      ? undefined
      : Math.min(Math.max(value, 0), getProgressMax(root));

    if (root.progressValue === nextValue) return root;
    return { ...root, progressValue: nextValue };
  }

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = setElementProgressValue(child, nodeId, value);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

/**
 * Sets nodeId's own Max (Checkpoint 1.15.6.12.4) — only meaningful for
 * `tag: "progress"`. Native Max must be greater than zero (verified live);
 * an authored value that isn't is clamped up to a minimum of 1 here,
 * rather than silently falling through to native HTML's own obscure "max
 * omitted/invalid" default of 1 at render time only (which would leave the
 * DOCUMENT holding an invalid value the Inspector itself would then have
 * to special-case).
 *
 * Atomic coherence (Part T/U of this checkpoint's own brief): if a
 * currently-determinate Value would exceed the NEW Max, it is clamped down
 * to the new Max in this exact same immutable write — one node replacement,
 * one history step, never two separate commands/entries for what is
 * conceptually a single coherent edit (shrinking Max to 50 while Value is
 * 80 produces `{ max: 50, value: 50 }` in one commit, the same way
 * setTableHeaderEnabled's own Caption-position fix stays a single
 * structural rewrite). An indeterminate Progress (`progressValue`
 * undefined) is untouched by this clamp — there is no determinate value to
 * exceed anything. No-op-guarded on both fields together.
 */
export function setElementProgressMax(
  root: EditorElementNode,
  nodeId: string,
  max: number,
): EditorElementNode {
  if (root.id === nodeId) {
    if (root.tag !== "progress") return root;

    const nextMax = Number.isFinite(max) && max > 0 ? max : 1;
    const nextValue = root.progressValue === undefined ? undefined : Math.min(Math.max(root.progressValue, 0), nextMax);

    if (root.progressMax === nextMax && root.progressValue === nextValue) return root;
    return { ...root, progressMax: nextMax, progressValue: nextValue };
  }

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = setElementProgressMax(child, nodeId, max);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

/**
 * The Inspector's own Indeterminate toggle entry point (Checkpoint
 * 1.15.6.12.4) — switching ON clears `progressValue` entirely (the single
 * source of truth for indeterminate state, see types/progress.ts's own top
 * comment); switching OFF restores a sensible determinate value rather
 * than leaving the node stuck with no value at all. No hidden
 * "remembered previous value" state is stored anywhere (this checkpoint's
 * brief explicitly prefers a simple, canonical model over extra persisted
 * state for a cosmetic restore-UX convenience): the restored value is
 * always `effective Max / 2`, rounded — scales sensibly with whatever Max
 * currently is (matching the factory's own 50/100 starter when Max is
 * still 100) rather than a hardcoded constant that could land outside an
 * unusual Max. No-op-guarded.
 */
export function setElementProgressIndeterminate(
  root: EditorElementNode,
  nodeId: string,
  indeterminate: boolean,
): EditorElementNode {
  if (root.id === nodeId) {
    if (root.tag !== "progress") return root;

    const currentlyIndeterminate = root.progressValue === undefined;
    if (currentlyIndeterminate === indeterminate) return root;

    const nextValue = indeterminate ? undefined : Math.round(getProgressMax(root) / 2);
    return { ...root, progressValue: nextValue };
  }

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = setElementProgressIndeterminate(child, nodeId, indeterminate);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}
