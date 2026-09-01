"use client";

import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import {
  getTableBodyCellIds,
  getTableCellIds,
  getTableFooterCellIds,
  getTableHeaderCellIds,
  getTableRowCellIds,
} from "@/features/editor/types/table";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorTableSelectionSectionProps {
  node: EditorElementNode;
}

/**
 * Table's own bulk-selection entry point (Checkpoint 1.15.2, Part D of
 * its own report) — solves the exact manual-QA pain point that started
 * this checkpoint (styling table cells one at a time) without inventing
 * any synthetic "Cell Group" concept: every button here just calls the
 * ordinary setSelection action with real th/td node ids collected from
 * the genuine document tree (see types/table.ts's own cell-id helpers).
 * The resulting selection is completely indistinguishable from one the
 * user built by hand, Ctrl-clicking each cell — that's the whole
 * architectural point. Column selection is deliberately not offered
 * (columns are implicit, not real parent nodes here — see this
 * checkpoint's report for why that was judged not "trivial and robust"
 * enough for this first foundation).
 */
export function InspectorTableSelectionSection({ node }: InspectorTableSelectionSectionProps) {
  const setSelection = useEditorStore((state) => state.setSelection);

  const buttons: { label: string; ids: string[] }[] =
    node.tag === "table"
      ? [
          { label: "All Cells", ids: getTableCellIds(node) },
          { label: "Header Cells", ids: getTableHeaderCellIds(node) },
          { label: "Body Cells", ids: getTableBodyCellIds(node) },
          { label: "Footer Cells", ids: getTableFooterCellIds(node) },
        ]
      : [{ label: "Cells in Row", ids: getTableRowCellIds(node) }];

  return (
    <InspectorSection label="Select">
      <div className="flex flex-wrap gap-1.5">
        {buttons.map(({ label, ids }) => (
          <button
            key={label}
            type="button"
            disabled={ids.length === 0}
            onClick={() => setSelection(ids)}
            className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-700 transition-colors duration-100 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {label}
          </button>
        ))}
      </div>
    </InspectorSection>
  );
}
