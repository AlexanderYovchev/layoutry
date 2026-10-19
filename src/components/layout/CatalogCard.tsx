"use client";

import { useDraggable } from "@dnd-kit/core";
import type { CatalogCardPlaceholder } from "@/components/layout/creationToolbarCategories";
import { cn } from "@/lib/utils";

interface CatalogCardProps {
  card: CatalogCardPlaceholder;
  registerRef?: (el: HTMLButtonElement | null) => void;
  /** Click-to-insert — the keyboard-accessible path; native <button> already fires this on Enter/Space. */
  onActivate?: (card: CatalogCardPlaceholder) => void;
  /** Border/background/text classes for the icon tile, e.g. a toolbar category's accent tint. Defaults to a neutral tile. */
  iconClassName?: string;
}

/**
 * Represents one catalog entry. Enabled cards (those with an
 * elementType) support click-to-insert and, additively, drag-to-insert
 * via dnd-kit — deliberately only its pointer `listeners`, not its
 * `attributes`, since dnd-kit's default ARIA role/tabIndex would
 * override this card's existing, already-accessibility-audited
 * role="menuitem" semantics. Drag is a pointer-only enhancement layered
 * on top of the fully keyboard-accessible click path, not a replacement
 * for it.
 *
 * Interactive affordance (hover/focus-visible/active) is applied purely
 * via the `enabled:` Tailwind variant rather than a JS hover-state or an
 * `isDragging`-style conditional, so disabled cards are structurally
 * incapable of showing it — there's no branch to accidentally leave on.
 * The hover/active scale uses `transform`, which never affects layout,
 * so neighboring cards never shift.
 */
export function CatalogCard({
  card,
  registerRef,
  onActivate,
  iconClassName = "border-line bg-surface-panel-secondary text-fg-secondary",
}: CatalogCardProps) {
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: card.id,
    data: { kind: "insert", elementType: card.elementType, label: card.name },
    disabled: card.disabled,
  });

  function setRef(el: HTMLButtonElement | null) {
    setNodeRef(el);
    registerRef?.(el);
  }

  return (
    <button
      ref={setRef}
      type="button"
      role="menuitem"
      disabled={card.disabled}
      tabIndex={card.disabled ? -1 : 0}
      onClick={() => onActivate?.(card)}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-control border border-transparent px-2 py-1.5 text-left transition-[transform,background-color,border-color,box-shadow] duration-150 ease-studio",
        "enabled:cursor-pointer enabled:hover:scale-[1.02] enabled:hover:border-line enabled:hover:bg-surface-hover enabled:hover:shadow-panel",
        "enabled:focus-visible:scale-[1.02] enabled:focus-visible:border-line enabled:focus-visible:bg-surface-hover",
        "enabled:active:scale-100 enabled:active:bg-surface-selected",
        "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-55",
        isDragging && "opacity-40",
      )}
      {...listeners}
    >
      {card.icon ? (
        <span
          aria-hidden="true"
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-control border",
            iconClassName,
          )}
        >
          <card.icon className="size-4" />
        </span>
      ) : (
        <span
          aria-hidden="true"
          className="size-8 shrink-0 rounded-control border border-dashed border-line bg-surface-panel-secondary"
        />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-fg-primary">
          {card.name}
        </span>
        <span className="block truncate text-xs text-fg-secondary">
          {card.description}
        </span>
      </span>
    </button>
  );
}
