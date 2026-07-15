import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InspectorPanel } from "./InspectorPanel";

const noop = () => {};

function renderInspectorPanel(
  props: Partial<React.ComponentProps<typeof InspectorPanel>> = {},
) {
  return render(
    <InspectorPanel
      width={300}
      minWidth={260}
      maxWidth={520}
      isDragging={false}
      onPointerDown={noop}
      onPointerMove={noop}
      onPointerUp={noop}
      {...props}
    >
      <div>inspector content</div>
    </InspectorPanel>,
  );
}

describe("InspectorPanel", () => {
  it("renders its children inside the panel shell at the given width", () => {
    renderInspectorPanel({ width: 300 });

    const panel = screen.getByRole("complementary", {
      name: "Inspector panel",
    });
    expect(panel.style.width).toBe("300px");
    expect(screen.getByText("inspector content")).toBeInTheDocument();
  });

  it("forwards resize-handle pointer events to the given handlers", () => {
    const onPointerDown = vi.fn();
    const onPointerMove = vi.fn();
    const onPointerUp = vi.fn();
    renderInspectorPanel({ onPointerDown, onPointerMove, onPointerUp });

    const handle = screen.getByRole("separator");
    fireEvent.pointerDown(handle, { clientX: 500 });
    fireEvent.pointerMove(handle, { clientX: 440 });
    fireEvent.pointerUp(handle, { clientX: 440 });

    expect(onPointerDown).toHaveBeenCalledTimes(1);
    expect(onPointerMove).toHaveBeenCalledTimes(1);
    expect(onPointerUp).toHaveBeenCalledTimes(1);
  });
});
