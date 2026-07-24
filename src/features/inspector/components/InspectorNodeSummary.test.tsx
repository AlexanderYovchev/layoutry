import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InspectorNodeSummary } from "./InspectorNodeSummary";

describe("InspectorNodeSummary", () => {
  it("shows the node's display name, tag, and id", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "heading-1", tag: "h1" }}
        parentId="section-1"
      />,
    );

    expect(screen.getByText("Heading")).toBeInTheDocument();
    expect(screen.getByText("h1")).toBeInTheDocument();
    expect(screen.getByText("heading-1")).toBeInTheDocument();
    expect(screen.getByText("section-1")).toBeInTheDocument();
  });

  it("prefers an explicit displayName over the tag mapping", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "button-1", tag: "button", displayName: "Primary Button" }}
        parentId={null}
      />,
    );

    expect(screen.getByText("Primary Button")).toBeInTheDocument();
  });

  it("omits the Parent ID row when the node has no parent", () => {
    render(<InspectorNodeSummary node={{ id: "page-root", tag: "page" }} parentId={null} />);

    expect(screen.queryByText("Parent ID")).not.toBeInTheDocument();
  });

  it("shows Width/Height as Auto for a resizable node that hasn't been resized yet", () => {
    render(<InspectorNodeSummary node={{ id: "section-1", tag: "section" }} parentId={null} />);

    expect(screen.getByText("Width")).toBeInTheDocument();
    expect(screen.getByText("Height")).toBeInTheDocument();
    expect(screen.getAllByText("Auto")).toHaveLength(2);
  });

  it("shows the current pixel dimensions for a resized node", () => {
    render(
      <InspectorNodeSummary
        node={{
          id: "section-1",
          tag: "section",
          dimensions: { width: 320.4, height: 180, offsetX: 0, offsetY: 0 },
        }}
        parentId={null}
      />,
    );

    expect(screen.getByText("320px")).toBeInTheDocument();
    expect(screen.getByText("180px")).toBeInTheDocument();
  });

  it("omits Width/Height rows for a non-resizable node", () => {
    render(<InspectorNodeSummary node={{ id: "heading-1", tag: "h1" }} parentId={null} />);

    expect(screen.queryByText("Width")).not.toBeInTheDocument();
    expect(screen.queryByText("Height")).not.toBeInTheDocument();
  });
});
