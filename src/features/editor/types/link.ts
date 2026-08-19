/**
 * Layoutry's Link primitive (Checkpoint 1.4) stores its destination as a
 * single, plain string field directly on EditorElementNode — `href` —
 * the same "one dedicated optional field per distinct semantic concern"
 * shape `src` (Checkpoint 3.5.1) already established for Image, not a
 * generic HTML-attribute bag. That generic framework was deliberately
 * not introduced: nothing in this checkpoint's actual scope needs one,
 * and a future attribute-bearing primitive (a Form control's name or
 * placeholder, say) can get its own equally dedicated field the same
 * way — exactly how src/mediaFit/typography/etc. already coexist as
 * independent, tag-scoped fields today rather than sharing one bag.
 */

/** Stamped by createLinkNode on every newly inserted Link, and used as getLinkHref's own fallback for any node constructed another way (a test fixture, a future paste/import path) that never got a real value — a safe, inert fragment link, not an empty or missing href. */
export const DEFAULT_LINK_HREF = "#";

/** node.href if explicitly set, else DEFAULT_LINK_HREF — the single place both the Canvas renderer and the Inspector read a Link's effective destination from, so the two can never disagree. */
export function getLinkHref(node: { href?: string }): string {
  return node.href ?? DEFAULT_LINK_HREF;
}

/**
 * Deliberately minimal (Checkpoint 1.4's own explicit scope excludes URL
 * autocomplete, routing, and an asset picker): rejects only an empty/
 * whitespace-only value (the Inspector's own draft field already reverts
 * rather than committing one — see InspectorLinkSection) and the
 * javascript: scheme. That scheme is the one value worth blocking
 * outright even though the editor itself never executes a stored href
 * (see LinkElement's own preventDefault-on-click navigation guard) — a
 * stored javascript: URI would otherwise sit inert in the document model
 * today, ready to detonate the moment a future Preview/Export feature
 * renders a real, clickable anchor from it. Ordinary relative paths
 * ("/about"), fragments ("#pricing"), mailto:/tel: links, and absolute
 * URLs are all accepted as-is, unmodified — this checkpoint's own
 * explicit instruction not to rewrite legitimate destinations.
 */
export function isValidLinkHref(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "") return false;
  return !/^javascript:/i.test(trimmed);
}
