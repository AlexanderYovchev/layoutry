"use client";

import { useRef, type KeyboardEvent } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/utils";
import {
  resourcePanelSections,
  type ResourceSectionId,
} from "@/components/layout/resourcePanelSections";

interface ResourceNavigationRailProps {
  activeSectionId: ResourceSectionId;
  onSelect: (sectionId: ResourceSectionId) => void;
  /** Whether the Resource panel is collapsed to just this rail. */
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** id of the collapsible content region the toggle controls (aria-controls). */
  contentId: string;
}

export function ResourceNavigationRail({
  activeSectionId,
  onSelect,
  collapsed,
  onToggleCollapsed,
  contentId,
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
    // Rounded on its own (inner radius of the 12px card) rather than relying
    // on the card's overflow clipping, which is turned off while collapsed so
    // the section tooltips can extend past the narrow rail.
    <div
      className={cn(
        "bg-surface-panel-secondary flex w-14 shrink-0 flex-col items-center py-2",
        collapsed
          ? "rounded-[11px]"
          : "border-line-subtle rounded-l-[11px] border-r",
      )}
    >
      <div
        role="tablist"
        aria-orientation="vertical"
        aria-label="Resource categories"
        className="flex flex-col items-center gap-1"
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

      {/* Outside the tablist (a tablist may only contain tabs). */}
      <div className="mt-auto pt-2">
        <Tooltip
          placement="top"
          label={collapsed ? "Expand panel" : "Collapse panel"}
        >
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={
              collapsed ? "Expand Resource panel" : "Collapse Resource panel"
            }
            aria-expanded={!collapsed}
            aria-controls={contentId}
            className="rounded-control ease-studio focus-visible:outline-accent text-fg-secondary hover:bg-surface-hover hover:text-fg-primary active:bg-surface-selected flex size-10 items-center justify-center transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2"
          >
            {collapsed ? (
              <PanelLeftOpen aria-hidden="true" className="size-5" />
            ) : (
              <PanelLeftClose aria-hidden="true" className="size-5" />
            )}
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
