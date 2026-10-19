"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import {
  creationToolbarCategories,
  type CatalogCardPlaceholder,
} from "@/components/layout/creationToolbarCategories";
import { categoryAppearance } from "@/components/layout/creationToolbarCategoryAppearance";
import { ToolbarCategoryTrigger } from "@/components/layout/ToolbarCategoryTrigger";

interface CreationToolbarProps {
  onActivateCard?: (card: CatalogCardPlaceholder) => void;
}

export function CreationToolbar({ onActivateCard }: CreationToolbarProps) {
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);
  const [currentCategoryId, setCurrentCategoryId] = useState(
    creationToolbarCategories[0].id,
  );
  const triggerRefs = useRef(new Map<string, HTMLButtonElement>());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openCategoryId) return;

    function handlePointerDown(event: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpenCategoryId(null);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [openCategoryId]);

  function moveFocus(fromId: string, direction: 1 | -1) {
    const ids = creationToolbarCategories.map((category) => category.id);
    const index = ids.indexOf(fromId);
    if (index === -1) return;
    const nextIndex = (index + direction + ids.length) % ids.length;
    const nextId = ids[nextIndex];
    triggerRefs.current.get(nextId)?.focus();
    setOpenCategoryId((current) => (current ? nextId : current));
  }

  return (
    <div
      ref={containerRef}
      role="toolbar"
      aria-label="Creation toolbar"
      className="border-line bg-surface-toolbar flex h-14 shrink-0 items-center justify-between gap-4 border-b px-4 max-lg:gap-2 max-lg:px-3"
    >
      <div className="flex items-center gap-2 max-lg:gap-1">
        {creationToolbarCategories.map((category) => (
          <ToolbarCategoryTrigger
            key={category.id}
            category={category}
            icon={categoryAppearance[category.id].icon}
            accent={categoryAppearance[category.id].accent}
            isOpen={openCategoryId === category.id}
            isCurrent={currentCategoryId === category.id}
            registerTriggerRef={(el) => {
              if (el) triggerRefs.current.set(category.id, el);
              else triggerRefs.current.delete(category.id);
            }}
            onOpen={() => setOpenCategoryId(category.id)}
            onClose={(returnFocus) => {
              setOpenCategoryId(null);
              if (returnFocus) triggerRefs.current.get(category.id)?.focus();
            }}
            onHoverSwitch={() => {
              if (openCategoryId && openCategoryId !== category.id) {
                setOpenCategoryId(category.id);
              }
            }}
            onFocusTrigger={() => setCurrentCategoryId(category.id)}
            onMoveFocus={(direction) => moveFocus(category.id, direction)}
            onActivateCard={onActivateCard}
          />
        ))}
      </div>

      <label className="rounded-control border-line bg-surface-panel text-fg-muted flex h-9 w-64 min-w-28 shrink items-center gap-2 border px-3">
        <Search aria-hidden="true" className="size-4 shrink-0" />
        <span className="sr-only">Search elements</span>
        <input
          type="search"
          disabled
          placeholder="Search elements"
          className="text-fg-primary placeholder:text-fg-muted w-full min-w-0 bg-transparent text-sm focus:outline-none disabled:cursor-not-allowed"
        />
      </label>
    </div>
  );
}
