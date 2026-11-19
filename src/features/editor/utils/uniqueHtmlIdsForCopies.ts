import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * BC-10.5.1 — authored HTML ids for freshly copied subtrees (paste and
 * duplicate, one element or several).
 *
 * The Canvas, the Preview and the export all render `node.htmlId` as the
 * element's DOM `id`, so a copy that kept its original's id put two
 * elements with the same id on the page (the export only warned
 * "duplicate-html-id"). Each copy whose authored id is already used in
 * `document` (or by an earlier copy in this same operation) gets the first
 * free `<id>-copy`, `<id>-copy-2`, … An id that is free is KEPT, so a cut
 * element pasted back keeps its id (the original is gone), exactly as a
 * move would.
 *
 * The one supported reference to an authored id is a link's `href="#id"`.
 * A link INSIDE the copies that pointed at a renamed copied element is
 * rewritten to the copy's new id — like interaction targets (BC-10.5):
 * copied together, they stay together. Links outside the copies, any
 * other URL, and text are never touched.
 */
export function withUniqueHtmlIdsForCopies(document: EditorElementNode, copies: readonly EditorElementNode[]): EditorElementNode[] {
  const used = new Set<string>();
  collectHtmlIds(document, used);
  const renamed = new Map<string, string>();

  const rename = (node: EditorElementNode): EditorElementNode => {
    const children = node.children?.map(rename);
    const childrenChanged = children !== undefined && children.some((child, index) => child !== node.children![index]);
    let htmlId = node.htmlId;
    if (htmlId !== undefined && htmlId !== "") {
      if (used.has(htmlId)) {
        const fresh = freeCopyId(htmlId, used);
        if (!renamed.has(htmlId)) renamed.set(htmlId, fresh);
        htmlId = fresh;
      }
      used.add(htmlId);
    }
    if (htmlId === node.htmlId && !childrenChanged) return node;
    return { ...node, htmlId, children: childrenChanged ? children : node.children };
  };
  const named = copies.map(rename);
  if (renamed.size === 0) return named;

  const relink = (node: EditorElementNode): EditorElementNode => {
    const children = node.children?.map(relink);
    const childrenChanged = children !== undefined && children.some((child, index) => child !== node.children![index]);
    const target = node.href?.startsWith("#") ? renamed.get(node.href.slice(1)) : undefined;
    if (target === undefined && !childrenChanged) return node;
    return { ...node, href: target !== undefined ? `#${target}` : node.href, children: childrenChanged ? children : node.children };
  };
  return named.map(relink);
}

function freeCopyId(base: string, used: ReadonlySet<string>): string {
  for (let index = 1; ; index++) {
    const candidate = index === 1 ? `${base}-copy` : `${base}-copy-${index}`;
    if (!used.has(candidate)) return candidate;
  }
}

function collectHtmlIds(root: EditorElementNode, into: Set<string>): void {
  const stack = [root];
  for (let node = stack.pop(); node; node = stack.pop()) {
    if (node.htmlId !== undefined && node.htmlId !== "") into.add(node.htmlId);
    if (node.children) stack.push(...node.children);
  }
}
