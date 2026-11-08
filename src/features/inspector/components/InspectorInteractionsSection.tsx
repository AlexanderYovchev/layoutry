"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState, type Ref } from "react";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { getElementDisplayName } from "@/features/editor/utils/elementDisplayName";
import { isKeyboardOperableTrigger } from "@/features/editor/utils/triggerAccessibility";
import { getInteractions, type InteractionAction, type InteractionBinding } from "@/features/editor/types/interactions";
import { getInitialPreviewVisibility, type InitialPreviewVisibility } from "@/features/editor/types/previewVisibility";
import { InspectorPropertyRow } from "@/features/inspector/components/InspectorPropertyRow";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import type { EditorElementNode } from "@/features/editor/types/document";
import { cn } from "@/lib/utils";
import { inspectorFieldClassName } from "@/features/inspector/components/inspectorFieldClassName";
import { INTERACTION_COPY } from "@/features/inspector/utils/interactionGuidanceCopy";

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

const NOTE_CLASS_NAME = "px-0.5 text-[11px] text-fg-secondary";
const DASHED_BUTTON_CLASS_NAME =
  "flex items-center justify-center gap-1.5 rounded-md border border-dashed border-zinc-300 text-xs text-zinc-500 transition-colors duration-150 hover:border-zinc-400 hover:text-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-300";
const REMOVE_BUTTON_CLASS_NAME =
  "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors duration-150 hover:bg-zinc-100 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-red-400";
const ROW_CLASS_NAME = "flex flex-col gap-1.5 border-t border-zinc-200 pt-2 first:border-t-0 first:pt-0 dark:border-zinc-800";

/**
 * "Initial state" (Checkpoint 1.15.6.8.1) — the generic authored-Preview-
 * visibility control, kept inside this same behavior-related section
 * (section 11's own explicit instruction — never under CSS Display/
 * Visibility) rather than a second new section. Shown for EVERY node this
 * section renders for, independent of whether that node currently has any
 * interaction bindings at all — a node can be a pure interaction TARGET
 * with no bindings of its own (exactly what the Dropdown menu Container
 * is), and still needs this control. BC-04.2: help, plus a note while it
 * is Hidden, because Design keeps the element visible.
 */
function InitialStateRow({ node }: { node: EditorElementNode }) {
  const setInitialPreviewVisibility = useEditorStore((state) => state.setInitialPreviewVisibility);
  const value = getInitialPreviewVisibility(node);
  const helpId = useId();
  const noteId = useId();

  return (
    <>
      <InspectorPropertyRow label="Initial state" help={INTERACTION_COPY.initialStateHelp} helpId={helpId}>
        <select
          aria-label="Initial state"
          aria-describedby={value === "hidden" ? `${helpId} ${noteId}` : helpId}
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
      {value === "hidden" && (
        <p id={noteId} className={NOTE_CLASS_NAME}>
          {INTERACTION_COPY.initialHiddenNote}
        </p>
      )}
    </>
  );
}

const TEXT_HINT_MAX_LENGTH = 24;

function textHint(node: EditorElementNode): string | undefined {
  const text = node.text?.replace(/\s+/g, " ").trim();
  if (!text) return undefined;
  return text.length > TEXT_HINT_MAX_LENGTH ? `${text.slice(0, TEXT_HINT_MAX_LENGTH - 1).trimEnd()}…` : text;
}

/**
 * Every node in the document, human-readable (Checkpoint 1.15.6.8, Part
 * J/section 50) — reuses the existing Structure/display-name mechanism
 * (getElementDisplayName) rather than inventing a second naming system.
 * Excludes only the document root itself: hiding the entire page is not a
 * meaningful product action; self-target and ancestor/descendant targets
 * are all otherwise allowed (section 52/55).
 *
 * BC-04.2 (U5): names that occur more than once are told apart without
 * internal ids. First by the element's own text, in Structure's
 * "Option — Bulgaria" style ("Button — Show details"); names still shared
 * after that get their position in document order ("Container (2 of 3)").
 * The selected element itself is marked "(this element)", so choosing it
 * is a deliberate choice.
 */
