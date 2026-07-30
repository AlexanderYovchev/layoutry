import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InspectorGradientStopTrack } from "./InspectorGradientStopTrack";
import type { GradientColorStop } from "@/features/editor/types/gradient";

const STOPS: GradientColorStop[] = [
  { id: "a", color: "#000000", position: 0 },
  { id: "b", color: "#ffffff", position: 100 },
];

beforeEach(() => {
  // jsdom reports zero-size layout by default — stub a 200px-wide track so
  // pointer-to-percent math has something real to compute against.
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    right: 200,
    bottom: 24,
    width: 200,
    height: 24,
    x: 0,
    y: 0,
    toJSON: () => "",
  });
});

describe("InspectorGradientStopTrack", () => {
  it("gives every marker an accessible name including its color and percentage", () => {
    render(
      <InspectorGradientStopTrack
        stops={STOPS}
        selectedStopId={null}
        onSelectStop={vi.fn()}
        onDragStart={vi.fn()}
        onDragMove={vi.fn()}
        onDragEnd={vi.fn()}
        onAdjustPosition={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Gradient stop: #000000 at 0%" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gradient stop: #ffffff at 100%" })).toBeInTheDocument();
  });

  it("marks exactly the selected stop as pressed", () => {
    render(
      <InspectorGradientStopTrack
        stops={STOPS}
        selectedStopId="a"
        onSelectStop={vi.fn()}
        onDragStart={vi.fn()}
        onDragMove={vi.fn()}
        onDragEnd={vi.fn()}
        onAdjustPosition={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Gradient stop: #000000 at 0%" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Gradient stop: #ffffff at 100%" })).toHaveAttribute("aria-pressed", "false");
  });

  it("selects a stop and begins a drag on pointer down", () => {
    const onSelectStop = vi.fn();
    const onDragStart = vi.fn();
    render(
      <InspectorGradientStopTrack
        stops={STOPS}
        selectedStopId={null}
        onSelectStop={onSelectStop}
        onDragStart={onDragStart}
        onDragMove={vi.fn()}
        onDragEnd={vi.fn()}
        onAdjustPosition={vi.fn()}
      />,
    );

    fireEvent.pointerDown(screen.getByRole("button", { name: "Gradient stop: #000000 at 0%" }), { pointerId: 1 });
    expect(onSelectStop).toHaveBeenCalledWith("a");
    expect(onDragStart).toHaveBeenCalledTimes(1);
  });

  it("reports a live position during a drag, clamped to the track width", () => {
    const onDragMove = vi.fn();
    render(
      <InspectorGradientStopTrack
        stops={STOPS}
        selectedStopId="a"
        onSelectStop={vi.fn()}
        onDragStart={vi.fn()}
        onDragMove={onDragMove}
        onDragEnd={vi.fn()}
        onAdjustPosition={vi.fn()}
      />,
    );

    const marker = screen.getByRole("button", { name: "Gradient stop: #000000 at 0%" });
    fireEvent.pointerDown(marker, { pointerId: 1 });
    fireEvent.pointerMove(marker, { pointerId: 1, clientX: 100 });
    expect(onDragMove).toHaveBeenCalledWith("a", 50);

    fireEvent.pointerMove(marker, { pointerId: 1, clientX: 400 });
    expect(onDragMove).toHaveBeenLastCalledWith("a", 100);

    fireEvent.pointerMove(marker, { pointerId: 1, clientX: -50 });
    expect(onDragMove).toHaveBeenLastCalledWith("a", 0);
  });

  it("reports moved=true on drag end after a real move, and moved=false for a plain click", () => {
    const onDragEnd = vi.fn();
    render(
      <InspectorGradientStopTrack
        stops={STOPS}
        selectedStopId="a"
        onSelectStop={vi.fn()}
        onDragStart={vi.fn()}
        onDragMove={vi.fn()}
        onDragEnd={onDragEnd}
        onAdjustPosition={vi.fn()}
      />,
    );

    const marker = screen.getByRole("button", { name: "Gradient stop: #000000 at 0%" });

    fireEvent.pointerDown(marker, { pointerId: 1 });
    fireEvent.pointerUp(marker, { pointerId: 1 });
    expect(onDragEnd).toHaveBeenLastCalledWith(false);

    fireEvent.pointerDown(marker, { pointerId: 1 });
    fireEvent.pointerMove(marker, { pointerId: 1, clientX: 100 });
    fireEvent.pointerUp(marker, { pointerId: 1 });
    expect(onDragEnd).toHaveBeenLastCalledWith(true);
  });

  it("adjusts position by 1% on ArrowRight and 10% on Shift+ArrowRight", () => {
    const onAdjustPosition = vi.fn();
    render(
      <InspectorGradientStopTrack
        stops={STOPS}
        selectedStopId="a"
        onSelectStop={vi.fn()}
        onDragStart={vi.fn()}
        onDragMove={vi.fn()}
        onDragEnd={vi.fn()}
        onAdjustPosition={onAdjustPosition}
      />,
    );

    const marker = screen.getByRole("button", { name: "Gradient stop: #000000 at 0%" });
    fireEvent.keyDown(marker, { key: "ArrowRight" });
    expect(onAdjustPosition).toHaveBeenCalledWith("a", 1);

    fireEvent.keyDown(marker, { key: "ArrowRight", shiftKey: true });
    expect(onAdjustPosition).toHaveBeenCalledWith("a", 10);
  });

  it("clamps ArrowLeft at 0 and jumps to 0/100 on Home/End", () => {
    const onAdjustPosition = vi.fn();
    render(
      <InspectorGradientStopTrack
        stops={STOPS}
        selectedStopId="a"
        onSelectStop={vi.fn()}
        onDragStart={vi.fn()}
        onDragMove={vi.fn()}
        onDragEnd={vi.fn()}
        onAdjustPosition={onAdjustPosition}
      />,
    );

    const marker = screen.getByRole("button", { name: "Gradient stop: #000000 at 0%" });
    fireEvent.keyDown(marker, { key: "ArrowLeft" });
    expect(onAdjustPosition).toHaveBeenCalledWith("a", 0);

    fireEvent.keyDown(marker, { key: "End" });
    expect(onAdjustPosition).toHaveBeenCalledWith("a", 100);

    const secondMarker = screen.getByRole("button", { name: "Gradient stop: #ffffff at 100%" });
    fireEvent.keyDown(secondMarker, { key: "Home" });
    expect(onAdjustPosition).toHaveBeenCalledWith("b", 0);
  });

  it("disables every marker and blocks drag start when disabled", () => {
    const onDragStart = vi.fn();
    render(
      <InspectorGradientStopTrack
        stops={STOPS}
        selectedStopId={null}
        disabled
        onSelectStop={vi.fn()}
        onDragStart={onDragStart}
        onDragMove={vi.fn()}
        onDragEnd={vi.fn()}
        onAdjustPosition={vi.fn()}
      />,
    );

    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
    fireEvent.pointerDown(screen.getByRole("button", { name: "Gradient stop: #000000 at 0%" }), { pointerId: 1 });
    expect(onDragStart).not.toHaveBeenCalled();
  });
});
