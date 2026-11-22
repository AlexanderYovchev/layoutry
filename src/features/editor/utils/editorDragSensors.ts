import { PointerSensor } from "@dnd-kit/core";

/**
 * BC-12.3 (D12) — the editor's dnd-kit pointer sensor. One class, because
 * dnd-kit binds one listener per event name: a second sensor with its own
 * onPointerDown activator would silently replace the first.
 *
 * The activation rule is chosen from the pointerdown that starts it:
 * - a TOUCH on a Structure drag handle: a short press first
 *   (STRUCTURE_TOUCH_ACTIVATION; moving more than the tolerance before
 *   that cancels it). The handle has touch-action:none, the rest of the
 *   tree scrolls normally;
 * - everything else (mouse, pen, touch on the Canvas or a catalog tile):
 *   the options it was created with — the existing 4px distance, unchanged.
 * Only the primary button activates (dnd-kit's own check), so right-click
 * never drags.
 */

type PointerSensorProps = ConstructorParameters<typeof PointerSensor>[0];

/** A deliberate press before a touch drag of a Structure row starts. Tunable. */
export const STRUCTURE_TOUCH_ACTIVATION = { delay: 200, tolerance: 8 };

export function isTouchOnStructureHandle(event: Event): boolean {
  return (
    typeof PointerEvent !== "undefined" &&
    event instanceof PointerEvent &&
    event.pointerType === "touch" &&
    event.target instanceof Element &&
    event.target.closest("[data-structure-drag-handle]") !== null
  );
}

export class EditorPointerSensor extends PointerSensor {
  constructor(props: PointerSensorProps) {
    super(isTouchOnStructureHandle(props.event) ? { ...props, options: { ...props.options, activationConstraint: STRUCTURE_TOUCH_ACTIVATION } } : props);
  }
}
