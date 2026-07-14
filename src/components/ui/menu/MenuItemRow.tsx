"use client";

import { Check, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { MenuItem } from "@/components/ui/menu/types";

interface MenuItemRowProps {
  item: MenuItem;
  isActive: boolean;
  /** Whether this row's submenu is currently open — drives aria-expanded. Ignored for non-submenu items. */
  submenuOpen?: boolean;
  registerRef: (el: HTMLButtonElement | null) => void;
  onMouseEnter: () => void;
  onActivate: () => void;
  children?: ReactNode;
}

export function MenuItemRow({
  item,
  isActive,
  submenuOpen = false,
  registerRef,
  onMouseEnter,
  onActivate,
  children,
}: MenuItemRowProps) {
  if (item.type === "separator") {
    return (
      <div
        role="separator"
        className="my-1 border-t border-zinc-200 dark:border-zinc-800"
      />
    );
  }

  const disabled = Boolean(item.disabled);
  const isCheckbox = item.type === "checkbox";
  const isSubmenu = item.type === "submenu";

  return (
    <div className="relative">
      <button
        ref={registerRef}
        type="button"
        role={isCheckbox ? "menuitemcheckbox" : "menuitem"}
        aria-checked={isCheckbox ? item.checked : undefined}
        aria-haspopup={isSubmenu ? "menu" : undefined}
        aria-expanded={isSubmenu ? submenuOpen : undefined}
        tabIndex={-1}
        disabled={disabled}
        onMouseEnter={onMouseEnter}
        onClick={() => {
          if (disabled) return;
          onActivate();
        }}
        className={cn(
          "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors duration-100",
          disabled
            ? "cursor-not-allowed text-zinc-300 dark:text-zinc-700"
            : "text-zinc-700 active:bg-zinc-200 dark:text-zinc-300 dark:active:bg-zinc-800",
          isActive && !disabled && "bg-zinc-100 dark:bg-zinc-900",
        )}
      >
        <span className="flex w-3.5 shrink-0 items-center justify-center">
          {isCheckbox && item.checked && (
            <Check aria-hidden="true" className="size-3.5" />
          )}
        </span>
        <span className="flex-1 truncate">{item.label}</span>
        {item.type === "command" && item.premium && (
          <span
            aria-hidden="true"
            className="shrink-0 text-[10px] font-medium tracking-wide text-amber-600 uppercase dark:text-amber-500"
          >
            Pro
          </span>
        )}
        {item.type === "command" && item.shortcut && (
          <span
            aria-hidden="true"
            className="shrink-0 text-xs text-zinc-400 dark:text-zinc-600"
          >
            {item.shortcut}
          </span>
        )}
        {isSubmenu && (
          <ChevronRight
            aria-hidden="true"
            className="size-3.5 shrink-0 text-zinc-400 dark:text-zinc-600"
          />
        )}
      </button>
      {children}
    </div>
  );
}
