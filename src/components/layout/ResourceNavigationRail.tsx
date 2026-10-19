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
                "relative flex size-10 items-center justify-center rounded-md transition-colors duration-100 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 active:bg-zinc-200 dark:active:bg-zinc-800",
                isActive
                  ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
                  : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-300",
              )}
            >
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-zinc-900 dark:bg-zinc-100"
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
