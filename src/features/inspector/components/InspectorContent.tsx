"use client";

import { Eye } from "lucide-react";
import { useState } from "react";
import { InspectorElementSummary } from "@/features/inspector/components/InspectorElementSummary";
import { InspectorFieldRow } from "@/features/inspector/components/InspectorFieldRow";
import { InspectorHeader } from "@/features/inspector/components/InspectorHeader";
import { InspectorMultiNodeSummary } from "@/features/inspector/components/InspectorMultiNodeSummary";
import { InspectorNodeSummary } from "@/features/inspector/components/InspectorNodeSummary";
import { InspectorPlaceholder } from "@/features/inspector/components/InspectorPlaceholder";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { InspectorSegmentedRow } from "@/features/inspector/components/InspectorSegmentedRow";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { useSelectedNodes } from "@/features/editor/hooks/useSelectedNode";
import type { MockSelectedElement } from "@/features/inspector/types/inspector";

interface InspectorContentProps {
  /**
   * Static demonstration data for the future CSS Inspector's section/row
   * layout only — unrelated to real selection, which is read directly
   * from the shared editor store below and always takes priority when
   * present. Left null in the shipped app; a mock value can be passed in
   * during development to validate the CSS-editing information
   * architecture ahead of M6.
   */
  selectedElement?: MockSelectedElement | null;
}

export function InspectorContent({
  selectedElement = null,
}: InspectorContentProps) {
  const isPreview = useEditorStore((state) => state.editorMode === "preview");
  const { nodes: selectedNodes, primary } = useSelectedNodes();
  const isMultiSelection = selectedNodes.length > 1;
  const selected = isMultiSelection ? null : primary;
  const [openSectionIds, setOpenSectionIds] = useState<Set<string>>(
    () =>
      new Set(
        selectedElement?.sections
          .filter((section) => section.defaultOpen)
          .map((section) => section.id),
      ),
  );

  function toggleSection(id: string) {
    setOpenSectionIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const hasSelection = selected !== null || selectedElement !== null || isMultiSelection;
  const statusLabel = isMultiSelection
    ? `${selectedNodes.length} elements selected`
    : hasSelection
      ? "1 element selected"
      : "No selection";

  // Preview Mode (Checkpoint 1.15.6.8, Part L/section 59) — the
  // minimal-change option the audit offered: keep the panel present but
  // replace its editable body with a plain explanatory placeholder,
  // rather than hiding the whole Inspector or leaving live CSS/
  // Interaction controls clickable while previewing (which would let a
  // stray Inspector edit mutate the real document while the user
  // believes they're only testing authored behavior — the same concern
  // useEditorKeyboardShortcuts' own Preview guard addresses for
  // keyboard shortcuts). Selection itself is deliberately left
  // untouched by enterPreview (see that action's own doc comment), so
  // returning to Design shows exactly what was selected before.
  if (isPreview) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <InspectorHeader statusLabel="Previewing" />
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-3 text-center">
          <Eye aria-hidden="true" className="size-5 text-zinc-300 dark:text-zinc-600" />
          <h3 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Previewing authored behavior</h3>
          <p className="max-w-56 text-sm text-zinc-500 dark:text-zinc-400">Exit Preview to select and edit elements again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <InspectorHeader statusLabel={statusLabel} />

      {isMultiSelection ? (
        <InspectorMultiNodeSummary nodes={selectedNodes.map((entry) => entry.node)} />
      ) : selected ? (
        <InspectorNodeSummary
          node={selected.node}
          parentId={selected.parentId}
          parentLayoutMode={selected.parentLayoutMode}
          parentFlowDisplay={selected.parentFlowDisplay}
        />
      ) : selectedElement ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <InspectorElementSummary
            name={selectedElement.name}
            tag={selectedElement.tag}
          />
          {selectedElement.sections.map((section) => (
            <InspectorSection
              key={section.id}
              label={section.label}
              isOpen={openSectionIds.has(section.id)}
              onToggle={() => toggleSection(section.id)}
            >
              {section.rows.map((row) =>
                row.kind === "segmented" ? (
                  <InspectorSegmentedRow
                    key={row.id}
                    label={row.label}
                    options={row.options}
                    activeOption={row.activeOption}
                  />
                ) : (
                  <InspectorFieldRow
                    key={row.id}
                    label={row.label}
                    value={row.value}
                  />
                ),
              )}
            </InspectorSection>
          ))}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center p-3">
          <InspectorPlaceholder />
        </div>
      )}
    </div>
  );
}
