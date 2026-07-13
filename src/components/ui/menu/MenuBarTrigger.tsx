"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { useMenuBarContext } from "@/components/ui/menu/MenuBarRoot";
import { MenuDropdown } from "@/components/ui/menu/MenuDropdown";
import type { MenuItem } from "@/components/ui/menu/types";

interface MenuBarTriggerProps {
  id: string;
  label: string;
  items: MenuItem[];
  align?: "left" | "right";
}

export function MenuBarTrigger({
  id,
  label,
  items,
  align = "left",
}: MenuBarTriggerProps) {
  const {
    openMenuId,
    openMenu,
    closeMenu,
    registerTrigger,
    focusAdjacentTrigger,
  } = useMenuBarContext();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [initialFocus, setInitialFocus] = useState<"first" | "last">("first");
  const isOpen = openMenuId === id;

  useEffect(() => {
    registerTrigger(id, buttonRef.current);
    return () => registerTrigger(id, null);
  }, [id, registerTrigger]);

  function handleClick() {
    if (isOpen) {
      closeMenu();
    } else {
      setInitialFocus("first");
      openMenu(id);
    }
  }

  function handleMouseEnter() {
    if (openMenuId && openMenuId !== id) {
      openMenu(id);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    switch (event.key) {
      case "Enter":
      case " ":
      case "ArrowDown":
        event.preventDefault();
        setInitialFocus("first");
        openMenu(id);
        break;
      case "ArrowUp":
        event.preventDefault();
        setInitialFocus("last");
        openMenu(id);
        break;
      case "ArrowRight":
        event.preventDefault();
        focusAdjacentTrigger(id, 1);
        break;
      case "ArrowLeft":
        event.preventDefault();
        focusAdjacentTrigger(id, -1);
        break;
      case "Escape":
        if (isOpen) {
          event.preventDefault();
          closeMenu();
        }
        break;
    }
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onKeyDown={handleKeyDown}
        className={cn(
          "rounded-md px-2.5 py-1.5 text-sm text-zinc-600 dark:text-zinc-400",
          isOpen
            ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
            : "hover:bg-zinc-100 dark:hover:bg-zinc-900",
        )}
      >
        {label}
      </button>
      {isOpen && (
        <MenuDropdown
          items={items}
          align={align}
          initialFocus={initialFocus}
          onRequestClose={(returnFocus) => {
            closeMenu();
            if (returnFocus) buttonRef.current?.focus();
          }}
          onMoveToAdjacentMenu={(direction) =>
            focusAdjacentTrigger(id, direction)
          }
        />
      )}
    </div>
  );
}
