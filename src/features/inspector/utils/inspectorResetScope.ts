/**
 * Which Inspector controls a reset button covers (BC-05.2).
 *
 * Every InspectorResetButton is marked with RESET_BUTTON_ATTRIBUTE. The
 * property row, segmented row, number row, colour field and section that
 * contain a reset button are marked with RESET_SCOPE_ATTRIBUTE: a reset
 * button covers exactly the controls of its nearest marked ancestor (its
 * row, or the whole section for a section-level reset such as "Reset
 * transform"). Two rules use that:
 *
 * - An open edit session in a covered field is cancelled, not committed,
 *   when that reset is pressed, so the reset is one Undo step and a
 *   half-typed draft never becomes its own entry (useInspectorEditSession).
 * - After a keyboard reset, focus moves to the covered property's own
 *   control, because the reset button hides itself once there is nothing
 *   left to reset (InspectorResetButton).
 */
export const RESET_BUTTON_ATTRIBUTE = "data-inspector-reset";
export const RESET_SCOPE_ATTRIBUTE = "data-inspector-reset-scope";

/** Spread onto the root element of a component that can hold a reset button. */
export const resetScopeProps = { [RESET_SCOPE_ATTRIBUTE]: "" } as const;

/** The nearest scope element of a reset button. */
export function resetScopeOf(button: Element): Element | null {
  return button.closest(`[${RESET_SCOPE_ATTRIBUTE}]`);
}

/** True when `target` is (inside) a reset button whose scope contains `field`. */
export function isResetCovering(
  target: EventTarget | null,
  field: Element,
): boolean {
  if (!(target instanceof Element)) return false;
  const button = target.closest(`[${RESET_BUTTON_ATTRIBUTE}]`);
  if (!button) return false;
  const scope = resetScopeOf(button);
  return scope !== null && scope.contains(field);
}

const FOCUS_CANDIDATES = [
  "button[aria-pressed='true']:not(:disabled)",
  "input:not([type='color']):not([type='hidden']):not(:disabled)",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
].join(", ");

/**
 * The control a keyboard user lands on after resetting what this scope
 * holds: the first selected segmented option or text/number/select field
 * in document order (for a row, its own control; for a section, its first
 * property), otherwise its first other button (for a section, its header).
 * Never another reset button, a help icon, or anything inside a collapsed
 * (inert) section body.
 */
export function resetFocusTarget(scope: Element): HTMLElement | null {
  // A collapsed section's body is inert and can't take focus.
  const reachable = (element: Element) => element.closest("[inert]") === null;
  // Sorted explicitly: not every selector engine returns a selector list in document order.
  const control = Array.from(
    scope.querySelectorAll<HTMLElement>(FOCUS_CANDIDATES),
  )
    .sort((a, b) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
    )
    .find(reachable);
  if (control) return control;
  const buttons = Array.from(
    scope.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
  );
  return (
    buttons.find(
      (button) =>
        reachable(button) &&
        !button.hasAttribute(RESET_BUTTON_ATTRIBUTE) &&
        !button.hasAttribute("data-inspector-help"),
    ) ?? null
  );
}
