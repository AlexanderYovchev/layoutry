"use client";

import { useDraggable } from "@dnd-kit/core";
import type { CatalogCardPlaceholder } from "@/components/layout/creationToolbarCategories";
import { cn } from "@/lib/utils";

interface CatalogCardProps {
  card: CatalogCardPlaceholder;
  registerRef?: (el: HTMLButtonElement | null) => void;
  /** Click-to-insert — the keyboard-accessible path; native <button> already fires this on Enter/Space. */
  onActivate?: (card: CatalogCardPlaceholder) => void;
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
 */
export function CatalogCard({ card, registerRef, onActivate }: CatalogCardProps) {
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
        "flex w-full items-start gap-2 rounded-md px-3 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed",
        isDragging && "opacity-40",
      )}
      {...listeners}
    >
      <span
        aria-hidden="true"
        className="mt-0.5 size-8 shrink-0 rounded-md border border-dashed border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-zinc-600 dark:text-zinc-400">
          {card.name}
        </span>
        <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
          {card.description}
        </span>
      </span>
    </button>
  );
}