export function collectTargetCandidates(root: EditorElementNode, triggerId: string): TargetCandidate[] {
  const nodes: EditorElementNode[] = [];
  function visit(n: EditorElementNode) {
    if (n.id !== root.id) nodes.push(n);
    n.children?.forEach(visit);
  }
  visit(root);

  function countLabels(labels: readonly string[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
    return counts;
  }

  const names = nodes.map((n) => getElementDisplayName(n));
  const nameCounts = countLabels(names);
  const withText = nodes.map((n, index) => {
    const name = names[index];
    const hint = textHint(n);
    if ((nameCounts.get(name) ?? 0) < 2 || !hint || name.includes(hint)) return name;
    return `${name} — ${hint}`;
  });

  const labelCounts = countLabels(withText);
  const seen = new Map<string, number>();
  return nodes.map((n, index) => {
    const label = withText[index];
    const total = labelCounts.get(label) ?? 0;
    let distinct = label;
    if (total > 1) {
      const position = (seen.get(label) ?? 0) + 1;
      seen.set(label, position);
      distinct = `${label} (${position} of ${total})`;
    }
    return { id: n.id, label: n.id === triggerId ? `${distinct} (this element)` : distinct };
  });
}

function ActionSelect({ value, onChange, describedBy }: { value: InteractionAction; onChange: (action: InteractionAction) => void; describedBy: string }) {
  return (
    <select
      aria-label="Action"
      aria-describedby={describedBy}
      value={value}
      onChange={(event) => onChange(event.target.value as InteractionAction)}
      className={cn(inspectorFieldClassName, "min-w-24 px-1.5")}
    >
      {ACTION_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function RowHeader({ onRemove, removeRef }: { onRemove: () => void; removeRef?: Ref<HTMLButtonElement> }) {
  return (
    <div className="flex items-center justify-between text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
      <span>On Click</span>
      <button ref={removeRef} type="button" onClick={onRemove} aria-label="Remove interaction" title="Remove interaction" className={REMOVE_BUTTON_CLASS_NAME}>
        <Trash2 aria-hidden="true" className="size-3.5" />
      </button>
    </div>
  );
}

function InteractionRow({
  node,
  binding,
  candidates,
  targetRef,
  onRemoved,
}: {
  node: EditorElementNode;
  binding: InteractionBinding;
  candidates: TargetCandidate[];
  targetRef?: Ref<HTMLSelectElement>;
  onRemoved: () => void;
}) {
  const updateInteraction = useEditorStore((state) => state.updateInteraction);
  const removeInteraction = useEditorStore((state) => state.removeInteraction);
  const actionHelpId = useId();
  const targetHelpId = useId();
  const errorId = useId();

  // Defensive rendering for a target that no longer exists (section 53).
  // Deleting a target removes the bindings aimed at it, and paste removes
  // bindings whose target is gone (BC-04.2), so an editor document should
  // never reach this; the Inspector still never crashes, never silently
  // retargets, and lets the user choose a replacement.
  const targetStillExists = candidates.some((candidate) => candidate.id === binding.targetId);

  return (
    <div className={ROW_CLASS_NAME}>
      <RowHeader
        onRemove={() => {
          removeInteraction(node.id, binding.id);
          onRemoved();
        }}
      />

      <InspectorPropertyRow label="Action" help={INTERACTION_COPY.actionHelp} helpId={actionHelpId}>
        <ActionSelect value={binding.action} onChange={(action) => updateInteraction(node.id, binding.id, { action })} describedBy={actionHelpId} />
      </InspectorPropertyRow>

      <InspectorPropertyRow label="Target" help={INTERACTION_COPY.targetHelp} helpId={targetHelpId} error={targetStillExists ? undefined : INTERACTION_COPY.missingTarget}>
        <select
          ref={targetRef}
          aria-label="Target"
          aria-describedby={targetStillExists ? targetHelpId : `${targetHelpId} ${errorId}`}
          aria-invalid={targetStillExists ? undefined : true}
          value={targetStillExists ? binding.targetId : ""}
          onChange={(event) => {
            if (event.target.value !== "") updateInteraction(node.id, binding.id, { targetId: event.target.value });
          }}
          className={cn(inspectorFieldClassName, "min-w-32 max-w-40 px-1.5")}
        >
          {!targetStillExists && (
            <option value="" disabled>
              {INTERACTION_COPY.missingTargetOption}
            </option>
          )}
          {candidates.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.label}
            </option>
          ))}
        </select>
      </InspectorPropertyRow>
      {/* The row's error paragraph has no id of its own; this hidden copy gives the select a description. */}
      {!targetStillExists && (
        <span id={errorId} hidden>
          {INTERACTION_COPY.missingTarget}
        </span>
      )}
    </div>
  );
}

interface DraftInteraction {
  nodeId: string;
  action: InteractionAction;
}

/**
 * A new interaction before its target is chosen (BC-04.2, U1). It lives
 * only here, never in the document: an interaction without a target means
 * nothing, so it can't run in Preview, can't reach the export, can't be
 * saved, and the schema still requires every binding to have a target.
 * Choosing a target adds the complete binding as ONE history step; the
 * trash button discards the draft without touching history.
 */
function DraftInteractionRow({
  draft,
  candidates,
  targetRef,
  onActionChange,
  onTargetChosen,
  onDiscard,
}: {
  draft: DraftInteraction;
  candidates: TargetCandidate[];
  targetRef: Ref<HTMLSelectElement>;
  onActionChange: (action: InteractionAction) => void;
  onTargetChosen: (targetId: string) => void;
  onDiscard: () => void;
}) {
  const actionHelpId = useId();
  const targetHelpId = useId();
  const requiredId = useId();

  return (
    <div className={ROW_CLASS_NAME} data-interaction-draft="">
      <RowHeader onRemove={onDiscard} />

      <InspectorPropertyRow label="Action" help={INTERACTION_COPY.actionHelp} helpId={actionHelpId}>
        <ActionSelect value={draft.action} onChange={onActionChange} describedBy={actionHelpId} />
      </InspectorPropertyRow>

      <InspectorPropertyRow label="Target" help={INTERACTION_COPY.targetHelp} helpId={targetHelpId}>
        <select
          ref={targetRef}
          aria-label="Target"
          aria-required="true"
          aria-describedby={`${requiredId} ${targetHelpId}`}
          value=""
          onChange={(event) => {
            if (event.target.value !== "") onTargetChosen(event.target.value);
          }}
          className={cn(inspectorFieldClassName, "min-w-32 max-w-40 px-1.5")}
        >
          <option value="" disabled>
            {INTERACTION_COPY.targetPlaceholder}
          </option>
          {candidates.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.label}
            </option>
          ))}
        </select>
      </InspectorPropertyRow>
      <p id={requiredId} className={NOTE_CLASS_NAME}>
        {INTERACTION_COPY.targetRequired}
      </p>
    </div>
  );
}

