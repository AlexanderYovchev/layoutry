import { DndContext } from "@dnd-kit/core";
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import { useContainerDropTarget } from "./useContainerDropTarget";

function wrapper({ children }: { children: ReactNode }) {
  return <DndContext>{children}</DndContext>;
}

describe("useContainerDropTarget", () => {
  it("registers a container-tag node as a droppable target", () => {
    const { result } = renderHook(
      () => useContainerDropTarget({ id: "container-1", tag: "div" }),
      { wrapper },
    );

    expect(result.current.setNodeRef).toBeTypeOf("function");
    expect(result.current.isDropActive).toBe(false);
  });

  it("does not register a leaf-tag node as a droppable target", () => {
    const { result } = renderHook(
      () => useContainerDropTarget({ id: "button-1", tag: "button" }),
      { wrapper },
    );

    expect(result.current.setNodeRef).toBeUndefined();
    expect(result.current.isDropActive).toBe(false);
  });
});
