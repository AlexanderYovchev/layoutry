import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { InspectorPanel } from "./InspectorPanel";

describe("InspectorPanel", () => {
  afterEach(() => {
    window.localStorage.removeItem("layoutry:inspector-panel-width");
  });

  it("renders its children inside the panel shell at the default width", () => {
    render(
      <InspectorPanel>
        <div>inspector content</div>
      </InspectorPanel>,
    );

    const panel = screen.getByRole("complementary", {
      name: "Inspector panel",
    });
    expect(panel.style.width).toBe("300px");
    expect(screen.getByText("inspector content")).toBeInTheDocument();
  });

  it("grows when its resize handle is dragged to the left", () => {
    render(
      <InspectorPanel>
        <div>inspector content</div>
      </InspectorPanel>,
    );

    const panel = screen.getByRole("complementary", {
      name: "Inspector panel",
    });
    const handle = screen.getByRole("separator");

    fireEvent.pointerDown(handle, { clientX: 500 });
    fireEvent.pointerMove(handle, { clientX: 440 });
    fireEvent.pointerUp(handle, { clientX: 440 });

    expect(panel.style.width).toBe("360px");
  });
});
