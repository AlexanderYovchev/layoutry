import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { LegendElement } from "./LegendElement";

const initialState = useEditorStore.getState();

describe("LegendElement (Checkpoint 1.15.6.12.1)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useEditorStore.setState(initialState, true);
  });

  it("renders a genuine <legend> with its authored identity", () => {
    const { container } = render(
      <LegendElement node={{ id: "legend-1", tag: "legend", text: "Contact Details", htmlId: "contact-legend", className: "my-legend" }} parentId="fieldset-1" parentLayoutMode="flow" parentFlowDisplay="block" />,
    );
    const legend = container.querySelector("legend")!;
    expect(legend).not.toBeNull();
    expect(legend).toHaveAttribute("data-node-id", "legend-1");
    expect(legend).toHaveAttribute("data-node-type", "legend");
    expect(legend).toHaveAttribute("id", "contact-legend");
    expect(legend).toHaveClass("my-legend");
    expect(legend.textContent).toBe("Contact Details");
  });

  it("is not editable until double-clicked, reusing the exact generic useEditableText hook (no Legend-specific editing code)", () => {
    render(<LegendElement node={{ id: "legend-1", tag: "legend", text: "Group" }} parentId="fieldset-1" parentLayoutMode="flow" parentFlowDisplay="block" />);
    expect(screen.getByText("Group")).toHaveAttribute("contenteditable", "false");
  });

  it("double-click enters editing mode while remaining a real <legend>", () => {
    render(<LegendElement node={{ id: "legend-1", tag: "legend", text: "Group" }} parentId="fieldset-1" parentLayoutMode="flow" parentFlowDisplay="block" />);
    const legend = screen.getByText("Group");
    fireEvent.doubleClick(legend);
    expect(legend.tagName).toBe("LEGEND");
    expect(legend).toHaveAttribute("contenteditable", "true");
  });

  it("commits edited text through the store's generic setElementText and exits editing on blur — one history step, same as every other text-bearing leaf", () => {
    render(<LegendElement node={{ id: "legend-1", tag: "legend", text: "Group" }} parentId="fieldset-1" parentLayoutMode="flow" parentFlowDisplay="block" />);
    const spy = vi.spyOn(useEditorStore.getState(), "setElementText");

    const legend = screen.getByText("Group");
    fireEvent.doubleClick(legend);
    legend.textContent = "Shipping Address";
    fireEvent.blur(legend);

    expect(spy).toHaveBeenCalledWith("legend-1", "Shipping Address");
    expect(legend).toHaveAttribute("contenteditable", "false");
  });

  it("has no children slot — text-bearing leaf, never a container", () => {
    const { container } = render(
      <LegendElement node={{ id: "legend-1", tag: "legend", text: "Group" }} parentId="fieldset-1" parentLayoutMode="flow" parentFlowDisplay="block" />,
    );
    expect(container.querySelector("legend")!.children).toHaveLength(0);
  });
});
