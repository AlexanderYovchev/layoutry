import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InspectorPropertyRow } from "./InspectorPropertyRow";

describe("InspectorPropertyRow", () => {
  it("renders the label and children", () => {
    render(
      <InspectorPropertyRow label="Width">
        <input aria-label="Width" />
      </InspectorPropertyRow>,
    );
    expect(screen.getByText("Width")).toBeInTheDocument();
    expect(screen.getByLabelText("Width")).toBeInTheDocument();
  });

  it("shows an accessible status text for a non-unset state", () => {
    render(
      <InspectorPropertyRow label="Margin" state="set">
        <input aria-label="Margin" />
      </InspectorPropertyRow>,
    );
    expect(screen.getByText("Explicitly set")).toBeInTheDocument();
  });

  it("shows no state indicator for the unset state", () => {
    render(
      <InspectorPropertyRow label="Margin" state="unset">
        <input aria-label="Margin" />
      </InspectorPropertyRow>,
    );
    expect(screen.queryByText("Not set — using the default")).not.toBeInTheDocument();
  });

  it("renders an error message and treats the row as invalid", () => {
    render(
      <InspectorPropertyRow label="Width" error="Must be a positive number">
        <input aria-label="Width" />
      </InspectorPropertyRow>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Must be a positive number");
  });

  it("dims the row when disabled", () => {
    render(
      <InspectorPropertyRow label="Width" disabled>
        <input aria-label="Width" />
      </InspectorPropertyRow>,
    );
    // Reaches up to the row's own outer wrapper (skip the "text-xs" inner flex row).
    const label = screen.getByText("Width");
    const outer = label.closest("div")?.parentElement?.parentElement;
    expect(outer).toHaveClass("opacity-50");
  });

  it("renders secondary and reset controls alongside children", () => {
    render(
      <InspectorPropertyRow
        label="Margin"
        secondary={<button type="button">Linked</button>}
        reset={<button type="button">Reset margin</button>}
      >
        <input aria-label="Margin" />
      </InspectorPropertyRow>,
    );
    expect(screen.getByRole("button", { name: "Linked" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset margin" })).toBeInTheDocument();
  });

  it("renders a help tooltip trigger with an accessible name when help text is provided", () => {
    render(
      <InspectorPropertyRow label="Width" help="The element's own width, before any layout constraints.">
        <input aria-label="Width" />
      </InspectorPropertyRow>,
    );
    expect(
      screen.getByRole("button", { name: "The element's own width, before any layout constraints." }),
    ).toBeInTheDocument();
  });
});
