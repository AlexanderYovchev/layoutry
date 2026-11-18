import type { EditorElementNode } from "@/features/editor/types/document";
import {
  getPaginationRole,
  isPaginationCurrentPage,
} from "@/features/editor/types/pagination";

/**
 * Where each generic accessibility field (types/accessibility.ts) may be
 * stored, and how every renderer turns it into HTML attributes (BC-09.2).
 * Canvas, Preview and Export all call resolveAccessibilityAttributes, so
 * they can't disagree.
 */

/** Landmark-capable containers and the two interactive text elements. */
const ARIA_LABEL_TAGS: ReadonlySet<string> = new Set([
  "nav",
  "header",
  "footer",
  "main",
  "aside",
  "section",
  "form",
  "a",
  "button",
]);
const ARIA_CURRENT_TAGS: ReadonlySet<string> = new Set(["a"]);
const DISABLED_TAGS: ReadonlySet<string> = new Set(["a", "button"]);
/** Each component marker belongs on exactly one root tag. */
const COMPONENT_MARKER_TAGS: Readonly<Record<string, string>> = {
  pagination: "nav",
};

/**
 * The first accessibility field or component marker `node` carries on a
 * tag that can't have it, or null. Used by the project loader's integrity
 * check: such a node was not written by the editor.
 */
export function findMisplacedAccessibilityField(
  node: EditorElementNode,
): { field: string; message: string } | null {
  if (node.ariaLabel !== undefined && !ARIA_LABEL_TAGS.has(node.tag))
    return {
      field: "ariaLabel",
      message: `A "${node.tag}" element can't have an accessible label.`,
    };
  if (node.ariaCurrent !== undefined && !ARIA_CURRENT_TAGS.has(node.tag))
    return {
      field: "ariaCurrent",
      message: `A "${node.tag}" element can't be marked as the current item.`,
    };
  if (node.disabled !== undefined && !DISABLED_TAGS.has(node.tag))
    return {
      field: "disabled",
      message: `A "${node.tag}" element can't be disabled.`,
    };
  if (
    node.component !== undefined &&
    COMPONENT_MARKER_TAGS[node.component] !== node.tag
  )
    return {
      field: "component",
      message: `A "${node.tag}" element can't be a ${node.component} component.`,
    };
  return null;
}

/**
 * Whether a link renders its href. A disabled link, and a link marked as
 * the current page, don't: they must not navigate, and leaving the href
 * in place (even with aria-disabled) would keep them clickable without
 * JavaScript. The authored href stays stored, so it returns when the
 * state is removed.
 */
export function isNavigableLink(node: EditorElementNode): boolean {
  return node.disabled !== true && node.ariaCurrent !== "page";
}

/**
 * Whether the node's authored click interactions may run (BC-09.2.1). A
 * node marked `disabled` in the document never activates them, by click,
 * keyboard or a dispatched click. Decided from the document field only,
 * never from styling, and never inherited: a disabled link doesn't disable
 * its siblings or its parent. The single rule behind Preview's executor,
 * its trigger ARIA and outside-click dismissal, and the export's trigger
 * list (so the exported runtime never sees a disabled trigger). Design
 * mode doesn't run interactions, so selection and editing are unaffected.
 *
 * BC-09.3 (approved): inside a marked Pagination (`parent`), the current
 * page and the ellipsis don't activate either. Scoped to that Pagination
 * semantics: `aria-current` elsewhere (a Navbar's active item) still runs
 * its interactions.
 */
export function canActivateInteractions(
  node: EditorElementNode,
  parent: EditorElementNode | undefined,
): boolean {
  return getInactiveReason(node, parent) === undefined;
}

/** Why a node never activates (the Inspector explains it, BC-09.4), or undefined when it does. */
export type InactiveReason = "disabled" | "current-page" | "ellipsis";

export function getInactiveReason(
  node: EditorElementNode,
  parent: EditorElementNode | undefined,
): InactiveReason | undefined {
  if (node.disabled === true) return "disabled";
  if (isPaginationCurrentPage(node, parent)) return "current-page";
  if (getPaginationRole(node, parent) === "ellipsis") return "ellipsis";
  return undefined;
}

/**
 * Attributes DERIVED from a node's place in a component, not stored
 * (BC-09.4, like the Dialog's derived accessible name): a marked
 * Pagination's ellipsis is a purely visual separator, so it gets
 * aria-hidden="true" and screen readers don't announce "…". It is a
 * non-focusable paragraph, so hiding it hides nothing operable. No
 * document field and no format change; legacy Paginations and
 * Breadcrumbs separators (no marker) are untouched.
 */
export function resolveDerivedAccessibilityAttributes(
  node: EditorElementNode,
  parent: EditorElementNode | undefined,
): readonly (readonly [string, string])[] {
  return getPaginationRole(node, parent) === "ellipsis"
    ? [["aria-hidden", "true"]]
    : [];
}

export interface AccessibilityRenderOptions {
  /**
   * Whether a disabled button gets the native `disabled` attribute. True
   * for Preview and Export. The Design Canvas passes false: a native
   * disabled button swallows the clicks that select it, so it gets
   * `aria-disabled` there instead.
   */
  nativeDisabled: boolean;
}

/**
 * The HTML attributes the node's accessibility fields produce, in a fixed
 * order. Values are raw text: React and the export printer escape them.
 */
export function resolveAccessibilityAttributes(
  node: EditorElementNode,
  options: AccessibilityRenderOptions,
): readonly (readonly [string, string | true])[] {
  const attributes: (readonly [string, string | true])[] = [];
  if (node.ariaLabel !== undefined && ARIA_LABEL_TAGS.has(node.tag))
    attributes.push(["aria-label", node.ariaLabel]);
  if (node.ariaCurrent !== undefined && ARIA_CURRENT_TAGS.has(node.tag))
    attributes.push(["aria-current", node.ariaCurrent]);
  if (node.disabled === true) {
    // An <a> without href has no link role; role="link" keeps it announced
    // as an (unavailable) link.
    if (node.tag === "a")
      attributes.push(["role", "link"], ["aria-disabled", "true"]);
    else if (node.tag === "button")
      attributes.push(
        options.nativeDisabled ? ["disabled", true] : ["aria-disabled", "true"],
      );
  }
  return attributes;
}

/** The same attributes as React props, for the Canvas elements. */
export function accessibilityProps(
  node: EditorElementNode,
  options: AccessibilityRenderOptions,
): Record<string, string | boolean> {
  return Object.fromEntries(resolveAccessibilityAttributes(node, options));
}
