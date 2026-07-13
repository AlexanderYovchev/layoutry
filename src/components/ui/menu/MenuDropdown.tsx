"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { MenuItemRow } from "@/components/ui/menu/MenuItemRow";
import type { MenuItem } from "@/components/ui/menu/types";

interface MenuDropdownProps {
  items: MenuItem[];
  align?: "left" | "right";
  initialFocus?: "first" | "last";
  variant?: "top" | "submenu";
  onRequestClose: (returnFocus: boolean) => void;
  onMoveToAdjacentMenu?: (direction: 1 | -1) => void;
}

function isSelectable(item: MenuItem) {
  return item.type !== "separator" && !item.disabled;
}

export function MenuDropdown({
  items,
  align = "left",
  initialFocus = "first",
  variant = "top",
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
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className={cn(
        "absolute z-50 w-64 rounded-md border border-zinc-200 bg-white py-1 shadow-md dark:border-zinc-800 dark:bg-zinc-950",
        variant === "top" && "mt-1",
        variant === "top" && (align === "left" ? "left-0" : "right-0"),
        variant === "submenu" && "top-0 left-full ml-1",
      )}
    >
      {items.map((item, index) => (
        <MenuItemRow
          key={item.id}
          item={item}
          isActive={index === activeIndex}
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
          {item.type === "submenu" && openSubmenuIndex === index && (
            <MenuDropdown
              items={item.items}
              variant="submenu"
              initialFocus="first"
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
