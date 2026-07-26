import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ButtonElement } from "./ButtonElement";

describe("ButtonElement", () => {
  it("renders with no inline size when not resized", () => {
    render(<ButtonElement node={{ id: "button-1", tag: "button", text: "Go" }} parentId="section-1" />);

    const button = screen.getByRole("button", { name: "Go" });
    expect(button.style.width).toBe("");
  });

  it("applies the preferred size and clips overflow once resized — universal resize, Checkpoint 3.4.3", () => {
    render(
      <ButtonElement
        node={{
          id: "button-1",
          tag: "button",
          text: "Go",
          dimensions: { preferredWidth: 200, preferredHeight: 50, offsetX: 0, offsetY: 0 },
        }}
        parentId="section-1"
      />,
    );

    const button = screen.getByRole("button", { name: "Go" });
    expect(button.style.width).toBe("200px");
    expect(button.style.height).toBe("50px");
    expect(button.style.overflow).toBe("hidden");
  });
});
