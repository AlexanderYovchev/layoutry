import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InspectorShadowLayerList } from "./InspectorShadowLayerList";
import type { ShadowLayer } from "@/features/editor/types/boxShadow";

const LAYERS: ShadowLayer[] = [
  { id: "shadow-a", enabled: true, inset: false, color: "#000000" },
  { id: "shadow-b", enabled: false, inset: true, color: "#ffffff" },
];

function noop() {
  return undefined;
}

beforeEach(() => {
  // jsdom reports zero-size layout by default — stub 24px-tall rows stacked
  // at y=0 and y=24 so the vertical drag's midpoint math has something
  // real to compute against (mirrors InspectorGradientStopTrack.test.tsx's
  // own getBoundingClientRect stub, adapted from a horizontal track to
  // stacked rows).
  let call = 0;
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const top = call % 2 === 0 ? 0 : 24;
    call++;
    return { left: 0, top, right: 200, bottom: top + 24, width: 200, height: 24, x: 0, y: top, toJSON: () => "" };
  });
});

describe("InspectorShadowLayerList", () => {
  it("names each row 'Shadow N', marking an inset layer", () => {
    render(
      <InspectorShadowLayerList
        layers={LAYERS}
        selectedLayerId={null}
        onSelect={noop}
        onToggleEnabled={noop}
        onDuplicate={noop}
        onDelete={noop}
        onMove={noop}
        onDragStart={noop}
        onDragMove={noop}
        onDragEnd={noop}
      />,
    );

    expect(screen.getByRole("button", { name: "Select Shadow 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select Shadow 2 (inset)" })).toBeInTheDocument();
  });

  it("marks exactly the selected layer as pressed", () => {
    render(
      <InspectorShadowLayerList
        layers={LAYERS}
        selectedLayerId="shadow-a"
        onSelect={noop}
        onToggleEnabled={noop}
        onDuplicate={noop}
        onDelete={noop}
        onMove={noop}
        onDragStart={noop}
        onDragMove={noop}
        onDragEnd={noop}
      />,
    );

    expect(screen.getByRole("button", { name: "Select Shadow 1" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Select Shadow 2 (inset)" })).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onSelect when a row is clicked", () => {
    const onSelect = vi.fn();
    render(
      <InspectorShadowLayerList
        layers={LAYERS}
        selectedLayerId={null}
        onSelect={onSelect}
        onToggleEnabled={noop}
        onDuplicate={noop}
        onDelete={noop}
        onMove={noop}
        onDragStart={noop}
        onDragMove={noop}
        onDragEnd={noop}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Select Shadow 1" }));
    expect(onSelect).toHaveBeenCalledWith("shadow-a");
  });

  it("reflects each layer's enabled state on its own toggle switch", () => {
    render(
      <InspectorShadowLayerList
        layers={LAYERS}
        selectedLayerId={null}
        onSelect={noop}
        onToggleEnabled={noop}
        onDuplicate={noop}
        onDelete={noop}
        onMove={noop}
        onDragStart={noop}
        onDragMove={noop}
        onDragEnd={noop}
      />,
    );

    expect(screen.getByRole("switch", { name: "Shadow 1 enabled" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("switch", { name: "Shadow 2 (inset) enabled" })).toHaveAttribute("aria-checked", "false");
  });

  it("calls onToggleEnabled with the flipped value", () => {
    const onToggleEnabled = vi.fn();
    render(
      <InspectorShadowLayerList
        layers={LAYERS}
        selectedLayerId={null}
        onSelect={noop}
        onToggleEnabled={onToggleEnabled}
        onDuplicate={noop}
        onDelete={noop}
        onMove={noop}
        onDragStart={noop}
        onDragMove={noop}
        onDragEnd={noop}
      />,
    );

    fireEvent.click(screen.getByRole("switch", { name: "Shadow 1 enabled" }));
    expect(onToggleEnabled).toHaveBeenCalledWith("shadow-a", false);
  });

  it("calls onDuplicate and onDelete with the row's id", () => {
    const onDuplicate = vi.fn();
    const onDelete = vi.fn();
    render(
      <InspectorShadowLayerList
        layers={LAYERS}
        selectedLayerId={null}
        onSelect={noop}
        onToggleEnabled={noop}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        onMove={noop}
        onDragStart={noop}
        onDragMove={noop}
        onDragEnd={noop}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Duplicate Shadow 1" }));
    expect(onDuplicate).toHaveBeenCalledWith("shadow-a");

    fireEvent.click(screen.getByRole("button", { name: "Delete Shadow 2 (inset)" }));
    expect(onDelete).toHaveBeenCalledWith("shadow-b");
  });

  it("disables Move Up on the first row and Move Down on the last row", () => {
    render(
      <InspectorShadowLayerList
        layers={LAYERS}
        selectedLayerId={null}
        onSelect={noop}
        onToggleEnabled={noop}
        onDuplicate={noop}
        onDelete={noop}
        onMove={noop}
        onDragStart={noop}
        onDragMove={noop}
        onDragEnd={noop}
      />,
    );

    expect(screen.getByRole("button", { name: "Move Shadow 1 up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Shadow 1 down" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Shadow 2 (inset) up" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Shadow 2 (inset) down" })).toBeDisabled();
  });

  it("calls onMove with the target index when Move Down is clicked", () => {
    const onMove = vi.fn();
    render(
      <InspectorShadowLayerList
        layers={LAYERS}
        selectedLayerId={null}
        onSelect={noop}
        onToggleEnabled={noop}
        onDuplicate={noop}
        onDelete={noop}
        onMove={onMove}
        onDragStart={noop}
        onDragMove={noop}
        onDragEnd={noop}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Move Shadow 1 down" }));
    expect(onMove).toHaveBeenCalledWith("shadow-a", 1);
  });

  it("disables the drag handle when there is only one layer", () => {
    render(
      <InspectorShadowLayerList
        layers={[LAYERS[0]]}
        selectedLayerId={null}
        onSelect={noop}
        onToggleEnabled={noop}
        onDuplicate={noop}
        onDelete={noop}
        onMove={noop}
        onDragStart={noop}
        onDragMove={noop}
        onDragEnd={noop}
      />,
    );

    expect(screen.getByRole("button", { name: "Drag to reorder Shadow 1" })).toBeDisabled();
  });

  it("begins a transaction on pointer down and reports moved=false for a plain click", () => {
    const onDragStart = vi.fn();
    const onDragEnd = vi.fn();
    render(
      <InspectorShadowLayerList
        layers={LAYERS}
        selectedLayerId={null}
        onSelect={noop}
        onToggleEnabled={noop}
        onDuplicate={noop}
        onDelete={noop}
        onMove={noop}
        onDragStart={onDragStart}
        onDragMove={noop}
        onDragEnd={onDragEnd}
      />,
    );

    const handle = screen.getByRole("button", { name: "Drag to reorder Shadow 1" });
    fireEvent.pointerDown(handle, { pointerId: 1 });
    expect(onDragStart).toHaveBeenCalledTimes(1);

    fireEvent.pointerUp(handle, { pointerId: 1 });
    expect(onDragEnd).toHaveBeenCalledWith(false);
  });

  it("reports a live target index while dragging, and moved=true once it actually changes", () => {
    const onDragMove = vi.fn();
    const onDragEnd = vi.fn();
    render(
      <InspectorShadowLayerList
        layers={LAYERS}
        selectedLayerId={null}
        onSelect={noop}
        onToggleEnabled={noop}
        onDuplicate={noop}
        onDelete={noop}
        onMove={noop}
        onDragStart={noop}
        onDragMove={onDragMove}
        onDragEnd={onDragEnd}
      />,
    );

    const handle = screen.getByRole("button", { name: "Drag to reorder Shadow 1" });
    fireEvent.pointerDown(handle, { pointerId: 1 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientY: 30 });
    expect(onDragMove).toHaveBeenCalledWith("shadow-a", 1);

    fireEvent.pointerUp(handle, { pointerId: 1 });
    expect(onDragEnd).toHaveBeenCalledWith(true);
  });
});
