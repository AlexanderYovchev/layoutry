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
      <div role="separator" className="border-line-subtle mx-1 my-1 border-t" />
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
          "rounded-control-sm focus-visible:outline-accent flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm transition-colors duration-100 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2",
          disabled
            ? "text-fg-muted cursor-not-allowed"
            : "text-fg-primary active:bg-surface-selected",
          isActive && !disabled && "bg-surface-hover",
        )}
      >
        <span className="flex w-3.5 shrink-0 items-center justify-center">
          {isCheckbox && item.checked && (
            <Check aria-hidden="true" className="text-accent size-3.5" />
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
            className="text-fg-secondary shrink-0 text-xs"
          >
            {item.shortcut}
          </span>
        )}
        {isSubmenu && (
          <ChevronRight
            aria-hidden="true"
            className="text-fg-muted size-3.5 shrink-0"
          />
        )}
      </button>
      {children}
    </div>
  );
}
