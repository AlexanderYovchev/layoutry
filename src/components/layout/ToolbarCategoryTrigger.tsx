"use client";

import { useRef, type KeyboardEvent } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CatalogCard } from "@/components/layout/CatalogCard";
import { CatalogSearchField } from "@/components/layout/CatalogSearchField";
import type { ToolbarCategoryAccent } from "@/components/layout/creationToolbarCategoryAppearance";
import { useDismissableTransition } from "@/components/ui/motion/useDismissableTransition";
import type {
  CatalogCardPlaceholder,
  ToolbarCategoryContent,
} from "@/components/layout/creationToolbarCategories";

// Matches the duration-200 transition on the catalog panel itself, so it
// stays mounted exactly as long as its exit fade plays.
const CATALOG_PANEL_EXIT_DURATION_MS = 200;

interface ToolbarCategoryTriggerProps {
  category: ToolbarCategoryContent;
  icon: LucideIcon;
  accent: ToolbarCategoryAccent;
  isOpen: boolean;
  /** Whether this trigger is the toolbar's single roving tab stop (WAI-ARIA toolbar pattern). */
  isCurrent: boolean;
  registerTriggerRef: (el: HTMLButtonElement | null) => void;
  onOpen: () => void;
  onClose: (returnFocus: boolean) => void;
  onHoverSwitch: () => void;
  onFocusTrigger: () => void;
  onMoveFocus: (direction: 1 | -1) => void;
  onActivateCard?: (card: CatalogCardPlaceholder) => void;
}

export function ToolbarCategoryTrigger({
  category,
  icon: Icon,
  accent,
  isOpen,
  isCurrent,
  registerTriggerRef,
  onOpen,
  onClose,
  onHoverSwitch,
  onFocusTrigger,
  onMoveFocus,
  onActivateCard,
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
          // The 1px border exists in every state (transparent at rest),
          // so opening never changes the trigger's size and the toolbar
          // never shifts.
          "rounded-control text-fg-primary ease-studio focus-visible:outline-accent flex h-9 items-center gap-2 border border-transparent px-3 text-sm font-medium transition-[background-color,border-color,box-shadow] duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 active:brightness-95 max-lg:gap-1.5 max-lg:px-2",
          isOpen ? cn(accent.open, "shadow-panel") : accent.rest,
        )}
      >
        <Icon
          aria-hidden="true"
          className={cn("size-4 shrink-0", accent.icon)}
        />
        {category.label}
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "ease-studio size-3.5 shrink-0 transition-transform duration-150",
            isOpen ? cn("rotate-180", accent.icon) : "text-fg-muted",
          )}
        />
      </button>

      {shouldRender && (
        <div
          inert={!isOpen}
          aria-hidden={!isOpen}
          className={cn(
            "rounded-card border-line bg-surface-panel shadow-elevated ease-studio absolute z-50 mt-2 flex max-h-[70vh] w-72 flex-col overflow-hidden border transition-[opacity,transform] duration-200",
            isVisible
              ? "translate-y-0 opacity-100"
              : "-translate-y-1.5 opacity-0",
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
            className="focus-visible:outline-accent min-h-0 flex-1 overflow-y-auto p-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2"
          >
            {category.sections.map((section) => (
              <div
                key={section.id}
                role="group"
                aria-labelledby={`${section.id}-label`}
              >
                <p
                  id={`${section.id}-label`}
                  className="text-fg-secondary px-2 pt-2.5 pb-1 text-[11px] font-semibold tracking-wider uppercase"
                >
                  {section.label}
                </p>
                {section.cards.map((card) => (
                  <CatalogCard
                    key={card.id}
                    card={card}
                    iconClassName={accent.iconBox}
                    onActivate={(activatedCard) => {
                      onActivateCard?.(activatedCard);
                      onClose(true);
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
