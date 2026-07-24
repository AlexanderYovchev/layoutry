import { DndContext } from "@dnd-kit/core";
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import { useNodeDropRegistration } from "./useNodeDropRegistration";

function wrapper({ children }: { children: ReactNode }) {
  return <DndContext>{children}</DndContext>;
}

describe("useNodeDropRegistration", () => {
  it("returns a ref-setter for any node, including leaves", () => {
    const { result } = renderHook(
      () => useNodeDropRegistration({ id: "button-1", tag: "button" }),
      { wrapper },
    );

    expect(result.current).toBeTypeOf("function");
  });

  it("returns a ref-setter for container nodes too", () => {
    const { result } = renderHook(
      () => useNodeDropRegistration({ id: "container-1", tag: "div" }),
      { wrapper },
    );

    expect(result.current).toBeTypeOf("function");
  });
});
