"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CatalogCard } from "@/components/layout/CatalogCard";
import { CatalogSearchField } from "@/components/layout/CatalogSearchField";
import type { ToolbarCategoryContent } from "@/components/layout/creationToolbarCategories";

interface ToolbarCategoryTriggerProps {
  category: ToolbarCategoryContent;
  icon: LucideIcon;
  isOpen: boolean;
  registerTriggerRef: (el: HTMLButtonElement | null) => void;
  onOpen: () => void;
  onClose: (returnFocus: boolean) => void;
  onHoverSwitch: () => void;
  onMoveFocus: (direction: 1 | -1) => void;
}

export function ToolbarCategoryTrigger({
  category,
  icon: Icon,
  isOpen,
  registerTriggerRef,
  onOpen,
  onClose,
  onHoverSwitch,
  onMoveFocus,
}: ToolbarCategoryTriggerProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      panelRef.current?.focus();
    }
  }, [isOpen]);

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
        onClick={handleTriggerClick}
        onMouseEnter={onHoverSwitch}
        onKeyDown={handleTriggerKeyDown}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm",
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

      {isOpen && (
        <div
          ref={panelRef}
          role="menu"
          aria-label={`${category.label} elements`}
          tabIndex={-1}
          onKeyDown={handlePanelKeyDown}
          className="absolute z-50 mt-1 flex max-h-[70vh] w-72 flex-col rounded-md border border-zinc-200 bg-white shadow-md dark:border-zinc-800 dark:bg-zinc-950"
        >
          <CatalogSearchField categoryLabel={category.label} />

          <div className="min-h-0 flex-1 overflow-y-auto py-1">
            {category.sections.map((section) => (
              <div
                key={section.id}
                role="group"
                aria-labelledby={`${section.id}-label`}
              >
                <p
                  id={`${section.id}-label`}
                  className="px-3 pt-2 pb-1 text-xs font-semibold tracking-wide text-zinc-400 uppercase dark:text-zinc-600"
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
