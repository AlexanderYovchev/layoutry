"use client";

import { useState } from "react";
import { InspectorNumberFieldRow } from "@/features/inspector/components/InspectorNumberFieldRow";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { clampEdgeValues, getElementSpacing } from "@/features/editor/types/spacing";
import type { EdgeValues } from "@/features/editor/types/spacing";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorSpacingSectionProps {
  node: EditorElementNode;
}

interface EdgeGroupProps {
  label: string;
  values: EdgeValues;
  onCommit: (edges: EdgeValues) => void;
  /** The owning node's id, used only to detect a *selection* change (see the reset below) — never read for any other purpose. */
  nodeId: string;
}

/**
 * One margin or padding group: a link/unlink toggle over either a single
 * "all sides" field (linked — the common case, one value applied to all
 * four sides atomically) or four independent Top/Right/Bottom/Left
 * fields (unlinked). Values that fail validation (non-finite, or the
 * whole update if any single side is invalid — see clampEdgeValues) are
 * silently discarded rather than partially applied; InspectorNumberFieldRow
 * already guarantees only finite numbers ever reach onCommit.
 */
function EdgeGroup({ label, values, onCommit, nodeId }: EdgeGroupProps) {
  const [linked, setLinked] = useState(
    () => values.top === values.right && values.right === values.bottom && values.bottom === values.left,
  );

  // Re-derives the linked/unlinked toggle only when the *selection*
  // itself changes, not on every values update (a user unlinking and
  // editing just one side must not snap back to "linked" just because
  // that edit made the four sides differ). Selecting a different
  // sibling keeps this component mounted at the same tree position, so
  // a plain useState initializer alone would leave this toggle stuck at
  // whichever node was selected first — same fix as
  // InspectorGridChildSection/InspectorFlexChildSection.
  const [lastNodeId, setLastNodeId] = useState(nodeId);
  if (nodeId !== lastNodeId) {
    setLastNodeId(nodeId);
    setLinked(values.top === values.right && values.right === values.bottom && values.bottom === values.left);
  }

  function commitLinked(value: number) {
    const clamped = clampEdgeValues({ top: value, right: value, bottom: value, left: value });
    if (clamped) onCommit(clamped);
  }

  function commitSide(side: keyof EdgeValues, value: number) {
    const clamped = clampEdgeValues({ ...values, [side]: value });
    if (clamped) onCommit(clamped);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">{label}</span>
        <button
          type="button"
          onClick={() => setLinked((prev) => !prev)}
          aria-pressed={linked}
          className="rounded px-1.5 py-0.5 text-[11px] text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          {linked ? "Linked" : "Unlinked"}
        </button>
      </div>
      {linked ? (
        <InspectorNumberFieldRow label={`${label} (all sides)`} value={values.top} onCommit={commitLinked} />
      ) : (
        <>
          <InspectorNumberFieldRow label="Top" value={values.top} onCommit={(v) => commitSide("top", v)} />
          <InspectorNumberFieldRow label="Right" value={values.right} onCommit={(v) => commitSide("right", v)} />
          <InspectorNumberFieldRow label="Bottom" value={values.bottom} onCommit={(v) => commitSide("bottom", v)} />
          <InspectorNumberFieldRow label="Left" value={values.left} onCommit={(v) => commitSide("left", v)} />
        </>
      )}
    </div>
  );
}

/**
 * A simple nested-box illustration of the margin/padding/content
 * relationship — not an interactive graphical editor (explicitly out of
 * scope for this checkpoint), just enough to make the relationship
 * unambiguous alongside the numeric fields below it.
 */
function BoxModelDiagram() {
  return (
    <div
      aria-hidden="true"
      className="rounded border border-dashed border-zinc-300 p-3 text-center text-[9px] font-medium tracking-wide text-zinc-400 uppercase dark:border-zinc-700 dark:text-zinc-500"
    >
      Margin
      <div className="mt-1 rounded border border-zinc-300 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900">
        Padding
        <div className="mt-1 rounded bg-white p-2 normal-case text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
          Content
        </div>
      </div>
    </div>
  );
}

/**
 * Margin + padding controls for any selected element (Checkpoint 3.5) —
 * not just containers, matching "the architecture should safely support
 * padding on any rendered box." Padding changes on a Free container are
 * the containment-critical path: see useEditorStore.setElementPadding,
 * which re-normalizes every direct child into the new content bounds in
 * the same atomic write this section's commit triggers.
 */
export function InspectorSpacingSection({ node }: InspectorSpacingSectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const setElementMargin = useEditorStore((state) => state.setElementMargin);
  const setElementPadding = useEditorStore((state) => state.setElementPadding);
  const spacing = getElementSpacing(node);

  return (
    <InspectorSection label="Spacing" isOpen={isOpen} onToggle={() => setIsOpen((open) => !open)}>
      <BoxModelDiagram />
      <EdgeGroup label="Margin" values={spacing.margin} nodeId={node.id} onCommit={(edges) => setElementMargin(node.id, edges)} />
      <EdgeGroup label="Padding" values={spacing.padding} nodeId={node.id} onCommit={(edges) => setElementPadding(node.id, edges)} />
    </InspectorSection>
  );
}
