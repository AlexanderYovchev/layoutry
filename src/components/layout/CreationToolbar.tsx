"use client";

import { useEffect, useRef, useState } from "react";
import {
  Code2,
  Component,
  Image,
  LayoutGrid,
  Palette,
  Search,
  TextCursorInput,
  type LucideIcon,
} from "lucide-react";
import {
  creationToolbarCategories,
  type CatalogCardPlaceholder,
} from "@/components/layout/creationToolbarCategories";
import { ToolbarCategoryTrigger } from "@/components/layout/ToolbarCategoryTrigger";

const categoryIcons: Record<string, LucideIcon> = {
  html: Code2,
  components: Component,
  layout: LayoutGrid,
  media: Image,
  forms: TextCursorInput,
  styles: Palette,
};

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
      className="border-line bg-surface-toolbar flex h-12 shrink-0 items-center justify-between gap-4 border-b px-3"
    >
      <div className="flex items-center gap-1">
        {creationToolbarCategories.map((category) => (
          <ToolbarCategoryTrigger
            key={category.id}
            category={category}
            icon={categoryIcons[category.id]}
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

      <label className="flex w-48 shrink-0 items-center gap-1.5 rounded-md border border-zinc-200 px-2 py-1.5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        <Search aria-hidden="true" className="size-4" />
        <span className="sr-only">Search elements</span>
        <input
          type="search"
          disabled
          placeholder="Search elements"
          className="w-full bg-transparent text-sm text-zinc-600 placeholder:text-zinc-400 focus:outline-none disabled:cursor-not-allowed dark:text-zinc-300 dark:placeholder:text-zinc-500"
        />
      </label>
    </div>
  );
}
