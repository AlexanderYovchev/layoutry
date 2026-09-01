"use client";

import { useState } from "react";
import { InspectorElementSummary } from "@/features/inspector/components/InspectorElementSummary";
import { InspectorFieldRow } from "@/features/inspector/components/InspectorFieldRow";
import { InspectorHeader } from "@/features/inspector/components/InspectorHeader";
import { InspectorMultiNodeSummary } from "@/features/inspector/components/InspectorMultiNodeSummary";
import { InspectorNodeSummary } from "@/features/inspector/components/InspectorNodeSummary";
import { InspectorPlaceholder } from "@/features/inspector/components/InspectorPlaceholder";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { InspectorSegmentedRow } from "@/features/inspector/components/InspectorSegmentedRow";
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
