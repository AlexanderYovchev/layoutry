import { DndContext } from "@dnd-kit/core";
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import { useNodeDragSource } from "./useNodeDragSource";

function wrapper({ children }: { children: ReactNode }) {
  return <DndContext>{children}</DndContext>;
}

describe("useNodeDragSource", () => {
  it("exposes a ref-setter, pointer listeners, and dragging state", () => {
    const { result } = renderHook(
      () => useNodeDragSource({ id: "heading-1", tag: "h1", text: "Title" }),
      { wrapper },
    );

    expect(result.current.setNodeRef).toBeTypeOf("function");
    expect(result.current.isDragging).toBe(false);
    expect(result.current.listeners).toBeDefined();
  });
});
