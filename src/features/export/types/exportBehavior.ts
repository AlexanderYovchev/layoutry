import type { InteractionAction } from "@/features/editor/types/interactions";

/*
 * Behavior descriptors (EXPORT-1.3) — the declarative, target-independent
 * description of what the exported page does when clicked, derived from
 * the document's authored interaction bindings. They reproduce Preview's
 * own executor (useEditorStore.executeInteractionsForNode, the dismissal
 * rules in editor/utils/dismissibleTargets.ts, and DialogElement's modal
 * lifecycle) — nothing component-specific: a Dropdown, a Modal and a
 * Collapsible are all just bindings on ordinary nodes.
 *
 * Descriptors hold no executable code and no authored strings: targets
 * are addressed by generated integer tokens, never by authored ids or
 * selectors. Printers decide how to express them — the HTML printer as
 * data attributes read by a constant runtime script, a future React or
 * Vue printer as component state.
 */

/** A node whose visibility can change at runtime. */
export interface ExportBehaviorTarget {
  /** Generated, document-order integer token — the runtime's only handle on the element. */
  token: number;
  nodeId: string;
  /** A native <dialog> opens modally when shown (Preview's showModal()); anything else toggles `hidden`. */
  kind: "element" | "dialog";
  /** Visible when the page loads (Preview's authored initial visibility). */
  initiallyVisible: boolean;
  /**
   * The id assistive technology can reference (aria-controls): the
   * authored id when it is valid and unique, otherwise a generated
   * `ly-target-<token>`. Absent when an authored id exists but is
   * duplicated (it cannot be referenced reliably, nor replaced).
   */
  domId?: string;
  /** True when `domId` was generated and must be written onto the element. */
  generatedDomId: boolean;
}

export interface ExportBehaviorAction {
  action: InteractionAction;
  targetToken: number;
}

/** A node whose click runs authored actions. */
export interface ExportBehaviorTrigger {
  nodeId: string;
  /** In authored order — Preview applies them sequentially. */
  actions: ExportBehaviorAction[];
  /**
   * Targets this trigger toggles that start hidden: while one is shown, a
   * click outside both this trigger and that target, or Escape, hides it
   * again (Preview's dismissible relationships).
   */
  dismissibleTargetTokens: number[];
  /** The target whose visibility `aria-expanded` reports (the first toggled target), if any. */
  expandsTargetToken?: number;
  /** The trigger shows or toggles a dialog (`aria-haspopup="dialog"`). */
  opensDialog: boolean;
}

export interface ExportBehaviors {
  /** Document order — also the order Escape dismisses in. */
  triggers: ExportBehaviorTrigger[];
  /** Token order (= document order). */
  targets: ExportBehaviorTarget[];
  /**
   * Nodes nested inside a trigger. Preview only runs the bindings of the
   * node nearest the click, so a click on one of these never fires the
   * enclosing trigger — runtimes need to know where node boundaries are.
   */
  nodesInsideTriggers: string[];
}
