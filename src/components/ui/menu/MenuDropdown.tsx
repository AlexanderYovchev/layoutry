"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { MenuItemRow } from "@/components/ui/menu/MenuItemRow";
import { useDismissableTransition } from "@/components/ui/motion/useDismissableTransition";
import type { MenuItem } from "@/components/ui/menu/types";

// Matches the duration-200 transition on MenuDropdown's own root element,
// so the submenu stays mounted exactly as long as its exit fade plays.
const SUBMENU_EXIT_DURATION_MS = 200;

interface MenuDropdownProps {
  items: MenuItem[];
  /** Accessible name for the menu itself, e.g. the trigger's own label ("File", "Open Recent"). */
  ariaLabel: string;
  align?: "left" | "right";
  initialFocus?: "first" | "last";
  variant?: "top" | "submenu";
  /** Drives the open/close fade+slide. Defaults to true for a dropdown that's mounted unconditionally by its parent. */
  visible?: boolean;
  /**
   * The real open/closed intent, independent of `visible`'s animation-frame
   * delay. Drives `inert` so a closing dropdown stops being focusable,
   * clickable, and discoverable by assistive tech and automation the
   * instant close is requested — not just once its exit fade finishes.
   * Defaults to true for a dropdown that's mounted unconditionally.
   */
  isOpen?: boolean;
  onRequestClose: (returnFocus: boolean) => void;
  onMoveToAdjacentMenu?: (direction: 1 | -1) => void;
}

function isSelectable(item: MenuItem) {
  return item.type !== "separator" && !item.disabled;
}

interface SubmenuSlotProps {
  isOpen: boolean;
  items: MenuItem[];
  ariaLabel: string;
  onRequestClose: (returnFocus: boolean) => void;
}

// A submenu's open state is owned by its parent (openSubmenuIndex), but the
// exit-transition timing is local to each submenu slot — isolating it in
// its own component gives each one its own useDismissableTransition
// instance without calling hooks inside the items.map() loop above.
function SubmenuSlot({
  isOpen,
  items,
  ariaLabel,
  onRequestClose,
}: SubmenuSlotProps) {
  const { shouldRender, isVisible } = useDismissableTransition(
    isOpen,
    SUBMENU_EXIT_DURATION_MS,
  );

  if (!shouldRender) return null;

  return (
    <MenuDropdown
      items={items}
      ariaLabel={ariaLabel}
      variant="submenu"
      initialFocus="first"
      visible={isVisible}
      isOpen={isOpen}
      onRequestClose={onRequestClose}
    />
  );
}

export function MenuDropdown({
  items,
  ariaLabel,
  align = "left",
  initialFocus = "first",
  variant = "top",
  visible = true,
  isOpen = true,
  onRequestClose,
  onMoveToAdjacentMenu,
}: MenuDropdownProps) {
  const selectableIndexes = items
    .map((item, index) => (isSelectable(item) ? index : -1))
    .filter((index) => index !== -1);

  const [activeIndex, setActiveIndex] = useState<number>(() => {
    if (selectableIndexes.length === 0) return -1;
    return initialFocus === "last"
      ? selectableIndexes[selectableIndexes.length - 1]
      : selectableIndexes[0];
  });
  const [openSubmenuIndex, setOpenSubmenuIndex] = useState<number | null>(null);
  const itemRefs = useRef(new Map<number, HTMLButtonElement>());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeIndex >= 0) {
      itemRefs.current.get(activeIndex)?.focus();
    } else {
      containerRef.current?.focus();
    }
    // Only run once, when the dropdown first mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function moveActive(direction: 1 | -1) {
    if (selectableIndexes.length === 0) return;
    const currentPosition = selectableIndexes.indexOf(activeIndex);
    const nextPosition =
      currentPosition === -1
        ? 0
        : (currentPosition + direction + selectableIndexes.length) %
          selectableIndexes.length;
    const nextIndex = selectableIndexes[nextPosition];
    setOpenSubmenuIndex(null);
    setActiveIndex(nextIndex);
    itemRefs.current.get(nextIndex)?.focus();
  }

  function moveToEdge(edge: "first" | "last") {
    if (selectableIndexes.length === 0) return;
    const nextIndex =
      edge === "first"
        ? selectableIndexes[0]
        : selectableIndexes[selectableIndexes.length - 1];
    setOpenSubmenuIndex(null);
    setActiveIndex(nextIndex);
    itemRefs.current.get(nextIndex)?.focus();
  }

  function activateItem(index: number) {
    const item = items[index];
    if (!item || item.type === "separator" || item.disabled) return;
    if (item.type === "submenu") {
      setOpenSubmenuIndex(index);
      return;
    }
    item.onSelect?.();
    onRequestClose(true);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        moveActive(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        moveActive(-1);
        break;
      case "Home":
        event.preventDefault();
        moveToEdge("first");
        break;
      case "End":
        event.preventDefault();
        moveToEdge("last");
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (activeIndex >= 0) activateItem(activeIndex);
        break;
      case "ArrowRight": {
        const item = items[activeIndex];
        if (item?.type === "submenu" && !item.disabled) {
          event.preventDefault();
          setOpenSubmenuIndex(activeIndex);
        } else if (variant === "top" && onMoveToAdjacentMenu) {
          event.preventDefault();
          onMoveToAdjacentMenu(1);
        }
        break;
      }
      case "ArrowLeft": {
        if (variant === "submenu") {
          event.preventDefault();
          onRequestClose(true);
        } else if (onMoveToAdjacentMenu) {
          event.preventDefault();
          onMoveToAdjacentMenu(-1);
        }
        break;
      }
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        onRequestClose(true);
        break;
      case "Tab":
        onRequestClose(false);
        break;
    }
  }

  return (
    <div
      ref={containerRef}
      role="menu"
      aria-label={ariaLabel}
      tabIndex={-1}
      inert={!isOpen}
      aria-hidden={!isOpen}
      onKeyDown={handleKeyDown}
      className={cn(
        "rounded-card border-line bg-surface-panel shadow-elevated ease-studio absolute z-50 w-64 border p-1 transition-[opacity,transform] duration-200",
        visible ? "translate-y-0 opacity-100" : "-translate-y-1.5 opacity-0",
        variant === "top" && "mt-1.5",
        variant === "top" && (align === "left" ? "left-0" : "right-0"),
        variant === "submenu" && "-top-1 left-full ml-1.5",
      )}
    >
      {items.map((item, index) => (
        <MenuItemRow
          key={item.id}
          item={item}
          isActive={index === activeIndex}
          submenuOpen={openSubmenuIndex === index}
          registerRef={(el) => {
            if (el) itemRefs.current.set(index, el);
            else itemRefs.current.delete(index);
          }}
          onMouseEnter={() => {
            if (isSelectable(item)) {
              setActiveIndex(index);
              if (item.type !== "submenu") setOpenSubmenuIndex(null);
            }
          }}
          onActivate={() => activateItem(index)}
        >
          {item.type === "submenu" && (
            <SubmenuSlot
              isOpen={openSubmenuIndex === index}
              items={item.items}
              ariaLabel={item.label}
              onRequestClose={(returnFocus) => {
                setOpenSubmenuIndex(null);
                if (returnFocus) itemRefs.current.get(index)?.focus();
              }}
            />
          )}
        </MenuItemRow>
      ))}
    </div>
  );
}