type FocusRequest = "add" | "draft-target" | "last-target";

/**
 * The Interactions section (Checkpoint 1.15.6.8, Part J) — appears only
 * for a genuine single selection (InspectorNodeSummary is only ever
 * rendered that way — see InspectorContent's own isMultiSelection
 * branch). Deliberately outside every InspectorProtectedStyleGroup in
 * InspectorNodeSummary — adding/changing/removing a binding is
 * semantic/behavioral data, never blocked by Parent Style Protection
 * (section 54).
 *
 * V1 supports exactly one trigger (click), so each row shows "On Click"
 * as plain text rather than a single-option dropdown pretending other
 * triggers exist (section 48).
 *
 * BC-04.2 adds guidance (a description, help on Initial state / Action /
 * Target, and notes that appear only when they apply), an explicit target
 * choice for new interactions, and keeps keyboard focus in the section
 * when interactions are added or removed.
 */
export function InspectorInteractionsSection({ node }: InspectorInteractionsSectionProps) {
  const documentModel = useEditorStore((state) => state.document);
  const addInteraction = useEditorStore((state) => state.addInteraction);
  const bindings = getInteractions(node);
  const candidates = collectTargetCandidates(documentModel, node.id);

  // InspectorSection's own `defaultOpen` is read only once, at mount (see
  // its own doc comment) — it never reacts to a later prop change. Here
  // the first switch to a non-default Initial state (or the first added
  // interaction) transitions a node from "nothing configured" to
  // "something configured," and that change should actually become
  // visible without a second, separate click to expand the section.
  // Controlled mode + the same "compare during render" pattern
  // InspectorBoxShadowSection's own lastNodeId reset already uses: open
  // automatically exactly once, on the false -> true transition, never
  // fighting a later manual collapse.
  const hasConfiguredBehavior = bindings.length > 0 || getInitialPreviewVisibility(node) !== "visible";
  const [isOpen, setIsOpen] = useState(hasConfiguredBehavior);
  const [wasConfigured, setWasConfigured] = useState(hasConfiguredBehavior);
  if (hasConfiguredBehavior !== wasConfigured) {
    if (hasConfiguredBehavior && !wasConfigured) setIsOpen(true);
    setWasConfigured(hasConfiguredBehavior);
  }

  // This component isn't remounted when the selection changes, so a draft
  // belongs to the node it was started on and is dropped as soon as a
  // different node is shown (the Inspector local-state staleness rule).
  const [draft, setDraft] = useState<DraftInteraction | null>(null);
  if (draft && draft.nodeId !== node.id) setDraft(null);
  const activeDraft = draft?.nodeId === node.id ? draft : null;

  // Focus follows the control that replaced the one just used, so adding,
  // finishing or removing an interaction never drops focus to <body>.
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const draftTargetRef = useRef<HTMLSelectElement>(null);
  const lastTargetRef = useRef<HTMLSelectElement>(null);
  const focusRequest = useRef<FocusRequest | null>(null);
  useEffect(() => {
    const request = focusRequest.current;
    if (!request) return;
    focusRequest.current = null;
    const element = request === "add" ? addButtonRef.current : request === "draft-target" ? draftTargetRef.current : lastTargetRef.current;
    element?.focus();
  });

  function handleAdd() {
    focusRequest.current = "draft-target";
    setDraft({ nodeId: node.id, action: "toggle" });
  }

  function handleTargetChosen(targetId: string) {
    if (!activeDraft) return;
    focusRequest.current = "last-target";
    addInteraction(node.id, { trigger: "click", action: activeDraft.action, targetId });
    setDraft(null);
  }

  function handleDiscardDraft() {
    focusRequest.current = "add";
    setDraft(null);
  }

  const hasRows = bindings.length > 0 || activeDraft !== null;
  const showKeyboardNote = hasRows && !isKeyboardOperableTrigger(node.tag);
  const addButton = activeDraft ? null : (
    <button ref={addButtonRef} type="button" onClick={handleAdd} className={cn(DASHED_BUTTON_CLASS_NAME, hasRows ? "h-7" : "h-8")}>
      <Plus aria-hidden="true" className="size-3.5" />
      Add Interaction
    </button>
  );

  return (
    <InspectorSection label="Interactions" isOpen={isOpen} onToggle={setIsOpen}>
      <p className={NOTE_CLASS_NAME}>{INTERACTION_COPY.description}</p>

      <InitialStateRow node={node} />

      {hasRows ? (
        <div className="flex flex-col gap-2 border-t border-zinc-200 pt-2 dark:border-zinc-800">
          {bindings.map((binding, index) => (
            <InteractionRow
              key={binding.id}
              node={node}
              binding={binding}
              candidates={candidates}
              targetRef={index === bindings.length - 1 ? lastTargetRef : undefined}
              onRemoved={() => {
                // The Add button is absent while a draft is open.
                focusRequest.current = activeDraft ? "draft-target" : "add";
              }}
            />
          ))}
          {activeDraft && (
            <DraftInteractionRow
              draft={activeDraft}
              candidates={candidates}
              targetRef={draftTargetRef}
              onActionChange={(action) => setDraft({ ...activeDraft, action })}
              onTargetChosen={handleTargetChosen}
              onDiscard={handleDiscardDraft}
            />
          )}
          {showKeyboardNote && <p className={NOTE_CLASS_NAME}>{INTERACTION_COPY.keyboardNote}</p>}
          {addButton}
        </div>
      ) : (
        addButton
      )}
    </InspectorSection>
  );
}
