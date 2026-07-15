"use client";

import { useRef, type KeyboardEvent } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CatalogCard } from "@/components/layout/CatalogCard";
import { CatalogSearchField } from "@/components/layout/CatalogSearchField";
import { useDismissableTransition } from "@/components/ui/motion/useDismissableTransition";
import type { ToolbarCategoryContent } from "@/components/layout/creationToolbarCategories";

// Matches the duration-200 transition on the catalog panel itself, so it
// stays mounted exactly as long as its exit fade plays.
const CATALOG_PANEL_EXIT_DURATION_MS = 200;

interface ToolbarCategoryTriggerProps {
  category: ToolbarCategoryContent;
  icon: LucideIcon;
  isOpen: boolean;
  /** Whether this trigger is the toolbar's single roving tab stop (WAI-ARIA toolbar pattern). */
  isCurrent: boolean;
  registerTriggerRef: (el: HTMLButtonElement | null) => void;
  onOpen: () => void;
  onClose: (returnFocus: boolean) => void;
  onHoverSwitch: () => void;
  onFocusTrigger: () => void;
  onMoveFocus: (direction: 1 | -1) => void;
}

export function ToolbarCategoryTrigger({
  category,
  icon: Icon,
  isOpen,
  isCurrent,
  registerTriggerRef,
  onOpen,
  onClose,
  onHoverSwitch,
  onFocusTrigger,
  onMoveFocus,
}: ToolbarCategoryTriggerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { shouldRender, isVisible } = useDismissableTransition(
    isOpen,
    CATALOG_PANEL_EXIT_DURATION_MS,
  );

  // A ref callback (not an effect keyed on isOpen) so focus lands the
  // instant the panel actually mounts, regardless of the extra render
  // shouldRender takes to catch up to isOpen.
  function registerPanelRef(el: HTMLDivElement | null) {
    panelRef.current = el;
    if (el && isOpen) {
      el.focus();
    }
  }

  function handleTriggerClick() {
    if (isOpen) {
      onClose(false);
    } else {
      onOpen();
    }
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    switch (event.key) {
      case "Enter":
      case " ":
      case "ArrowDown":
        event.preventDefault();
        onOpen();
        break;
      case "ArrowUp":
        event.preventDefault();
        onOpen();
        break;
      case "ArrowRight":
        event.preventDefault();
        onMoveFocus(1);
        break;
      case "ArrowLeft":
        event.preventDefault();
        onMoveFocus(-1);
        break;
      case "Escape":
        if (isOpen) {
          event.preventDefault();
          onClose(false);
        }
        break;
    }
  }

  function handlePanelKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    switch (event.key) {
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        onClose(true);
        break;
      case "ArrowRight":
        event.preventDefault();
        onMoveFocus(1);
        break;
      case "ArrowLeft":
        event.preventDefault();
        onMoveFocus(-1);
        break;
      case "Tab":
        onClose(false);
        break;
      // ArrowUp/ArrowDown/Home/End/Enter intentionally have nothing to do
      // yet: every card is disabled until the real catalog is built.
    }
  }

  return (
    <div className="relative">
      <button
        ref={registerTriggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        tabIndex={isCurrent ? 0 : -1}
        onClick={handleTriggerClick}
        onMouseEnter={onHoverSwitch}
        onFocus={onFocusTrigger}
        onKeyDown={handleTriggerKeyDown}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors duration-100 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 active:bg-zinc-200 dark:active:bg-zinc-800",
          isOpen
            ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
            : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900",
        )}
      >
        <Icon aria-hidden="true" className="size-4" />
        {category.label}
        <ChevronDown
          aria-hidden="true"
          className="size-3.5 text-zinc-400 dark:text-zinc-600"
        />
      </button>

      {shouldRender && (
        <div
          inert={!isOpen}
          aria-hidden={!isOpen}
          className={cn(
            "absolute z-50 mt-1 flex max-h-[70vh] w-72 flex-col rounded-md border border-zinc-200 bg-white shadow-md transition-[opacity,transform] duration-200 ease-out dark:border-zinc-800 dark:bg-zinc-950",
            isVisible
              ? "translate-y-0 opacity-100"
              : "-translate-y-1 opacity-0",
          )}
        >
          <CatalogSearchField categoryLabel={category.label} />

          {/*
           * role="menu" belongs on this scrollable card list, not the
           * outer popup shell above — the search field is a plain text
           * input, and ARIA's menu role doesn't permit an <input> as a
           * direct child. tabIndex=0 (not -1) keeps this reachable by
           * keyboard even though every card inside is still disabled —
           * without it, there'd be no way to keyboard-scroll the list.
           */}
          <div
            ref={registerPanelRef}
            role="menu"
            aria-label={`${category.label} elements`}
            tabIndex={0}
            onKeyDown={handlePanelKeyDown}
            className="min-h-0 flex-1 overflow-y-auto py-1"
          >
            {category.sections.map((section) => (
              <div
                key={section.id}
                role="group"
                aria-labelledby={`${section.id}-label`}
              >
                <p
                  id={`${section.id}-label`}
                  className="px-3 pt-2 pb-1 text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400"
                >
                  {section.label}
                </p>
                {section.cards.map((card) => (
                  <CatalogCard key={card.id} card={card} />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
