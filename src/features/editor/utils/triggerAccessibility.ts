import type { EditorElementNode } from "@/features/editor/types/document";
import type { InteractionBinding } from "@/features/editor/types/interactions";

/** Tags whose own role makes `aria-expanded` / `aria-haspopup` meaningful. */
export const EXPANDABLE_CONTROL_TAGS: ReadonlySet<string> = new Set(["button", "a"]);

export interface TriggerAccessibility {
  /** The target whose visibility `aria-expanded` reports: the first toggled target. */
  expandsTargetId?: string;
  /** The trigger shows or toggles a dialog (`aria-haspopup="dialog"`). */
  opensDialog: boolean;
}

/**
 * The accessibility state a click trigger exposes (BC-02.5, B6), shared by
 * the HTML export (buildExportBehaviors) and Preview (ButtonElement and
 * LinkElement, through usePreviewTriggerAria), so the two can't disagree.
 * It is the disclosure pattern: a trigger that toggles a target reports
 * that target's visibility, and one that shows or toggles a dialog
 * announces a dialog. Show-only and hide-only triggers (tabs, toasts,
 * close buttons) get no aria-expanded, because they don't open and close
 * one thing. Only bindings whose target exists count, as in the executor.
 */
export function resolveTriggerAccessibility(bindings: readonly InteractionBinding[], getTarget: (nodeId: string) => EditorElementNode | undefined): TriggerAccessibility {
  const live = bindings.filter((binding) => getTarget(binding.targetId) !== undefined);
  const firstToggled = live.find((binding) => binding.action === "toggle");
  return {
    ...(firstToggled ? { expandsTargetId: firstToggled.targetId } : {}),
    opensDialog: live.some((binding) => binding.action !== "hide" && getTarget(binding.targetId)?.tag === "dialog"),
  };
}

/**
 * Elements a keyboard user can already focus and activate: Enter or Space
 * fires their click (links always render an href). Moved here from the
 * export's buildExportBehaviors (BC-04.2), so the Export dialog's
 * "non-operable-trigger" warning and the Inspector's keyboard note use the
 * same rule and can't disagree.
 */
export const NATIVELY_OPERABLE_TAGS: ReadonlySet<string> = new Set(["button", "a", "input", "select", "textarea"]);

/** True when a click trigger with this tag can also be used from the keyboard. */
export function isKeyboardOperableTrigger(tag: string): boolean {
  return NATIVELY_OPERABLE_TAGS.has(tag);
}
