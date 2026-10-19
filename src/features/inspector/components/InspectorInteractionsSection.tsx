"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { getElementDisplayName } from "@/features/editor/utils/elementDisplayName";
import { getInteractions, type InteractionAction, type InteractionBinding } from "@/features/editor/types/interactions";
import { getInitialPreviewVisibility, type InitialPreviewVisibility } from "@/features/editor/types/previewVisibility";
import { InspectorPropertyRow } from "@/features/inspector/components/InspectorPropertyRow";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import type { EditorElementNode } from "@/features/editor/types/document";
import { cn } from "@/lib/utils";
import { inspectorFieldClassName } from "@/features/inspector/components/inspectorFieldClassName";

interface InspectorInteractionsSectionProps {
  node: EditorElementNode;
}

interface TargetCandidate {
  id: string;
  label: string;
}

const ACTION_OPTIONS: readonly { value: InteractionAction; label: string }[] = [
  { value: "show", label: "Show" },
  { value: "hide", label: "Hide" },
  { value: "toggle", label: "Toggle" },
];

const INITIAL_STATE_OPTIONS: readonly { value: InitialPreviewVisibility; label: string }[] = [
  { value: "visible", label: "Visible" },
  { value: "hidden", label: "Hidden" },
];

/**
 * "Initial state" (Checkpoint 1.15.6.8.1) — the generic authored-Preview-
 * visibility control, kept inside this same behavior-related section
 * (section 11's own explicit instruction — never under CSS Display/
 * Visibility) rather than a second new section. Shown for EVERY node this
 * section renders for, independent of whether that node currently has any
 * interaction bindings at all — a node can be a pure interaction TARGET
 * with no bindings of its own (exactly what the Dropdown menu Container
 * is), and still needs this control.
 */
function InitialStateRow({ node }: { node: EditorElementNode }) {
  const setInitialPreviewVisibility = useEditorStore((state) => state.setInitialPreviewVisibility);
  const value = getInitialPreviewVisibility(node);

  return (
    <InspectorPropertyRow label="Initial state">
      <select
        aria-label="Initial state"
        value={value}
        onChange={(event) => {
          const next = event.target.value as InitialPreviewVisibility;
          setInitialPreviewVisibility(node.id, next === "visible" ? undefined : next);
        }}
        className={cn(inspectorFieldClassName, "min-w-24 px-1.5")}
      >
        {INITIAL_STATE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </InspectorPropertyRow>
  );
}

/**
 * Every node in the document, human-readable (Checkpoint 1.15.6.8, Part
 * J/section 50) — reuses the existing Structure/display-name mechanism
 * (getElementDisplayName) rather than inventing a second naming system
 * (section 98), the same "authored HTML ID first, then Structure name,
 * never the raw internal id" priority Style Protection's own
 * getReadableNodeName already established for its own notices. Duplicate
 * labels are disambiguated with a trailing internal-id suffix (section
 * 99) — e.g. two sibling "Container" nodes read as "Container (div-a1b2)"
 * — so the picker stays usable without ever showing a raw id as the
 * PRIMARY text for a uniquely-named node. Excludes only the document
 * root itself: hiding the entire page is not a meaningful product action,
 * even though the underlying executor stays fully generic and never
 * special-cases any OTHER node (section 24) — self-target and ancestor/
 * descendant targets are all otherwise allowed (section 52/55).
 */
function collectTargetCandidates(root: EditorElementNode): TargetCandidate[] {
  const all: EditorElementNode[] = [];
  function visit(n: EditorElementNode) {
    all.push(n);
    n.children?.forEach(visit);
  }
  visit(root);

  const labelCounts = new Map<string, number>();
  for (const n of all) {
    const label = getElementDisplayName(n);
    labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
  }

  return all
    .filter((n) => n.id !== root.id)
    .map((n) => {
      const label = getElementDisplayName(n);
      const isAmbiguous = (labelCounts.get(label) ?? 0) > 1;
      return { id: n.id, label: isAmbiguous ? `${label} (${n.id})` : label };
    });
}

function InteractionRow({
  node,
  binding,
  candidates,
}: {
  node: EditorElementNode;
  binding: InteractionBinding;
  candidates: TargetCandidate[];
}) {
  const updateInteraction = useEditorStore((state) => state.updateInteraction);
  const removeInteraction = useEditorStore((state) => state.removeInteraction);

  // Defensive rendering for a target that no longer exists (section 53) —
  // deletion cleanup (removeInteractionsTargeting) should already prevent
  // this in practice, but the Inspector never crashes or silently hides
  // the problem either way.
  const targetStillExists = candidates.some((candidate) => candidate.id === binding.targetId);

  return (
    <div className="flex flex-col gap-1.5 border-t border-zinc-200 pt-2 first:border-t-0 first:pt-0 dark:border-zinc-800">
      <div className="flex items-center justify-between text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
        <span>On Click</span>
        <button
          type="button"
          onClick={() => removeInteraction(node.id, binding.id)}
          aria-label="Remove interaction"
          title="Remove interaction"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors duration-150 hover:bg-zinc-100 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-red-400"
        >
          <Trash2 aria-hidden="true" className="size-3.5" />
        </button>
      </div>

      <InspectorPropertyRow label="Action">
        <select
          aria-label="Action"
          value={binding.action}
          onChange={(event) => updateInteraction(node.id, binding.id, { action: event.target.value as InteractionAction })}
          className={cn(inspectorFieldClassName, "min-w-24 px-1.5")}
        >
          {ACTION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </InspectorPropertyRow>

      <InspectorPropertyRow label="Target" error={targetStillExists ? undefined : "Target no longer exists."}>
        <select
          aria-label="Target"
          value={targetStillExists ? binding.targetId : ""}
          onChange={(event) => updateInteraction(node.id, binding.id, { targetId: event.target.value })}
          className={cn(inspectorFieldClassName, "min-w-32 px-1.5")}
        >
          {!targetStillExists && <option value="">Missing target</option>}
          {candidates.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.label}
            </option>
          ))}
        </select>
      </InspectorPropertyRow>
    </div>
  );
}

