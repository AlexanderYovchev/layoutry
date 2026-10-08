export interface OffsetBoxSize {
  width: number;
  height: number;
}

/**
 * The narrow Flow-resize geometry fix approved by Checkpoint 1.15.6.14.2.1's
 * feasibility audit (Part T/52 of that report) — `element.offsetWidth`/
 * `offsetHeight` instead of `getBoundingClientRect()`'s width/height.
 * Confirmed live in that audit's own Chromium probe to be byte-identical
 * across none/translate/rotate/scale/combined, on the element itself AND
 * under any transformed ancestor, while still correctly reflecting a
 * currently-rendered, parent-clamped size (the exact property
 * computeResizeResult's own startWidth/startHeight doc comment already
 * relies on) — getBoundingClientRect() would instead report the PAINTED
 * (transformed) box, silently baking a scale factor into stored
 * preferredWidth/preferredHeight across repeated resize cycles.
 */
export function measureOffsetBoxSize(canvasRoot: HTMLElement | null, nodeId: string): OffsetBoxSize | null {
  const target = canvasRoot?.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(nodeId)}"]`);
  if (!target) return null;
  return { width: target.offsetWidth, height: target.offsetHeight };
}
