"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { InspectorPropertyRow } from "@/features/inspector/components/InspectorPropertyRow";
import { InspectorResetButton } from "@/features/inspector/components/InspectorResetButton";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";
import { cn } from "@/lib/utils";

interface InspectorIdentitySectionProps {
  /** The selected node — rendered for essentially any real HTML tag (Checkpoint 1.15.1); see this checkpoint's own report, section D, for why no capability flag gates this. */
  node: EditorElementNode;
}

interface IdentityTextFieldProps {
  id: string;
  label: string;
  value: string | undefined;
  placeholder?: string;
  onCommit: (value: string | undefined) => void;
}

/**
 * A draft/commit/Escape-revert text field, built on the same two proven
 * bug fixes InspectorMediaTextField/LinkDestinationField already use
 * (`touched`, so an untouched blur never commits; a ref-gated
 * `suppressNextBlurCommitRef`, so Enter's own synchronous `blur()` call
 * never double-commits — see InspectorMediaTextField's own doc comment
 * for the full race this guards against).
 *
 * Deliberately NOT a reuse of InspectorMediaTextField despite the shared
 * lifecycle skeleton: the empty-draft behavior is the opposite. Media
 * fields treat an emptied draft as a mistake and revert it (Reset is the
 * only clear affordance there); Identity fields treat an emptied ID/Class
 * draft as a deliberate clear (Checkpoint 1.15.1's own brief, Part A,
 * section 6: "empty value clears the field") — an authored HTML id/class
 * is far more often intentionally removed mid-edit than a media URL is,
 * so collapsing the two into one shared component would need a branching
 * flag for their one genuinely different behavior, which is no simpler
 * than two small, independently readable components.
 */
function IdentityTextField({ id, label, value, placeholder, onCommit }: IdentityTextFieldProps) {
  const [draft, setDraft] = useState(value ?? "");
  const [touched, setTouched] = useState(false);
  const suppressNextBlurCommitRef = useRef(false);
  const [lastSyncedValue, setLastSyncedValue] = useState(value);
  if (value !== lastSyncedValue) {
    setLastSyncedValue(value);
    setDraft(value ?? "");
    setTouched(false);
  }

  function commit() {
    if (!touched) return;
    setTouched(false);
    const trimmed = draft.trim();
    setDraft(trimmed);
    if (trimmed === (value ?? "")) return;
    onCommit(trimmed === "" ? undefined : trimmed);
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
      setDraft(value ?? "");
      setTouched(false);
      suppressNextBlurCommitRef.current = true;
      event.currentTarget.blur();
    }
  }

  const hasExplicitValue = value !== undefined;

  return (
    <InspectorPropertyRow
      label={label}
      labelHtmlFor={id}
      variant="stack"
      state={hasExplicitValue ? "set" : "unset"}
      reset={<InspectorResetButton onReset={() => onCommit(undefined)} disabled={!hasExplicitValue} label={`Reset ${label.toLowerCase()}`} />}
    >
      <input
        id={id}
        type="text"
        value={draft}
        placeholder={placeholder}
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
 * Authored HTML identity (Checkpoint 1.15.1) — the `id`/`class` a node
 * exports as real, ordinary HTML, completely independent from this same
 * node's own internal editor identity (node.id — shown just above, in
 * InspectorNodeSummary's read-only "Node ID" row). Rendered unconditionally
 * for every node InspectorNodeSummary shows at all (no capability flag
 * gates it — see this checkpoint's report, section D): id/class are
 * meaningful on essentially any real rendered HTML tag, and the two
 * structural nodes that would be the exception (`page`/`body`) are already
 * excluded by never being selectable in the first place, so no separate
 * gate is needed here.
 *
 * Minimal validation only, matching the brief's own instruction: trim
 * accidental surrounding whitespace, and an emptied field clears the
 * field entirely (see IdentityTextField's own doc comment for why this
 * differs from the rest of the app's revert-on-empty text fields). No
 * uniqueness enforcement, no character-set validation, no silent
 * rewriting of what the user typed — deferred, see this checkpoint's
 * report, section I.
 */
export function InspectorIdentitySection({ node }: InspectorIdentitySectionProps) {
  const setElementHtmlId = useEditorStore((state) => state.setElementHtmlId);
  const setElementClassName = useEditorStore((state) => state.setElementClassName);

  return (
    <InspectorSection label="Identity">
      <IdentityTextField
        id="identity-html-id"
        label="ID"
        value={node.htmlId}
        placeholder="hero"
        onCommit={(value) => setElementHtmlId(node.id, value)}
      />
      <IdentityTextField
        id="identity-class-name"
        label="Classes"
        value={node.className}
        placeholder="hero-section featured"
        onCommit={(value) => setElementClassName(node.id, value)}
      />
    </InspectorSection>
  );
}
