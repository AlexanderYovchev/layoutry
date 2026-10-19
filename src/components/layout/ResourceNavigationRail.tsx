"use client";

import { useRef, type KeyboardEvent } from "react";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/utils";
import {
  resourcePanelSections,
  type ResourceSectionId,
} from "@/components/layout/resourcePanelSections";

interface ResourceNavigationRailProps {
  activeSectionId: ResourceSectionId;
  onSelect: (sectionId: ResourceSectionId) => void;
}

export function ResourceNavigationRail({
  activeSectionId,
  onSelect,
}: ResourceNavigationRailProps) {
  const triggerRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function moveFocus(currentIndex: number, direction: 1 | -1) {
    const total = resourcePanelSections.length;
    const nextIndex = (currentIndex + direction + total) % total;
    triggerRefs.current[nextIndex]?.focus();
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        moveFocus(index, 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        moveFocus(index, -1);
        break;
    }
  }

  return (
    <div
      role="tablist"
      aria-orientation="vertical"
      aria-label="Resource categories"
      className="border-line-subtle bg-surface-panel-secondary flex w-14 shrink-0 flex-col items-center gap-1 border-r py-2"
    >
      {resourcePanelSections.map((section, index) => {
        const isActive = section.id === activeSectionId;

        return (
          <Tooltip key={section.id} label={section.label}>
            <button
              ref={(el) => {
                triggerRefs.current[index] = el;
              }}
              type="button"
              role="tab"
              id={`resource-tab-${section.id}`}
              aria-selected={isActive}
              aria-controls={`resource-panel-${section.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onSelect(section.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={cn(
                "rounded-control ease-studio focus-visible:outline-accent active:bg-surface-selected relative flex size-10 items-center justify-center transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2",
                isActive
                  ? "bg-surface-selected text-accent"
                  : "text-fg-secondary hover:bg-surface-hover hover:text-fg-primary",
              )}
            >
              {isActive && (
                <span
                  aria-hidden="true"
                  className="bg-accent absolute inset-y-2 -left-2 w-0.75 rounded-r-full"
                />
              )}
              <section.icon aria-hidden="true" className="size-5" />
              <span className="sr-only">{section.label}</span>
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
