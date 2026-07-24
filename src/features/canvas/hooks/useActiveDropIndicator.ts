"use client";

import { useDndContext } from "@dnd-kit/core";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import {
  resolveActiveDropIndicator,
  type ActiveDropIndicator,
} from "@/features/canvas/utils/resolveActiveDropIndicator";

export function useActiveDropIndicator(): ActiveDropIndicator | null {
  const documentModel = useEditorStore((state) => state.document);
  const { active, over } = useDndContext();

  return resolveActiveDropIndicator(active, over, documentModel);
}
