import { useSyncExternalStore } from "react";

/**
 * BC-12.5 — the tree's single roving tab stop (WAI-ARIA treeview: one row
 * has tabIndex 0, every other -1), as a tiny external store. Each row
 * subscribes to "am I the tab stop?", so moving the tab stop re-renders
 * the two rows involved instead of every row (a prop on 1,000 memoized
 * rows re-rendered all of them).
 */
export interface RovingFocusStore {
  get: () => string;
  set: (id: string) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createRovingFocusStore(initialId: string): RovingFocusStore {
  let current = initialId;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set: (id) => {
      if (id === current) return;
      current = id;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Whether `id`'s row is the tree's current tab stop. */
export function useIsRovingTabStop(store: RovingFocusStore, id: string): boolean {
  return useSyncExternalStore(
    store.subscribe,
    () => store.get() === id,
    () => store.get() === id,
  );
}
