/**
 * Generic, authored accessibility attributes (BC-09.2, project format 3).
 *
 * The smallest set Pagination needs, kept generic so Navbars, Breadcrumbs
 * and later components can use the same fields:
 * - `ariaLabel`: an accessible name (e.g. `<nav aria-label="Pagination">`),
 *   so a page with several navs tells them apart.
 * - `ariaCurrent`: the current item of a set (`aria-current="page"`).
 * - `disabled`: an unavailable control. Each element type gets the
 *   semantics that suit it (see rules/accessibilityAttributes.ts): a
 *   button gets the native `disabled` attribute, a link loses its href and
 *   becomes `role="link" aria-disabled="true"`. `aria-disabled` alone
 *   never stops a link from navigating, so it is never the only measure.
 *
 * This is NOT a free attribute bag: only these three fields exist, each
 * value is validated, and arbitrary attributes (event handlers, `style`,
 * `href` overrides...) can't be expressed at all.
 */

/**
 * The `aria-current` tokens (WAI-ARIA 1.2), except "false", which is the
 * same as leaving the field unset. Only "page" changes behaviour: a link
 * marked as the current page is rendered without its href (it doesn't
 * navigate to itself).
 */
export type AriaCurrentValue =
  | "page"
  | "step"
  | "location"
  | "date"
  | "time"
  | "true";
export const ARIA_CURRENT_VALUES: readonly AriaCurrentValue[] = [
  "page",
  "step",
  "location",
  "date",
  "time",
  "true",
];

/** Long enough for any real label, short enough to stay a name, not content. */
export const MAX_ARIA_LABEL_LENGTH = 250;

/** C0/C1 control characters (tab, newline and NUL included) are never part of a name. */
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/;

/**
 * Whether `label` is an acceptable stored `ariaLabel`: 1 to 250
 * characters, not only whitespace, no control characters. HTML escaping is
 * the renderers' job (React and the export printer), so quotes and angle
 * brackets are ordinary text here.
 */
export function isValidAriaLabel(label: string): boolean {
  return (
    label.length <= MAX_ARIA_LABEL_LENGTH &&
    label.trim().length > 0 &&
    !CONTROL_CHARACTERS.test(label)
  );
}

/**
 * The component markers a node can carry (BC-09.2). A marker records that
 * a subtree was inserted as that component, so the Inspector can offer its
 * management. It never changes how the node renders, and is never
 * inferred from content: a nav reading "Previous 1 2 3 Next" without the
 * marker is an ordinary nav.
 */
export type ComponentMarker = "pagination";
export const COMPONENT_MARKERS: readonly ComponentMarker[] = ["pagination"];
