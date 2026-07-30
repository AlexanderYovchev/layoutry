import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InspectorUnitSelect } from "./InspectorUnitSelect";

describe("InspectorUnitSelect", () => {
  it("renders plain text (no dropdown) when only one unit is allowed", () => {
    render(<InspectorUnitSelect unit="px" allowedUnits={["px"]} onChange={vi.fn()} label="Width unit" />);
    expect(screen.getByText("px")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("only offers the configured allowed units, not a hardcoded universal list", () => {
    render(
      <InspectorUnitSelect unit="px" allowedUnits={["px", "rem", "em"]} onChange={vi.fn()} label="Width unit" />,
    );
    const select = screen.getByLabelText("Width unit");
    const options = Array.from(select.querySelectorAll("option")).map((option) => option.textContent);
    expect(options).toEqual(["px", "rem", "em"]);
    expect(options).not.toContain("vh");
  });

  it("calls onChange with the selected unit", () => {
    const onChange = vi.fn();
    render(
      <InspectorUnitSelect unit="px" allowedUnits={["px", "%"]} onChange={onChange} label="Width unit" />,
    );
    fireEvent.change(screen.getByLabelText("Width unit"), { target: { value: "%" } });
    expect(onChange).toHaveBeenCalledWith("%");
  });
});
