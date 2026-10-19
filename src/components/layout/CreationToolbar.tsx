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
import {
  ToolbarCategoryTrigger,
  type ToolbarCategoryAccent,
} from "@/components/layout/ToolbarCategoryTrigger";

interface CategoryAppearance {
  icon: LucideIcon;
  accent: ToolbarCategoryAccent;
}

// Full literal class strings per category (never assembled from the id
// at runtime) so Tailwind's source scanner sees every one of them.
// Colors come from the --ly-category-* tokens in globals.css.
const categoryAppearance: Record<string, CategoryAppearance> = {
  html: {
    icon: Code2,
    accent: {
      icon: "text-category-html",
      rest: "bg-category-html-bg/55 hover:border-category-html/30 hover:bg-category-html-bg",
      open: "border-category-html/55 bg-category-html-bg",
      iconBox: "border-category-html/20 bg-category-html-bg text-category-html",
    },
  },
  components: {
    icon: Component,
    accent: {
      icon: "text-category-components",
      rest: "bg-category-components-bg/55 hover:border-category-components/30 hover:bg-category-components-bg",
      open: "border-category-components/55 bg-category-components-bg",
      iconBox:
        "border-category-components/20 bg-category-components-bg text-category-components",
    },
  },
  layout: {
    icon: LayoutGrid,
    accent: {
      icon: "text-category-layout",
      rest: "bg-category-layout-bg/55 hover:border-category-layout/30 hover:bg-category-layout-bg",
      open: "border-category-layout/55 bg-category-layout-bg",
      iconBox:
        "border-category-layout/20 bg-category-layout-bg text-category-layout",
    },
  },
  media: {
    icon: Image,
    accent: {
      icon: "text-category-media",
      rest: "bg-category-media-bg/55 hover:border-category-media/30 hover:bg-category-media-bg",
      open: "border-category-media/55 bg-category-media-bg",
      iconBox:
        "border-category-media/20 bg-category-media-bg text-category-media",
    },
  },
  forms: {
    icon: TextCursorInput,
    accent: {
      icon: "text-category-forms",
      rest: "bg-category-forms-bg/55 hover:border-category-forms/30 hover:bg-category-forms-bg",
      open: "border-category-forms/55 bg-category-forms-bg",
      iconBox:
        "border-category-forms/20 bg-category-forms-bg text-category-forms",
    },
  },
  styles: {
    icon: Palette,
    accent: {
      icon: "text-category-styles",
      rest: "bg-category-styles-bg/55 hover:border-category-styles/30 hover:bg-category-styles-bg",
      open: "border-category-styles/55 bg-category-styles-bg",
      iconBox:
        "border-category-styles/20 bg-category-styles-bg text-category-styles",
    },
  },
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
