import { isSelectableElement } from "@/features/editor/rules/elementCapabilities";
import { getInteractions } from "@/features/editor/types/interactions";
import { documentPreOrder, resolveInteractionTargets } from "@/features/editor/utils/interactionTargets";
import type { EditorElementNode } from "@/features/editor/types/document";
import { resolveTriggerAccessibility } from "@/features/editor/utils/triggerAccessibility";
import type { ExportBehaviors, ExportBehaviorTarget, ExportBehaviorTrigger } from "@/features/export/types/exportBehavior";
import type { ExportDiagnostic } from "@/features/export/types/exportDiagnostic";

/** Elements a keyboard user can already focus and activate (Enter/Space fire click). */
const NATIVELY_OPERABLE_TAGS: ReadonlySet<string> = new Set(["button", "a", "input", "select", "textarea"]);

/**
 * Derives the behavior descriptors (EXPORT-1.3) for a validated document:
 * which nodes are click triggers, which nodes can change visibility, and
 * which shown targets are dismissible — the exact model Preview executes.
 * Bindings to nodes that no longer exist are skipped, exactly as Preview's
 * executor skips them. Targets and their ids come from
 * resolveInteractionTargets, which Preview uses too (BC-02.5.1).
 */
export function buildExportBehaviors(document: EditorElementNode, diagnostics: ExportDiagnostic[]): ExportBehaviors {
  const nodes = documentPreOrder(document);
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const targets: ExportBehaviorTarget[] = resolveInteractionTargets(document);
  const tokenByNodeId = new Map(targets.map((target) => [target.nodeId, target.token]));
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
    // Shared with Preview (usePreviewTriggerAria), so both expose the same state.
    const accessibility = resolveTriggerAccessibility(bindings, (nodeId) => nodesById.get(nodeId));
    const expandsTargetToken = accessibility.expandsTargetId === undefined ? undefined : tokenByNodeId.get(accessibility.expandsTargetId);
    triggers.push({
      nodeId: node.id,
      actions,
      dismissibleTargetTokens,
      ...(expandsTargetToken !== undefined ? { expandsTargetToken } : {}),
      opensDialog: accessibility.opensDialog,
    });
    for (const descendant of documentPreOrder(node).slice(1)) nodesInsideTriggers.add(descendant.id);
  }

  return { triggers, targets, nodesInsideTriggers: nodes.filter((node) => nodesInsideTriggers.has(node.id)).map((node) => node.id) };
}
