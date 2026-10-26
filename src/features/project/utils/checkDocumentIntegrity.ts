import { canContainChildren } from "@/features/editor/rules/insertionRules";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { ProjectLimits } from "@/features/project/rules/projectLimits";
import type { ProjectLoadError } from "@/features/project/types/projectFile";

/**
 * Structural integrity of an authored document, beyond per-field types —
 * the invariants the editor itself maintains. Iterative (explicit stack),
 * and safe on in-memory input that is not a proper tree: a node object
 * reached twice (a cycle or shared subtree) is reported, never looped on.
 *
 * Checks: root is the single "page" node; "page" appears nowhere else;
 * node ids are unique; only container tags have children; nesting depth
 * and node count stay within limits; every interaction targets an
 * existing node (deleting a node prunes interactions aimed at it); ids
 * inside each shadow, gradient-stop, SVG-object and interaction list are
 * unique (the editor edits those lists by id).
 */
export function checkDocumentIntegrity(
  root: EditorElementNode,
  limits: Pick<ProjectLimits, "maxElementNodes" | "maxElementDepth">,
): ProjectLoadError | null {
  const fail = (message: string, path: string): ProjectLoadError => ({
    code: "integrity",
    message,
    path,
  });

  if (root.tag !== "page")
    return fail(
      'The document root must be the "page" element.',
      "document.tag",
    );

  const seenObjects = new Set<EditorElementNode>();
  const nodeIds = new Set<string>();
  const interactionTargets: { targetId: string; path: string }[] = [];
  const stack: { node: EditorElementNode; depth: number; path: string }[] = [
    { node: root, depth: 1, path: "document" },
  ];

  while (stack.length > 0) {
    const { node, depth, path } = stack.pop()!;

    if (seenObjects.has(node))
      return fail(
        "The document is not a tree (an element appears twice).",
        path,
      );
    seenObjects.add(node);
    if (seenObjects.size > limits.maxElementNodes) {
      return {
        code: "too-complex",
        message: `The document has more than ${limits.maxElementNodes} elements.`,
      };
    }
    if (depth > limits.maxElementDepth) {
      return {
        code: "too-complex",
        message: `Elements are nested more than ${limits.maxElementDepth} levels deep.`,
        path,
      };
    }
    if (depth > 1 && node.tag === "page")
      return fail(
        'Only the document root may be a "page" element.',
        `${path}.tag`,
      );
    if (nodeIds.has(node.id))
      return fail(
        `Element id "${node.id}" is used more than once.`,
        `${path}.id`,
      );
    nodeIds.add(node.id);

    const duplicate = firstDuplicateId(node);
    if (duplicate)
      return fail(
        `Id "${duplicate.id}" is used more than once in ${duplicate.list}.`,
        `${path}.${duplicate.list}`,
      );

    for (const [index, binding] of (node.interactions ?? []).entries()) {
      interactionTargets.push({
        targetId: binding.targetId,
        path: `${path}.interactions[${index}].targetId`,
      });
    }

    const children = node.children ?? [];
    if (children.length > 0 && !canContainChildren(node.tag)) {
      return fail(
        `A "${node.tag}" element cannot contain other elements.`,
        `${path}.children`,
      );
    }
    // Pushed in reverse so the walk (and the first error found) follows document order.
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push({
        node: children[index],
        depth: depth + 1,
        path: `${path}.children[${index}]`,
      });
    }
  }

  const missing = interactionTargets.find(
    ({ targetId }) => !nodeIds.has(targetId),
  );
  if (missing)
    return fail(
      `An interaction targets element "${missing.targetId}", which does not exist.`,
      missing.path,
    );
  return null;
}

function firstDuplicateId(
  node: EditorElementNode,
): { id: string; list: string } | null {
  const lists: [string, { id: string }[] | undefined][] = [
    ["boxShadow", node.boxShadow],
    ["background.gradient.stops", node.background?.gradient?.stops],
    ["svgScene.objects", node.svgScene?.objects],
    ["interactions", node.interactions],
  ];
  for (const [list, items] of lists) {
    const ids = new Set<string>();
    for (const item of items ?? []) {
      if (ids.has(item.id)) return { id: item.id, list };
      ids.add(item.id);
    }
  }
  return null;
}
