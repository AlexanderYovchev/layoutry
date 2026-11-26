"use client";

import { useCallback, useRef } from "react";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { ActiveSnapGuides } from "@/features/editor/types/snap";

/**
 * BC-13.3/13.4: writes guide state to the store only when it actually
 * changes (compared by value), so an unchanged frame never re-renders the
 * overlay. `reset` forgets the last value at the start/end of a gesture.
 */
export function useSnapGuidePublisher(): { publish: (guides: ActiveSnapGuides | null) => void; reset: () => void } {
  const setActiveSnapGuides = useEditorStore((state) => state.setActiveSnapGuides);
  const keyRef = useRef("null");
  const publish = useCallback(
    (guides: ActiveSnapGuides | null) => {
      const key = JSON.stringify(guides);
      if (key === keyRef.current) return;
      keyRef.current = key;
      setActiveSnapGuides(guides);
    },
    [setActiveSnapGuides],
  );
  const reset = useCallback(() => {
    keyRef.current = "null";
  }, []);
  return { publish, reset };
}
