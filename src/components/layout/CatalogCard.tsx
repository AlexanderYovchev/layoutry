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
 *
 * Interactive affordance (hover/focus-visible/active) is applied purely
 * via the `enabled:` Tailwind variant rather than a JS hover-state or an
 * `isDragging`-style conditional, so disabled cards are structurally
 * incapable of showing it — there's no branch to accidentally leave on.
 * The hover/active scale uses `transform`, which never affects layout,
 * so neighboring cards never shift.
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
        "flex w-full items-start gap-2 rounded-lg border border-transparent px-3 py-2 text-left transition-[transform,background-color,border-color] duration-100 ease-out",
        "enabled:cursor-pointer enabled:hover:scale-[1.02] enabled:hover:border-zinc-300 enabled:hover:bg-zinc-100 dark:enabled:hover:border-zinc-700 dark:enabled:hover:bg-zinc-900",
        "enabled:focus-visible:scale-[1.02] enabled:focus-visible:border-zinc-300 enabled:focus-visible:bg-zinc-100 dark:enabled:focus-visible:border-zinc-700 dark:enabled:focus-visible:bg-zinc-900",
        "enabled:active:scale-100 enabled:active:bg-zinc-200 dark:enabled:active:bg-zinc-800",
        "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed",
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
