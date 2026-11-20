"use client";

import { Ellipsis } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { MenuDropdown } from "@/components/ui/menu/MenuDropdown";
import type { MenuItem } from "@/components/ui/menu/types";
import { useDismissableTransition } from "@/components/ui/motion/useDismissableTransition";
import { styleGroupLabel } from "@/features/editor/commands/styleClipboardCommands";
import { canCopyStyleSection, canPasteStyleSection, useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { StyleGroupKey } from "@/features/editor/types/styleClipboard";
import { cn } from "@/lib/utils";

const MENU_EXIT_DURATION_MS = 200;

interface InspectorSectionCssMenuProps {
  /** The CSS group this Inspector section owns (BC-11.2 registry key). */
  group: StyleGroupKey;
}

/**
 * BC-11.3 — a section header's "⋯" menu with Copy <section> CSS and Paste
 * <section> CSS, through the store's section commands (the one shared CSS
 * clipboard, BC-11.2's atomic paste). Reuses the application menu's own
 * MenuDropdown, so keyboard use (arrows, Home/End, Enter/Space, Escape,
 * Tab) and focus return are the menu bar's. Availability is computed only
 * while the menu is open: Copy needs authored values in this section on the
 * primary element; Paste needs this section's group in the CSS clipboard
 * and a selected element that supports it.
 */
export function InspectorSectionCssMenu({ group }: InspectorSectionCssMenuProps) {
  // BC-11.4: one display name per CSS group (the registry's), the same in every
  // Inspector mode (single, bulk, Mixed panel) and in the notices.
  const sectionLabel = styleGroupLabel(group);
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const { shouldRender, isVisible } = useDismissableTransition(isOpen, MENU_EXIT_DURATION_MS);
  const document = useEditorStore((state) => state.document);
  const selection = useEditorStore((state) => state.selection);
  const styleClipboard = useEditorStore((state) => state.styleClipboard);

  useEffect(() => {
    if (!isOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && rootRef.current?.contains(event.target)) return;
      setIsOpen(false);
    }
    window.document.addEventListener("pointerdown", handlePointerDown);
    return () => window.document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  const items: MenuItem[] = shouldRender
    ? [
        {
          type: "command",
          id: "copy",
          label: `Copy ${sectionLabel} CSS`,
          disabled: !canCopyStyleSection({ document, selection }, group),
          onSelect: () => useEditorStore.getState().copyStyleSection(group),
        },
        {
          type: "command",
          id: "paste",
          label: `Paste ${sectionLabel} CSS`,
          disabled: !canPasteStyleSection({ document, selection, styleClipboard }, group),
          onSelect: () => useEditorStore.getState().pasteStyleSection(group),
        },
      ]
    : [];

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`${sectionLabel} CSS actions`}
        title={`${sectionLabel} CSS actions`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        onClick={() => setIsOpen((open) => !open)}
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-control-sm text-fg-muted transition-colors duration-150 ease-studio hover:bg-surface-hover hover:text-fg-primary focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
          isOpen && "bg-surface-selected text-fg-primary",
        )}
      >
        <Ellipsis aria-hidden="true" className="size-3.5" />
      </button>
      {shouldRender && (
        <div id={menuId}>
          <MenuDropdown
            items={items}
            ariaLabel={`${sectionLabel} CSS`}
            align="right"
            visible={isVisible}
            isOpen={isOpen}
            // Narrower than the menu bar's w-64, so it fits the Inspector at its 260px minimum.
            className="w-52"
            onRequestClose={(returnFocus) => {
              setIsOpen(false);
              if (returnFocus) triggerRef.current?.focus();
            }}
          />
        </div>
      )}
    </div>
  );
}
