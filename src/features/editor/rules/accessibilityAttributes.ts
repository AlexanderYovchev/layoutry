import type { EditorElementNode } from "@/features/editor/types/document";

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
