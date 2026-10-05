"use client";

import { InspectorBooleanToggle } from "@/features/inspector/components/InspectorBooleanToggle";
import { InspectorNumberFieldRow } from "@/features/inspector/components/InspectorNumberFieldRow";
import { InspectorPropertyRow } from "@/features/inspector/components/InspectorPropertyRow";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { getTableBodyRowCount, getTableCaption, getTableColumnCount, getTableFoot, getTableHead } from "@/features/editor/types/table";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorTableSectionProps {
  /** The selected node — rendered only for `table` (see InspectorNodeSummary; Table is not a getElementCapabilities flag since only one tag ever uses it, the same reasoning InspectorListSection's own doc comment already gives for ul/ol). */
  node: EditorElementNode;
}

/**
 * Table's beginner-friendly management surface (Checkpoint 1.14) — the
 * whole point being a user never has to manually assemble
 * thead/tbody/tfoot/tr/th/td by hand just to get a normal table (see this
 * checkpoint's brief, section 36: Insert Table, set Columns, set Rows,
 * toggle Header — done). Every value here is derived fresh from the
 * actual child tree (getTableColumnCount/getTableBodyRowCount/
 * getTableHead/getTableFoot — types/table.ts) rather than stored
 * separately anywhere, and every commit rewrites that same tree through
 * the dedicated setTableColumnCount/setTableBodyRowCount/
 * setTableHeaderEnabled/setTableFooterEnabled commands (tableCommands.ts)
 * — the same "count children, don't store a count" architecture List's
 * Items field and Select's Options field already established. One
 * completed edit is one history entry (each command's own action-level
 * no-op guard skips a no-op count/toggle). The Caption toggle (Checkpoint
 * 1.15.6.12.2 — setTableCaptionEnabled) follows the exact same shape as
 * Header/Footer Row: no tableCaptionText field anywhere, the authored text
 * lives entirely on the real `<caption>` child, edited directly on Canvas.
 */
export function InspectorTableSection({ node }: InspectorTableSectionProps) {
  const setTableColumnCount = useEditorStore((state) => state.setTableColumnCount);
  const setTableBodyRowCount = useEditorStore((state) => state.setTableBodyRowCount);
  const setTableHeaderEnabled = useEditorStore((state) => state.setTableHeaderEnabled);
  const setTableFooterEnabled = useEditorStore((state) => state.setTableFooterEnabled);
  const setTableCaptionEnabled = useEditorStore((state) => state.setTableCaptionEnabled);

  const columnCount = getTableColumnCount(node);
  const bodyRowCount = getTableBodyRowCount(node);
  const hasHeader = getTableHead(node) !== undefined;
  const hasFooter = getTableFoot(node) !== undefined;
  const hasCaption = getTableCaption(node) !== undefined;

  return (
    <InspectorSection label="Table" defaultOpen>
      <InspectorNumberFieldRow
        label="Columns"
        value={columnCount}
        onCommit={(value) => setTableColumnCount(node.id, Math.max(0, Math.round(value)))}
      />
      <InspectorNumberFieldRow
        label="Body Rows"
        value={bodyRowCount}
        onCommit={(value) => setTableBodyRowCount(node.id, Math.max(0, Math.round(value)))}
      />
      <InspectorPropertyRow label="Header Row">
        <InspectorBooleanToggle
          checked={hasHeader}
          onChange={(checked) => setTableHeaderEnabled(node.id, checked)}
          label="Header Row"
        />
      </InspectorPropertyRow>
      <InspectorPropertyRow label="Footer Row">
        <InspectorBooleanToggle
          checked={hasFooter}
          onChange={(checked) => setTableFooterEnabled(node.id, checked)}
          label="Footer Row"
        />
      </InspectorPropertyRow>
      <InspectorPropertyRow label="Caption">
        <InspectorBooleanToggle
          checked={hasCaption}
          onChange={(checked) => setTableCaptionEnabled(node.id, checked)}
          label="Caption"
        />
      </InspectorPropertyRow>
    </InspectorSection>
  );
}
