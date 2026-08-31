import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * The Option child (if any) authored as this Select's default selection
 * (Checkpoint 1.13) — see EditorElementNode.selected's own doc comment.
 * setSelectSelectedOption is the only mutation path and always clears
 * every sibling before setting one, so under normal operation at most
 * one child ever has selected:true; if more than one somehow does (e.g.
 * hand-edited/imported data), the first one found wins — the same
 * "first match, don't guess further" resolution every other unvalidated-
 * external-data read in this app already uses.
 */
export function findSelectedOption(node: EditorElementNode): EditorElementNode | undefined {
  return node.children?.find((child) => child.selected === true);
}

/**
 * The value a rendered <select>'s own `defaultValue` should be, derived
 * from whichever child Option is authored selected (Checkpoint 1.13) —
 * the single source of truth SelectElement renders from, instead of
 * independently rendering `<option selected>` on each Option's own DOM
 * node. React's own documentation recommends driving an uncontrolled
 * select via `<select defaultValue>` matched against its options' `value`
 * props; a plain `selected` HTML attribute on a React-rendered `<option>`
 * is not reliably reconciled the same way, and mixing the two models
 * (some selection state read from the DOM attribute, some from
 * `<select>`'s own prop) is exactly the inconsistency this checkpoint's
 * brief warned against — so `selected` is authored document state only,
 * never rendered as an `<option>` DOM attribute anywhere.
 *
 * Mirrors a native `<option>`'s own value-attribute-or-text-content
 * fallback (HTMLOptionElement.value defaults to the option's own text
 * when no `value` attribute is set) so the returned string always
 * matches what the selected Option's own rendered DOM node would
 * actually resolve to — the two can never quietly disagree.
 *
 * Returns undefined when no Option is authored selected —
 * `<select defaultValue={undefined}>` behaves exactly like omitting the
 * prop entirely, so the browser's own native "first option" default
 * applies, matching the same "unset renders the safe native default"
 * convention every other authored-state field (href/value/checked)
 * already uses in this app.
 */
export function getSelectedOptionValue(node: EditorElementNode): string | undefined {
  const selected = findSelectedOption(node);
  if (!selected) return undefined;
  return selected.value ?? selected.text;
}
