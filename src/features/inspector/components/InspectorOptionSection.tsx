"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { InspectorBooleanToggle } from "@/features/inspector/components/InspectorBooleanToggle";
import { InspectorPropertyRow } from "@/features/inspector/components/InspectorPropertyRow";
import { InspectorResetButton } from "@/features/inspector/components/InspectorResetButton";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";
import { cn } from "@/lib/utils";

interface InspectorOptionSectionProps {
  /** The selected node — rendered only for option (see InspectorNodeSummary; a direct tag check, matching InspectorListSection/InspectorSelectOptionsSection's own precedent). */
  node: EditorElementNode;
  /** node's own parent id — always its owning Select in practice (Option is only ever a select's direct child, enforced by canParentAcceptChild), needed to call the parent-aware setSelectSelectedOption command. */
  parentId: string | null;
}

interface OptionTextFieldProps {
  id: string;
  label: string;
  value: string;
  onCommit: (value: string) => void;
  /** Omitted for Label — node.text is never truly "unset" the way Placeholder/Value are (no Canvas-text-editing field anywhere in this app has a Reset affordance either), so that row simply has no reset control. */
  onReset?: () => void;
  hasExplicitValue?: boolean;
}

/**
 * A plain draft/commit/Escape-revert text field — the same shape
 * InspectorFormControlSection's own FormControlTextField already
 * established (see that component's own doc comment for the full detail
 * on `touched`/`suppressNextBlurCommitRef`). A second, independent,
 * intentionally-not-yet-shared copy rather than an early cross-file
 * abstraction — matching that same component's own stated precedent for
 * why it didn't reuse InspectorLinkSection's near-identical field either.
 */
function OptionTextField({ id, label, value, onCommit, onReset, hasExplicitValue }: OptionTextFieldProps) {
  const [draft, setDraft] = useState(value);
  const [touched, setTouched] = useState(false);
  const suppressNextBlurCommitRef = useRef(false);
  const [lastSyncedValue, setLastSyncedValue] = useState(value);
  if (value !== lastSyncedValue) {
    setLastSyncedValue(value);
    setDraft(value);
    setTouched(false);
  }

  function commit() {
    if (!touched) return;
    setTouched(false);
    const trimmed = draft.trim();
    if (trimmed === "") {
      setDraft(value);
      return;
    }
    onCommit(trimmed);
  }

  function handleBlur() {
    if (suppressNextBlurCommitRef.current) {
      suppressNextBlurCommitRef.current = false;
      return;
    }
    commit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      commit();
      suppressNextBlurCommitRef.current = true;
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setDraft(value);
      setTouched(false);
      suppressNextBlurCommitRef.current = true;
      event.currentTarget.blur();
    }
  }

  return (
    <InspectorPropertyRow
      label={label}
      labelHtmlFor={id}
      variant="stack"
      state={onReset ? (hasExplicitValue ? "set" : "unset") : undefined}
      reset={onReset && <InspectorResetButton onReset={onReset} disabled={!hasExplicitValue} label={`Reset ${label.toLowerCase()}`} />}
    >
      <input
        id={id}
        type="text"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          setTouched(true);
        }}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={cn(
          "h-6 w-full rounded-md border border-zinc-200 bg-zinc-50 px-2 text-xs text-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300",
        )}
      />
    </InspectorPropertyRow>
  );
}

/**
 * Option's semantic concerns (Checkpoint 1.13): Label (node.text — the
 * visible dropdown text, edited here since Option never uses
 * useEditableText on the Canvas — see OptionElement's own doc comment),
 * Value (node.value — the native submitted value, reusing the exact same
 * generic setElementValue Input/Textarea's Default Value field already
 * uses), and Selected (a boolean toggle backed by the parent-aware
 * setSelectSelectedOption command rather than an independent per-node
 * toggle, so the single-select invariant — at most one sibling Option
 * selected at a time — can never be violated from this UI). Turning
 * Selected ON selects this Option (clearing every sibling in the same
 * mutation); turning it OFF clears the authored selection entirely
 * (native falls back to its own first-option default) rather than
 * leaving the Select with no valid selected reference.
 */
export function InspectorOptionSection({ node, parentId }: InspectorOptionSectionProps) {
  const setElementText = useEditorStore((state) => state.setElementText);
  const setElementValue = useEditorStore((state) => state.setElementValue);
  const setSelectSelectedOption = useEditorStore((state) => state.setSelectSelectedOption);

  function handleSelectedChange(checked: boolean) {
    if (!parentId) return;
    setSelectSelectedOption(parentId, checked ? node.id : undefined);
  }

  return (
    <InspectorSection label="Option" defaultOpen>
      <OptionTextField
        id="option-label"
        label="Label"
        value={node.text ?? ""}
        onCommit={(value) => setElementText(node.id, value)}
      />
      <OptionTextField
        id="option-value"
        label="Value"
        value={node.value ?? ""}
        hasExplicitValue={node.value !== undefined}
        onCommit={(value) => setElementValue(node.id, value)}
        onReset={() => setElementValue(node.id, undefined)}
      />
      <InspectorPropertyRow label="Selected">
        <InspectorBooleanToggle checked={node.selected ?? false} onChange={handleSelectedChange} label="Selected" />
      </InspectorPropertyRow>
    </InspectorSection>
  );
}
