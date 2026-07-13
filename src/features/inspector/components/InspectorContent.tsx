"use client";

import { useState } from "react";
import { InspectorElementSummary } from "@/features/inspector/components/InspectorElementSummary";
import { InspectorFieldRow } from "@/features/inspector/components/InspectorFieldRow";
import { InspectorHeader } from "@/features/inspector/components/InspectorHeader";
import { InspectorPlaceholder } from "@/features/inspector/components/InspectorPlaceholder";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { InspectorSegmentedRow } from "@/features/inspector/components/InspectorSegmentedRow";
import type { MockSelectedElement } from "@/features/inspector/types/inspector";

interface InspectorContentProps {
  /**
   * Static demonstration data only — real element selection does not
   * exist yet. Left null in the shipped app; a mock value can be passed
   * in during development to validate the selected-element architecture.
   */
  selectedElement?: MockSelectedElement | null;
}

export function InspectorContent({
  selectedElement = null,
}: InspectorContentProps) {
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

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <InspectorHeader
        statusLabel={selectedElement ? "1 element selected" : "No selection"}
      />

      {selectedElement ? (
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
