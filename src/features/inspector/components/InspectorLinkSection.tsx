"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { InspectorPropertyRow } from "@/features/inspector/components/InspectorPropertyRow";
import { InspectorResetButton } from "@/features/inspector/components/InspectorResetButton";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { getLinkHref, isValidLinkHref } from "@/features/editor/types/link";
import type { EditorElementNode } from "@/features/editor/types/document";
import { cn } from "@/lib/utils";

interface InspectorLinkSectionProps {
  /** The selected node — rendered only for an href-capable tag (see InspectorNodeSummary, gated on getElementCapabilities().supportsHref — Checkpoint 1.4). */
  node: EditorElementNode;
}

interface DestinationFieldProps {
  value: string;
  onCommit: (value: string) => void;
  error?: string;
}

/**
 * A plain draft/commit/Escape-revert URL text field. Modeled on
 * InspectorBackgroundImageControls' own BackgroundImageUrlField (that
 * component's own doc comment explains why it wasn't extracted as a
 * shared primitive with only one prior consumer; the same reasoning
 * applies here, so this is a second, independent, intentionally-not-
 * yet-shared copy rather than an early abstraction) — but with two bug
 * fixes carried over from InspectorNumberFieldRow's own already-audited,
 * already-fixed version of this exact pattern (Checkpoint 5.7), since
 * this checkpoint's own history requirement ("unchanged value = no
 * unnecessary history entry") makes both genuinely load-bearing here,
 * not just cosmetic:
 *
 * 1. `touched`, set only by a real onChange and cleared on every
 *    resync/commit — without it, blurring the field with no edit at all
 *    (tabbing through it, or clicking it then clicking away) would still
 *    call onCommit with the value it already had, pushing a spurious
 *    history entry through setElementHref's own store action (the
 *    command's own no-op check only protects the *document* from
 *    changing, not the store from pushing a history snapshot regardless
 *    — pushHistory runs unconditionally inside every one-shot action).
 * 2. `suppressNextBlurCommitRef` — Enter calls event.currentTarget.blur()
 *    to visually release focus, which fires a real native blur event
 *    that this field's own onBlur would otherwise treat as an unrelated
 *    second commit of the identical already-committed draft, doubling
 *    the history entry for one keypress.
 *
 * An empty draft on blur/Enter reverts rather than committing — Reset is
 * the only clear affordance, avoiding the ambiguity of "did blurring an
 * empty field mean clear, or a mistake."
 */
function LinkDestinationField({ value, onCommit, error }: DestinationFieldProps) {
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
      setDraft(value);
      setTouched(false);
      suppressNextBlurCommitRef.current = true;
      event.currentTarget.blur();
    }
  }

  return (
    <input
      id="link-destination"
      type="text"
      aria-label="Link destination"
      aria-invalid={error ? true : undefined}
      value={draft}
      placeholder="https://example.com, /about, #pricing"
      onChange={(event) => {
        setDraft(event.target.value);
        setTouched(true);
      }}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={cn(
        "h-6 w-full rounded-md border bg-zinc-50 px-2 text-xs text-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 dark:bg-zinc-900 dark:text-zinc-300",
        error ? "border-red-400 dark:border-red-600" : "border-zinc-200 dark:border-zinc-800",
      )}
    />
  );
}

/**
 * Link's one element-content concern for this checkpoint: its
 * destination (Checkpoint 1.4). Deliberately not a CSS Inspector
 * section in spirit even though it's laid out with the same
 * InspectorSection/InspectorPropertyRow primitives every CSS section
 * uses — it edits node.href, plain element data, through
 * setElementHref, never CSS. One completed edit is one history entry
 * (setElementHref's own one-shot store shape); an unchanged value never
 * commits at all (see LinkDestinationField's empty-draft-reverts
 * behavior and setElementHref's own no-op-when-unchanged check).
 */
export function InspectorLinkSection({ node }: InspectorLinkSectionProps) {
  const setElementHref = useEditorStore((state) => state.setElementHref);
  const [error, setError] = useState<string | undefined>(undefined);

  const [lastNodeId, setLastNodeId] = useState(node.id);
  if (node.id !== lastNodeId) {
    setLastNodeId(node.id);
    setError(undefined);
  }

  const effectiveHref = getLinkHref(node);
  const hasExplicitHref = node.href !== undefined;

  function handleCommit(value: string) {
    if (!isValidLinkHref(value)) {
      setError("Enter a valid destination (javascript: links aren't allowed).");
      return;
    }
    setError(undefined);
    setElementHref(node.id, value);
  }

  function handleReset() {
    setError(undefined);
    setElementHref(node.id, undefined);
  }

  return (
    <InspectorSection label="Link" defaultOpen>
      <InspectorPropertyRow
        label="Destination"
        labelHtmlFor="link-destination"
        variant="stack"
        state={error ? "invalid" : hasExplicitHref ? "set" : "unset"}
        error={error}
        reset={<InspectorResetButton onReset={handleReset} disabled={!hasExplicitHref} label="Reset link destination" />}
      >
        <LinkDestinationField value={effectiveHref} onCommit={handleCommit} error={error} />
      </InspectorPropertyRow>
    </InspectorSection>
  );
}
