import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { EditorElementNode } from "@/features/editor/types/document";
import { InspectorBulkSpacingSection } from "./InspectorBulkSpacingSection";

/* BC-05.3 — in a multi-selection, an authored 0 and an unset side are different values. */

const zero: EditorElementNode = {
  id: "a",
  tag: "button",
  spacing: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
};
const unset: EditorElementNode = { id: "b", tag: "button" };

describe("InspectorBulkSpacingSection — zero vs unset (BC-05.3)", () => {
  it("reads Mixed when one node authors 0 and another leaves the side unset", () => {
    render(<InspectorBulkSpacingSection nodes={[zero, unset]} />);
    const padding = screen.getByLabelText("Padding");
    expect(padding).toHaveValue(null);
    expect(padding).toHaveAttribute("placeholder", "Mixed");
  });

  it("reads 0 and set when every node authors 0", () => {
    render(
      <InspectorBulkSpacingSection nodes={[zero, { ...zero, id: "c" }]} />,
    );
    expect(screen.getByLabelText("Padding")).toHaveValue(0);
    expect(screen.getAllByText("Explicitly set").length).toBeGreaterThan(0);
  });

  it("does not claim a value is set when every node leaves it unset", () => {
    render(
      <InspectorBulkSpacingSection nodes={[unset, { ...unset, id: "c" }]} />,
    );
    expect(screen.getByLabelText("Margin")).toHaveValue(0);
    expect(screen.queryByText("Explicitly set")).toBeNull();
  });
});
