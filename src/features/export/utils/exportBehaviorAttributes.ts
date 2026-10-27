import type { ExportBehaviors } from "@/features/export/types/exportBehavior";
import type { ExportAttribute } from "@/features/export/types/exportIr";

/** Tags whose own role makes `aria-expanded` / `aria-haspopup` meaningful. */
const EXPANDABLE_CONTROL_TAGS: ReadonlySet<string> = new Set(["button", "a"]);

export interface ElementBehaviorAttributes {
  /** A generated id, printed in the id position (only for targets without a usable authored id). */
  id?: string;
  /** Accessibility state and runtime hooks, printed after the element's own attributes. */
  attributes: ExportAttribute[];
}

/**
 * Translates behavior descriptors into the HTML attributes the interaction
 * runtime and assistive technology read (EXPORT-1.3), keyed by editor node
 * id. Every value is a generated token, a keyword, or an id that already
 * passed export's id validation — never free authored text.
 *
 * Accessibility, derived only from what the bindings genuinely do (no
 * component-specific roles are invented — Basic Tabs, for instance, has no
 * tab keyboard model in the editor, so it gets no tab roles):
 * - `aria-controls` on every trigger, listing its targets' ids.
 * - `aria-expanded` on a button/link trigger that toggles a target
 *   (the disclosure pattern: Dropdown, Popover, Collapsible).
 * - `aria-haspopup="dialog"` on a button/link trigger that opens a dialog.
 */
export function buildBehaviorAttributes(behaviors: ExportBehaviors, tagsByNodeId: ReadonlyMap<string, string>): Map<string, ElementBehaviorAttributes> {
  const result = new Map<string, ElementBehaviorAttributes>();
  const entry = (nodeId: string): ElementBehaviorAttributes => {
    let existing = result.get(nodeId);
    if (!existing) {
      existing = { attributes: [] };
      result.set(nodeId, existing);
    }
    return existing;
  };
  const targetsByToken = new Map(behaviors.targets.map((target) => [target.token, target]));

  for (const trigger of behaviors.triggers) {
    const tag = tagsByNodeId.get(trigger.nodeId) ?? "";
    const attributes = entry(trigger.nodeId).attributes;
    const controls = [...new Set(trigger.actions.map((action) => targetsByToken.get(action.targetToken)?.domId).filter((id): id is string => id !== undefined))];
    if (controls.length > 0) attributes.push({ name: "aria-controls", value: controls.join(" ") });
    if (EXPANDABLE_CONTROL_TAGS.has(tag)) {
      if (trigger.expandsTargetToken !== undefined) {
        attributes.push({ name: "aria-expanded", value: targetsByToken.get(trigger.expandsTargetToken)?.initiallyVisible ? "true" : "false" });
      }
      if (trigger.opensDialog) attributes.push({ name: "aria-haspopup", value: "dialog" });
    }
    attributes.push({ name: "data-ly-on-click", value: trigger.actions.map((action) => `${action.action}:${action.targetToken}`).join(" ") });
    if (trigger.dismissibleTargetTokens.length > 0) attributes.push({ name: "data-ly-dismiss", value: trigger.dismissibleTargetTokens.join(" ") });
    if (trigger.expandsTargetToken !== undefined && EXPANDABLE_CONTROL_TAGS.has(tag)) attributes.push({ name: "data-ly-expands", value: String(trigger.expandsTargetToken) });
  }

  for (const target of behaviors.targets) {
    const targetEntry = entry(target.nodeId);
    if (target.generatedDomId && target.domId !== undefined) targetEntry.id = target.domId;
    targetEntry.attributes.push({ name: "data-ly-target", value: String(target.token) });
  }

  for (const nodeId of behaviors.nodesInsideTriggers) entry(nodeId).attributes.push({ name: "data-ly-node", value: true });

  return result;
}
