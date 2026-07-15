"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";

interface MenuBarContextValue {
  openMenuId: string | null;
  openMenu: (id: string) => void;
  closeMenu: () => void;
  registerTrigger: (id: string, el: HTMLButtonElement | null) => void;
  focusAdjacentTrigger: (fromId: string, direction: 1 | -1) => void;
  /** The single roving tab stop for the menu bar (WAI-ARIA menubar pattern) — every other trigger is tabIndex=-1. */
  currentTriggerId: string;
  setCurrentTriggerId: (id: string) => void;
}

const MenuBarContext = createContext<MenuBarContextValue | null>(null);

export function useMenuBarContext() {
  const context = useContext(MenuBarContext);
  if (!context) {
    throw new Error(
      "Menu bar components must be rendered within a MenuBarRoot",
    );
  }
  return context;
}

interface MenuBarRootProps extends PropsWithChildren {
  "aria-label": string;
  menuIds: string[];
}

export function MenuBarRoot({
  "aria-label": ariaLabel,
  menuIds,
  children,
}: MenuBarRootProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [currentTriggerId, setCurrentTriggerId] = useState(menuIds[0]);
  const triggerRefs = useRef(new Map<string, HTMLButtonElement>());
  const rootRef = useRef<HTMLDivElement>(null);

  const openMenu = useCallback((id: string) => setOpenMenuId(id), []);
  const closeMenu = useCallback(() => setOpenMenuId(null), []);

  const registerTrigger = useCallback(
    (id: string, el: HTMLButtonElement | null) => {
      if (el) {
        triggerRefs.current.set(id, el);
      } else {
        triggerRefs.current.delete(id);
      }
    },
    [],
  );

  const focusAdjacentTrigger = useCallback(
    (fromId: string, direction: 1 | -1) => {
      const index = menuIds.indexOf(fromId);
      if (index === -1) return;
      const nextIndex = (index + direction + menuIds.length) % menuIds.length;
      const nextId = menuIds[nextIndex];
      triggerRefs.current.get(nextId)?.focus();
      setOpenMenuId((current) => (current ? nextId : current));
    },
    [menuIds],
  );

  useEffect(() => {
    if (!openMenuId) return;

    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [openMenuId]);

  return (
    <MenuBarContext.Provider
      value={{
        openMenuId,
        openMenu,
        closeMenu,
        registerTrigger,
        focusAdjacentTrigger,
        currentTriggerId,
        setCurrentTriggerId,
      }}
    >
      <div
        ref={rootRef}
        role="menubar"
        aria-label={ariaLabel}
        className="flex shrink-0 items-center gap-0.5"
      >
        {children}
      </div>
    </MenuBarContext.Provider>
  );
}
