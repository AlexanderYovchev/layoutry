import { describe, expect, it } from "vitest";
import { computeAppliedPanelWidths } from "./computeAppliedPanelWidths";

const baseOptions = {
  resourceMinWidth: 220,
  inspectorMinWidth: 260,
  minWorkspaceWidth: 420,
};

describe("computeAppliedPanelWidths", () => {
  it("returns both widths unchanged when everything comfortably fits", () => {
    const result = computeAppliedPanelWidths({
      ...baseOptions,
      viewportWidth: 1920,
      resourceWidth: 280,
      inspectorWidth: 300,
    });

    expect(result).toEqual({ resourceWidth: 280, inspectorWidth: 300 });
  });

  it("shrinks the Resource Panel first when space runs short", () => {
    // 1024 - 420 (workspace) = 604 available; 280 + 300 = 580 fits, so
    // widen both preferences until they don't, to exercise the shrink path.
    const result = computeAppliedPanelWidths({
      ...baseOptions,
      viewportWidth: 1024,
      resourceWidth: 400,
      inspectorWidth: 300,
    });

    // available = 604; overflow = 400 + 300 - 604 = 96; resource has
    // 400 - 220 = 180px of slack, more than enough to absorb the overflow.
    expect(result).toEqual({ resourceWidth: 304, inspectorWidth: 300 });
  });

  it("only shrinks the Inspector once the Resource Panel is already at its minimum", () => {
    const result = computeAppliedPanelWidths({
      ...baseOptions,
      viewportWidth: 900,
      resourceWidth: 280,
      inspectorWidth: 500,
    });

    // available = 480; naive sum = 780; overflow = 300.
    // Resource can only give up 280 - 220 = 60, leaving 240 overflow for
    // the Inspector to absorb: 500 - 240 = 260 (its minimum).
    expect(result).toEqual({ resourceWidth: 220, inspectorWidth: 260 });
  });

  it("never reduces either panel below its minimum", () => {
    const result = computeAppliedPanelWidths({
      ...baseOptions,
      viewportWidth: 900,
      resourceWidth: 520,
      inspectorWidth: 520,
    });

    expect(result.resourceWidth).toBeGreaterThanOrEqual(220);
    expect(result.inspectorWidth).toBeGreaterThanOrEqual(260);
  });

  it("treats a hidden panel (zeroed width and minWidth) as contributing nothing", () => {
    const result = computeAppliedPanelWidths({
      viewportWidth: 1024,
      resourceWidth: 0,
      resourceMinWidth: 0,
      inspectorWidth: 300,
      inspectorMinWidth: 260,
      minWorkspaceWidth: 420,
    });

    expect(result).toEqual({ resourceWidth: 0, inspectorWidth: 300 });
  });
});
