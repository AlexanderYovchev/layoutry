import { isSelectableElement } from "@/features/editor/rules/elementCapabilities";
import { getInteractions } from "@/features/editor/types/interactions";
import { getInitialPreviewVisibility } from "@/features/editor/types/previewVisibility";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { ExportBehaviors, ExportBehaviorTarget, ExportBehaviorTrigger } from "@/features/export/types/exportBehavior";
import type { ExportDiagnostic } from "@/features/export/types/exportDiagnostic";

/** Elements a keyboard user can already focus and activate (Enter/Space fire click). */
const NATIVELY_OPERABLE_TAGS: ReadonlySet<string> = new Set(["button", "a", "input", "select", "textarea"]);

/** The authored-id rule export applies (buildExportDocument's identity()): non-empty, no whitespace, not the reserved prefix. */
export function isUsableAuthoredId(htmlId: string | undefined): htmlId is string {
  return htmlId !== undefined && htmlId !== "" && !/\s/.test(htmlId) && !htmlId.startsWith("ly-");
}

function preOrder(document: EditorElementNode): EditorElementNode[] {
  const nodes: EditorElementNode[] = [];
  const stack = [document];
  for (let node = stack.pop(); node; node = stack.pop()) {
    nodes.push(node);
    if (node.children) for (let index = node.children.length - 1; index >= 0; index--) stack.push(node.children[index]);
  }
  return nodes;
}

/**
 * Derives the behavior descriptors (EXPORT-1.3) for a validated document:
 * which nodes are click triggers, which nodes can change visibility, and
 * which shown targets are dismissible — the exact model Preview executes.
 * Bindings to nodes that no longer exist are skipped, exactly as Preview's
 * executor skips them.
 */
export function buildExportBehaviors(document: EditorElementNode, diagnostics: ExportDiagnostic[]): ExportBehaviors {
  const nodes = preOrder(document);
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const idCounts = new Map<string, number>();
  for (const node of nodes) if (isUsableAuthoredId(node.htmlId)) idCounts.set(node.htmlId, (idCounts.get(node.htmlId) ?? 0) + 1);

  // Every node any binding points at, plus every dialog that is open when
  // the page loads (Preview shows it modally even without a binding).
  const targetIds = new Set<string>();
  for (const node of nodes) {
    for (const binding of getInteractions(node)) if (nodesById.has(binding.targetId)) targetIds.add(binding.targetId);
    if (node.tag === "dialog" && getInitialPreviewVisibility(node) !== "hidden") targetIds.add(node.id);
  }

  const targets: ExportBehaviorTarget[] = [];
  const tokenByNodeId = new Map<string, number>();
  for (const node of nodes) {
    if (!targetIds.has(node.id)) continue;
    const token = targets.length + 1;
    tokenByNodeId.set(node.id, token);
    const authoredIdUsable = isUsableAuthoredId(node.htmlId) && idCounts.get(node.htmlId) === 1;
    const hasDuplicatedAuthoredId = isUsableAuthoredId(node.htmlId) && !authoredIdUsable;
    targets.push({
      token,
      nodeId: node.id,
      kind: node.tag === "dialog" ? "dialog" : "element",
      initiallyVisible: getInitialPreviewVisibility(node) !== "hidden",
      ...(authoredIdUsable ? { domId: node.htmlId } : hasDuplicatedAuthoredId ? {} : { domId: `ly-target-${token}` }),
      generatedDomId: !authoredIdUsable && !hasDuplicatedAuthoredId,
    });
  }
  const targetByToken = new Map(targets.map((target) => [target.token, target]));

  const triggers: ExportBehaviorTrigger[] = [];
  const nodesInsideTriggers = new Set<string>();
  for (const node of nodes) {
    const bindings = getInteractions(node).filter((binding) => tokenByNodeId.has(binding.targetId));
    if (bindings.length === 0) continue;
    if (!isSelectableElement(node.tag)) {
      // Preview never resolves a click to the page root or legacy body.
      diagnostics.push({ code: "unsupported-trigger", severity: "warning", nodeId: node.id, message: `Click interactions on <${node.tag}> never run in Preview, so they were not exported.` });
      continue;
    }
    if (!NATIVELY_OPERABLE_TAGS.has(node.tag)) {
      diagnostics.push({
        code: "non-operable-trigger",
        severity: "warning",
        nodeId: node.id,
        message: `This <${node.tag}> runs click interactions but cannot be focused or activated from the keyboard; use a button for keyboard access.`,
      });
    }
    const actions = bindings.map((binding) => ({ action: binding.action, targetToken: tokenByNodeId.get(binding.targetId) ?? 0 }));
    const toggled = actions.filter((entry) => entry.action === "toggle").map((entry) => entry.targetToken);
    const dismissibleTargetTokens = toggled.filter((token, index) => toggled.indexOf(token) === index && targetByToken.get(token)?.initiallyVisible === false);
    triggers.push({
      nodeId: node.id,
      actions,
      dismissibleTargetTokens,
      ...(toggled.length > 0 ? { expandsTargetToken: toggled[0] } : {}),
      opensDialog: actions.some((entry) => entry.action !== "hide" && targetByToken.get(entry.targetToken)?.kind === "dialog"),
    });
    for (const descendant of preOrder(node).slice(1)) nodesInsideTriggers.add(descendant.id);
  }

  return { triggers, targets, nodesInsideTriggers: nodes.filter((node) => nodesInsideTriggers.has(node.id)).map((node) => node.id) };
}
