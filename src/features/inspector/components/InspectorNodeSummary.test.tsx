import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InspectorNodeSummary } from "./InspectorNodeSummary";

describe("InspectorNodeSummary", () => {
  it("shows the node's display name, tag, and id", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "heading-1", tag: "h1" }}
        parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block"
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
        parentId={null} parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );

    expect(screen.getByText("Primary Button")).toBeInTheDocument();
  });

  it("omits the Parent ID row when the node has no parent", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "page-root", tag: "page" }}
        parentId={null} parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );

    expect(screen.queryByText("Parent ID")).not.toBeInTheDocument();
  });

  it("shows Width/Height as Auto for a resizable node that hasn't been resized yet", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "section-1", tag: "section" }}
        parentId={null} parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );

    const widthRow = screen.getByText("Width").parentElement;
    const heightRow = screen.getByText("Height").parentElement;
    expect(widthRow).not.toBeNull();
    expect(heightRow).not.toBeNull();
    // Scoped to each dimension row specifically (rather than a page-wide
    // getAllByText("Auto") count) — the Background section's Size control
    // (Checkpoint 4.3) also has a literal "Auto" option, which would
    // otherwise inflate an unscoped count and make this assertion fragile
    // against unrelated Inspector sections.
    expect(within(widthRow!).getByText("Auto")).toBeInTheDocument();
    expect(within(heightRow!).getByText("Auto")).toBeInTheDocument();
  });

  it("shows the current pixel dimensions for a resized node", () => {
    render(
      <InspectorNodeSummary
        node={{
          id: "section-1",
          tag: "section",
          dimensions: { preferredWidth: 320.4, preferredHeight: 180, offsetX: 0, offsetY: 0 },
        }}
        parentId={null} parentLayoutMode="flow" parentFlowDisplay="block"
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
        parentId={null} parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );

    expect(screen.getByText("400px")).toBeInTheDocument();
    expect(screen.getByText("60px")).toBeInTheDocument();
  });

  it("omits Width/Height rows for a non-resizable node (the document root)", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "page-root", tag: "page" }}
        parentId={null} parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );

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

    render(
      <InspectorNodeSummary node={node} parentId="section-2" parentLayoutMode="flow" parentFlowDisplay="block" />,
    );

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

describe("InspectorNodeSummary — Free layout (Checkpoint 3.4.4)", () => {
  it("shows editable X/Y/Width/Height fields instead of read-only Width/Height when the parent is Free", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "image-1", tag: "img", freeLayout: { x: 16, y: 16, width: 100, height: 80 } }}
        parentId="section-1"
        parentLayoutMode="free"
        parentFlowDisplay="block"
      />,
    );

    expect(screen.getByLabelText("X")).toHaveValue(16);
    expect(screen.getByLabelText("Width")).toHaveValue(100);
    expect(screen.queryByText("Auto")).not.toBeInTheDocument();
  });

  it("shows the Layout section for a container-capable node", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "section-1", tag: "section" }}
        parentId={null} parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );

    expect(screen.getByText("Layout")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Flow" })).toBeInTheDocument();
  });

  it("omits the Layout section for a leaf node", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "heading-1", tag: "h1" }}
        parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );

    expect(screen.queryByText("Layout")).not.toBeInTheDocument();
  });
});

describe("InspectorNodeSummary — Flex/Grid child sections (Checkpoint 3.5)", () => {
  it("shows the Flex item section when the parent's display is flex", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "heading-1", tag: "h1" }}
        parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="flex"
      />,
    );

    expect(screen.getByText("Flex item")).toBeInTheDocument();
    expect(screen.queryByText("Grid item")).not.toBeInTheDocument();
  });

  it("shows the Grid item section when the parent's display is grid", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "heading-1", tag: "h1" }}
        parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="grid"
      />,
    );

    expect(screen.getByText("Grid item")).toBeInTheDocument();
    expect(screen.queryByText("Flex item")).not.toBeInTheDocument();
  });

  it("omits both Flex and Grid item sections when the parent's display is block", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "heading-1", tag: "h1" }}
        parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );

    expect(screen.queryByText("Flex item")).not.toBeInTheDocument();
    expect(screen.queryByText("Grid item")).not.toBeInTheDocument();
  });

  it("omits both Flex and Grid item sections for a Free child even if parentFlowDisplay is flex/grid", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "image-1", tag: "img", freeLayout: { x: 0, y: 0, width: 100, height: 80 } }}
        parentId="section-1" parentLayoutMode="free" parentFlowDisplay="flex"
      />,
    );

    expect(screen.queryByText("Flex item")).not.toBeInTheDocument();
    expect(screen.queryByText("Grid item")).not.toBeInTheDocument();
  });

  it("always shows the Spacing section regardless of parent display", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "heading-1", tag: "h1" }}
        parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );

    expect(screen.getByText("Spacing")).toBeInTheDocument();
  });
});

describe("InspectorNodeSummary — Media section (Checkpoint 3.5.1)", () => {
  it("shows the Media section for an image (intrinsic-aspect-ratio-capable tag)", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "image-1", tag: "img" }}
        parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );

    expect(screen.getByText("Media")).toBeInTheDocument();
  });

  it("omits the Media section for a non-media tag", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "heading-1", tag: "h1" }}
        parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );

    expect(screen.queryByText("Media")).not.toBeInTheDocument();
  });
});

describe("InspectorNodeSummary — Typography section (Checkpoint 4.2)", () => {
  it("shows the Typography section for a text-bearing tag", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "heading-1", tag: "h1" }}
        parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );

    expect(screen.getByText("Typography")).toBeInTheDocument();
  });

  it("omits the Typography section for a non-text-bearing tag (e.g. a container)", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "section-1", tag: "section" }}
        parentId={null} parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );

    expect(screen.queryByText("Typography")).not.toBeInTheDocument();
  });

  it("omits the Typography section for a media tag", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "image-1", tag: "img" }}
        parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );

    expect(screen.queryByText("Typography")).not.toBeInTheDocument();
  });
});

describe("InspectorNodeSummary — Background section (Checkpoint 4.3)", () => {
  it("shows the Background section for a container tag", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "section-1", tag: "section" }}
        parentId={null} parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );

    expect(screen.getByText("Background")).toBeInTheDocument();
  });

  it("shows the Background section for a text-bearing tag", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "heading-1", tag: "h1" }}
        parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );

    expect(screen.getByText("Background")).toBeInTheDocument();
  });

  it("omits the Background section for a media tag", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "image-1", tag: "img" }}
        parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );

    expect(screen.queryByText("Background")).not.toBeInTheDocument();
  });
});

describe("InspectorNodeSummary — Border section (Checkpoint 4.4)", () => {
  it("shows the Border section for a container tag", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "section-1", tag: "section" }}
        parentId={null} parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );

    expect(screen.getByText("Border")).toBeInTheDocument();
  });

  it("shows the Border section for a media tag, unlike Background", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "image-1", tag: "img" }}
        parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );

    expect(screen.getByText("Border")).toBeInTheDocument();
  });

  it("omits the Border section for the non-selectable document root", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "page-root", tag: "page" }}
        parentId={null} parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );

    expect(screen.queryByText("Border")).not.toBeInTheDocument();
  });
});
