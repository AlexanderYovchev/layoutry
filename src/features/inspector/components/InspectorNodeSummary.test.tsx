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
          dimensions: { preferredWidth: 320.4, preferredHeight: 180, offsetX: 0, offsetY: 0 },
        }}
        parentId={null}
      />,
    );

    expect(screen.getByText("320px")).toBeInTheDocument();
    expect(screen.getByText("180px")).toBeInTheDocument();
    expect(screen.queryByText("Constrained")).not.toBeInTheDocument();
  });

  it("shows Width/Height rows for a text element (heading) — universal resize, Checkpoint 3.4.3", () => {
    render(
      <InspectorNodeSummary
        node={{
          id: "heading-1",
          tag: "h1",
          dimensions: { preferredWidth: 400, preferredHeight: 60, offsetX: 0, offsetY: 0 },
        }}
        parentId={null}
      />,
    );

    expect(screen.getByText("400px")).toBeInTheDocument();
    expect(screen.getByText("60px")).toBeInTheDocument();
  });

  it("omits Width/Height rows for a non-resizable node (the document root)", () => {
    render(<InspectorNodeSummary node={{ id: "page-root", tag: "page" }} parentId={null} />);

    expect(screen.queryByText("Width")).not.toBeInTheDocument();
    expect(screen.queryByText("Height")).not.toBeInTheDocument();
  });

  it("shows the effective rendered size plus 'Constrained by parent' when the DOM box is smaller than preferred", () => {
    const node = {
      id: "image-1",
      tag: "img",
      dimensions: { preferredWidth: 600, preferredHeight: 200, offsetX: 0, offsetY: 0 },
    };
    document.body.innerHTML = '<div data-node-id="image-1"></div>';
    const target = document.querySelector('[data-node-id="image-1"]') as HTMLElement;
    target.getBoundingClientRect = () =>
      ({ width: 350, height: 200, top: 0, left: 0, right: 350, bottom: 200, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;

    render(<InspectorNodeSummary node={node} parentId="section-2" />);

    expect(screen.getByText("350px")).toBeInTheDocument();
    expect(screen.getByText("Preferred width")).toBeInTheDocument();
    expect(screen.getByText("600px")).toBeInTheDocument();
    expect(screen.getByText("Constrained")).toBeInTheDocument();
    expect(screen.getByText("By parent")).toBeInTheDocument();
    // Height wasn't constrained (200 rendered == 200 preferred) — no extra rows for it.
    expect(screen.queryByText("Preferred height")).not.toBeInTheDocument();

    document.body.innerHTML = "";
  });
});
