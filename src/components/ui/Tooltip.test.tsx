import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Tooltip } from "./Tooltip";

function tooltipText(label: string) {
  return screen.getByText(label, { selector: "span[aria-hidden=true]" });
}

describe("Tooltip", () => {
  it("opens below its trigger, anchored to the start edge, by default", () => {
    render(
      <Tooltip label="Undo">
        <button type="button">u</button>
      </Tooltip>,
    );
    expect(tooltipText("Undo")).toHaveClass("top-full", "left-0");
    expect(tooltipText("Undo")).not.toHaveClass("bottom-full");
  });

  it("can open above its trigger for controls near the bottom of the viewport (UI-1.7)", () => {
    render(
      <Tooltip label="Expand panel" placement="top">
        <button type="button">e</button>
      </Tooltip>,
    );
    expect(tooltipText("Expand panel")).toHaveClass("bottom-full");
    expect(tooltipText("Expand panel")).not.toHaveClass("top-full");
  });

  it("can anchor to the end edge for controls near the right edge", () => {
    render(
      <Tooltip label="Account" align="end">
        <button type="button">a</button>
      </Tooltip>,
    );
    expect(tooltipText("Account")).toHaveClass("right-0");
  });
});