/**
 * The Interactions section (Checkpoint 1.15.6.8, Part J) — appears only
 * for a genuine single selection (InspectorNodeSummary is only ever
 * rendered that way — see InspectorContent's own isMultiSelection
 * branch), so this needed no extra gating of its own to satisfy section
 * 45's "single-selection only" requirement. Deliberately outside every
 * InspectorProtectedStyleGroup in InspectorNodeSummary — adding/changing/
 * removing a binding is semantic/behavioral data, never blocked by
 * Parent Style Protection (section 54), and the store's own
 * addInteraction/updateInteraction/removeInteraction actions are never
 * routed through guardedStyleMutation either.
 *
 * V1 supports exactly one trigger (click), so each row shows "On Click"
 * as plain text rather than a single-option dropdown pretending other
 * triggers exist (section 48).
 */
export function InspectorInteractionsSection({ node }: InspectorInteractionsSectionProps) {
  const documentModel = useEditorStore((state) => state.document);
  const addInteraction = useEditorStore((state) => state.addInteraction);
  const bindings = getInteractions(node);
  const candidates = collectTargetCandidates(documentModel);

  // InspectorSection's own `defaultOpen` is read only once, at mount (see
  // its own doc comment) — it never reacts to a later prop change. That's
  // right for every OTHER section, but here the very first "Add
  // Interaction" click (or the first switch to a non-default Initial
  // state) transitions a node from "nothing configured" to "something
  // configured," and that change should actually become visible without
  // a second, separate click to expand the section. Controlled mode + the
  // same "compare during render" pattern InspectorBoxShadowSection's own
  // lastNodeId reset already uses: open automatically exactly once, on
  // the false -> true transition, never fighting a later manual collapse.
  const hasConfiguredBehavior = bindings.length > 0 || getInitialPreviewVisibility(node) !== "visible";
  const [isOpen, setIsOpen] = useState(hasConfiguredBehavior);
  const [wasConfigured, setWasConfigured] = useState(hasConfiguredBehavior);
  if (hasConfiguredBehavior !== wasConfigured) {
    if (hasConfiguredBehavior && !wasConfigured) setIsOpen(true);
    setWasConfigured(hasConfiguredBehavior);
  }

  function handleAdd() {
    const defaultTarget = candidates[0]?.id ?? node.id;
    addInteraction(node.id, { trigger: "click", action: "toggle", targetId: defaultTarget });
  }

  return (
    <InspectorSection label="Interactions" isOpen={isOpen} onToggle={setIsOpen}>
      <InitialStateRow node={node} />

      {bindings.length === 0 ? (
        <button
          type="button"
          onClick={handleAdd}
          className="flex h-8 items-center justify-center gap-1.5 rounded-md border border-dashed border-zinc-300 text-xs text-zinc-500 transition-colors duration-150 hover:border-zinc-400 hover:text-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-300"
        >
          <Plus aria-hidden="true" className="size-3.5" />
          Add Interaction
        </button>
      ) : (
        <div className="flex flex-col gap-2 border-t border-zinc-200 pt-2 dark:border-zinc-800">
          {bindings.map((binding) => (
            <InteractionRow key={binding.id} node={node} binding={binding} candidates={candidates} />
          ))}
          <button
            type="button"
            onClick={handleAdd}
            className="flex h-7 items-center justify-center gap-1.5 rounded-md border border-dashed border-zinc-300 text-xs text-zinc-500 transition-colors duration-150 hover:border-zinc-400 hover:text-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-300"
          >
            <Plus aria-hidden="true" className="size-3.5" />
            Add Interaction
          </button>
        </div>
      )}
    </InspectorSection>
  );
}
