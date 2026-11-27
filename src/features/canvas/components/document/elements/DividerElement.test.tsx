import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DividerElement } from "./DividerElement";
import { installDocumentStyles } from "../../../../../../test/documentStyles";
import type { EditorElementNode } from "@/features/editor/types/document";

describe("DividerElement (Checkpoint 1.15.6.12.1)", () => {
  it("renders a genuine <hr>, not a styled <div> standing in for one", () => {
    const { container } = render(
      <DividerElement node={{ id: "hr-1", tag: "hr" }} parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block" />,
    );
    const hr = container.querySelector("hr");
    expect(hr).not.toBeNull();
    expect(hr).toHaveAttribute("data-node-id", "hr-1");
    expect(hr).toHaveAttribute("data-node-type", "hr");
  });

  it("has no children slot and no text content", () => {
    const { container } = render(
      <DividerElement node={{ id: "hr-1", tag: "hr" }} parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block" />,
    );
    const hr = container.querySelector("hr")!;
    expect(hr.children).toHaveLength(0);
    expect(hr.textContent).toBe("");
  });

  it("receives its authored HTML ID and Classes through the same generic Identity architecture every other primitive uses", () => {
    const { container } = render(
      <DividerElement
        node={{ id: "hr-1", tag: "hr", htmlId: "section-divider", className: "my-divider" }}
        parentId="section-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );
    const hr = container.querySelector("hr")!;
    expect(hr).toHaveAttribute("id", "section-divider");
    expect(hr).toHaveClass("my-divider");
  });

  it("an authored border fully governs its own appearance — the legacy neutral-gray chrome gets out of the way entirely once real Border data exists", () => {
    const node: EditorElementNode = {
      id: "hr-1",
      tag: "hr",
      border: {
        top: { width: { value: 2, unit: "px" }, style: "dashed", color: "#ff0000" },
        right: { width: { value: 0, unit: "px" }, style: "solid", color: "transparent" },
        bottom: { width: { value: 0, unit: "px" }, style: "solid", color: "transparent" },
        left: { width: { value: 0, unit: "px" }, style: "solid", color: "transparent" },
      },
    };
    const { container } = render(
      <DividerElement
        node={node}
        parentId="section-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );
    installDocumentStyles(node);
    const hr = container.querySelector("hr")!;
    expect(hr).not.toHaveClass("border-zinc-200");
    expect(getComputedStyle(hr).borderTopWidth).toBe("2px");
    expect(getComputedStyle(hr).borderTopStyle).toBe("dashed");
    // jsdom normalizes an authored hex color to rgb() when read back from style.
    expect(getComputedStyle(hr).borderTopColor).toBe("rgb(255, 0, 0)");
  });

  it("persists an explicit manual resize — width/height are neither reverted nor forced (universal resize, Checkpoint 3.4.3)", () => {
    const node: EditorElementNode = { id: "hr-1", tag: "hr", dimensions: { preferredWidth: 240, preferredHeight: 4, offsetX: 0, offsetY: 0 } };
    const { container } = render(
      <DividerElement
        node={node}
        parentId="section-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );
    installDocumentStyles(node);
    const hr = container.querySelector("hr")!;
    expect(getComputedStyle(hr).width).toBe("240px");
    expect(getComputedStyle(hr).height).toBe("4px");
  });
});
