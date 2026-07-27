import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ParagraphElement } from "./ParagraphElement";

describe("ParagraphElement", () => {
  it("uses the prose reading-measure default when not resized", () => {
    render(<ParagraphElement node={{ id: "p-1", tag: "p", text: "Body copy." }} parentId="section-1" parentLayoutMode="flow" />);

    const paragraph = screen.getByText("Body copy.");
    expect(paragraph.className).toContain("max-w-prose");
    expect(paragraph.style.width).toBe("");
  });

  it("drops the prose max-width and applies the explicit size once resized — parent-dependent width still wins via maxWidth: 100%", () => {
    render(
      <ParagraphElement
        node={{
          id: "p-1",
          tag: "p",
          text: "Body copy.",
          dimensions: { preferredWidth: 800, preferredHeight: 120, offsetX: 0, offsetY: 0 },
        }}
        parentId="section-1"
        parentLayoutMode="flow"
      />,
    );

    const paragraph = screen.getByText("Body copy.");
    expect(paragraph.className).not.toContain("max-w-prose");
    expect(paragraph.style.width).toBe("800px");
    expect(paragraph.style.maxWidth).toBe("100%");
    expect(paragraph.style.overflow).toBe("hidden");
  });
});
