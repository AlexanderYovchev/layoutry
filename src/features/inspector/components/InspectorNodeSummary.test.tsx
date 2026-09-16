import { render, screen } from "@testing-library/react";
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

  it("shows Width/Height as editable Auto fields for a resizable node that hasn't been resized yet (Checkpoint 5.7 — was read-only text)", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "section-1", tag: "section" }}
        parentId={null} parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );

    expect(screen.getByLabelText("Width")).toHaveValue(null);
    expect(screen.getByLabelText("Height")).toHaveValue(null);
  });

  it("shows the current pixel dimensions for a resized node as editable field values", () => {
    render(
      <InspectorNodeSummary
        node={{
          id: "section-1",
          tag: "section",
          dimensions: { preferredWidth: 320, preferredHeight: 180, offsetX: 0, offsetY: 0 },
        }}
        parentId={null} parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );

    expect(screen.getByLabelText("Width")).toHaveValue(320);
    expect(screen.getByLabelText("Height")).toHaveValue(180);
    expect(screen.queryByText(/constrained/i)).not.toBeInTheDocument();
  });

  it("shows editable Width/Height fields for a text element (heading) — universal resize, Checkpoint 3.4.3", () => {
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

    expect(screen.getByLabelText("Width")).toHaveValue(400);
    expect(screen.getByLabelText("Height")).toHaveValue(60);
  });

  it("omits the Size section (and its Width/Height fields) for a non-resizable node (the document root)", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "page-root", tag: "page" }}
        parentId={null} parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );

    expect(screen.queryByLabelText("Width")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Height")).not.toBeInTheDocument();
  });

  it("shows the effective rendered size plus a constrained-by-parent note when the DOM box is smaller than preferred", () => {
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

    // The field itself still shows the user's own preferred value (never
    // silently rewritten by the live rendered size) — only the caption
    // beneath it reports the current constrained rendered size.
    expect(screen.getByLabelText("Width")).toHaveValue(600);
    expect(screen.getByText(/renders at 350px/i)).toBeInTheDocument();
    // Height wasn't constrained (200 rendered == 200 preferred) — no caption for it.
    expect(screen.queryByText(/renders at 200px/i)).not.toBeInTheDocument();

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
    // DimensionRows' own read-only "Auto" value renders as a <span> — scoped
    // to that element type since Checkpoint 4.8's Display & Visibility
    // section (also rendered for this media node) legitimately has several
    // unrelated "Auto" segmented-row <button> options (Pointer Events,
    // Overflow X/Y, User Select) that must not false-positive this check.
    expect(screen.queryByText("Auto", { selector: "span" })).not.toBeInTheDocument();
  });

  it("shows the Layout section for a container-capable node", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "section-1", tag: "section" }}
        parentId={null} parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );

    expect(screen.getByText("Content Layout")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Flow" })).toBeInTheDocument();
  });

  it("omits the Layout section for a leaf node", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "heading-1", tag: "h1" }}
        parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );

    expect(screen.queryByText("Content Layout")).not.toBeInTheDocument();
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

describe("InspectorNodeSummary — Position section (Checkpoint 5.1)", () => {
  it("shows the Position section for an ordinary Flow node", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "container-1", tag: "div" }}
        parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );

    expect(screen.getByRole("group", { name: "Position" })).toBeInTheDocument();
  });

  it("omits the Position section for the document root/body wrapper (page/body opt out of supportsPosition)", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "page-1", tag: "page" }}
        parentId={null} parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );

    expect(screen.queryByRole("group", { name: "Position" })).not.toBeInTheDocument();
  });

  it("omits the Position section for a Free-layout child — Free layout already owns CSS position on that node", () => {
    // Deliberately a non-media tag: an img here would also carry the
    // unrelated, pre-existing Media section's own "Position" control
    // (object-position, Checkpoint 3.5.1), which would collide with this
    // assertion's own accessible-name query despite being a different
    // control entirely.
    render(
      <InspectorNodeSummary
        node={{ id: "container-1", tag: "div", freeLayout: { x: 16, y: 16, width: 100, height: 80 } }}
        parentId="section-1"
        parentLayoutMode="free"
        parentFlowDisplay="block"
      />,
    );

    expect(screen.queryByRole("group", { name: "Position" })).not.toBeInTheDocument();
  });

  it("omits the Position section for a container that hosts its own Free children — it already owns position: relative", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "section-1", tag: "section", layoutMode: "free" }}
        parentId={null} parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );

    expect(screen.queryByRole("group", { name: "Position" })).not.toBeInTheDocument();
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

describe("InspectorNodeSummary — Heading Level section (Checkpoint 1.7)", () => {
  it("shows the Heading Level section for a Heading", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "heading-1", tag: "h1" }}
        parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );

    expect(screen.getByText("Heading Level")).toBeInTheDocument();
  });

  it("shows the Heading Level section for every h1-h6 level", () => {
    for (const tag of ["h2", "h3", "h4", "h5", "h6"]) {
      const { unmount } = render(
        <InspectorNodeSummary
          node={{ id: "heading-1", tag }}
          parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block"
        />,
      );
      expect(screen.getByText("Heading Level")).toBeInTheDocument();
      unmount();
    }
  });

  it("omits the Heading Level section for Paragraph, Button, Link, and Image", () => {
    for (const node of [
      { id: "p-1", tag: "p" },
      { id: "button-1", tag: "button" },
      { id: "a-1", tag: "a", href: "#" },
      { id: "img-1", tag: "img" },
    ]) {
      const { unmount } = render(
        <InspectorNodeSummary node={node} parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block" />,
      );
      expect(screen.queryByText("Heading Level")).not.toBeInTheDocument();
      unmount();
    }
  });

  it("does not render the Heading Level section under/above Typography ambiguously — both appear, distinct sections", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "heading-1", tag: "h1" }}
        parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );

    expect(screen.getByText("Heading Level")).toBeInTheDocument();
    expect(screen.getByText("Typography")).toBeInTheDocument();
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

describe("InspectorNodeSummary — Border Radius section (Checkpoint 4.5)", () => {
  it("shows the Border Radius section for a container tag", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "section-1", tag: "section" }}
        parentId={null} parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );

    expect(screen.getByText("Border Radius")).toBeInTheDocument();
  });

  it("shows the Border Radius section for a media tag, unlike Background", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "image-1", tag: "img" }}
        parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );

    expect(screen.getByText("Border Radius")).toBeInTheDocument();
  });

  it("omits the Border Radius section for the non-selectable document root", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "page-root", tag: "page" }}
        parentId={null} parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );

    expect(screen.queryByText("Border Radius")).not.toBeInTheDocument();
  });
});

describe("InspectorNodeSummary — Box Shadow section (Checkpoint 4.6)", () => {
  it("shows the Box Shadow section for a container tag", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "section-1", tag: "section" }}
        parentId={null} parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );

    expect(screen.getByText("Box Shadow")).toBeInTheDocument();
  });

  it("shows the Box Shadow section for a media tag, unlike Background", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "image-1", tag: "img" }}
        parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );

    expect(screen.getByText("Box Shadow")).toBeInTheDocument();
  });

  it("omits the Box Shadow section for the non-selectable document root", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "page-root", tag: "page" }}
        parentId={null} parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );

    expect(screen.queryByText("Box Shadow")).not.toBeInTheDocument();
  });
});

describe("InspectorNodeSummary — Visual Effects section (Checkpoint 4.7)", () => {
  it("shows the Visual Effects section for a container tag", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "section-1", tag: "section" }}
        parentId={null} parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );

    expect(screen.getByText("Visual Effects")).toBeInTheDocument();
  });

  it("shows the Visual Effects section for a media tag, unlike Background", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "image-1", tag: "img" }}
        parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );

    expect(screen.getByText("Visual Effects")).toBeInTheDocument();
  });

  it("omits the Visual Effects section for the non-selectable document root", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "page-root", tag: "page" }}
        parentId={null} parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );

    expect(screen.queryByText("Visual Effects")).not.toBeInTheDocument();
  });
});

describe("InspectorNodeSummary — Display & Visibility section (Checkpoint 4.8)", () => {
  it("shows the Display & Visibility section for a container tag", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "section-1", tag: "section" }}
        parentId={null} parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );

    expect(screen.getByText("Display & Visibility")).toBeInTheDocument();
  });

  it("shows the Display & Visibility section for a media tag", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "image-1", tag: "img" }}
        parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );

    expect(screen.getByText("Display & Visibility")).toBeInTheDocument();
  });

  it("omits the Display & Visibility section for the non-selectable document root", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "page-root", tag: "page" }}
        parentId={null} parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );

    expect(screen.queryByText("Display & Visibility")).not.toBeInTheDocument();
  });
});

describe("InspectorNodeSummary — Form Control section (Checkpoint 1.10)", () => {
  it("shows the Form Control section for an Input", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "input-1", tag: "input", inputType: "text" }}
        parentId="form-1" parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );

    expect(screen.getByText("Form Control")).toBeInTheDocument();
  });

  it("shows the Form Control section for a Textarea (Checkpoint 1.12 — the section now supports more than one native tag)", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "textarea-1", tag: "textarea" }}
        parentId="form-1" parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );

    expect(screen.getByText("Form Control")).toBeInTheDocument();
  });

  it("omits the Form Control section for unrelated elements (a container, a heading, a button, a form, a label)", () => {
    for (const node of [
      { id: "div-1", tag: "div" },
      { id: "heading-1", tag: "h1" },
      { id: "button-1", tag: "button" },
      { id: "form-1", tag: "form" },
      { id: "label-1", tag: "label" },
    ]) {
      const { unmount } = render(
        <InspectorNodeSummary node={node} parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block" />,
      );
      expect(screen.queryByText("Form Control")).not.toBeInTheDocument();
      unmount();
    }
  });

  it("does not render the Form Control section ambiguously against Typography — both appear, distinct sections", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "input-1", tag: "input", inputType: "text" }}
        parentId="form-1" parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );

    expect(screen.getByText("Form Control")).toBeInTheDocument();
    expect(screen.getByText("Typography")).toBeInTheDocument();
  });
});

describe("InspectorNodeSummary — Select/Option (Checkpoint 1.13)", () => {
  it("shows the Form Control section (Name only) and the Options section for a Select", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "select-1", tag: "select", children: [] }}
        parentId="form-1" parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );

    expect(screen.getByText("Form Control")).toBeInTheDocument();
    expect(screen.getByText("Options")).toBeInTheDocument();
  });

  it("omits the Options section for anything other than Select", () => {
    render(<InspectorNodeSummary node={{ id: "div-1", tag: "div" }} parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block" />);
    expect(screen.queryByText("Options")).not.toBeInTheDocument();
  });

  it("shows the dedicated Option section for an Option, and omits Form Control/Options/Size for it", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "option-1", tag: "option", text: "Bulgaria" }}
        parentId="select-1" parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );

    expect(screen.getByText("Option")).toBeInTheDocument();
    expect(screen.queryByText("Form Control")).not.toBeInTheDocument();
    expect(screen.queryByText("Options")).not.toBeInTheDocument();
    expect(screen.queryByText("Size")).not.toBeInTheDocument();
  });

  it("Select IS still a container tag (accepts Option), but no longer shows the Layout section — Checkpoint 1.14 closed this known Checkpoint 1.13 edge case via elementCapabilities.ts's supportsChildLayout: false override, the same fix Table's identical problem needed", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "select-1", tag: "select", children: [{ id: "option-1", tag: "option", text: "A" }] }}
        parentId="form-1" parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );
    expect(screen.queryByText("Content Layout")).not.toBeInTheDocument();
  });

  it("omits the Layout section for Option — a genuine leaf", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "option-1", tag: "option", text: "A" }}
        parentId="select-1" parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );
    expect(screen.queryByText("Content Layout")).not.toBeInTheDocument();
  });
});

describe("InspectorNodeSummary — Table (Checkpoint 1.14)", () => {
  it("shows the Table section only for tag: table", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "table-1", tag: "table", children: [] }}
        parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );
    expect(screen.getByText("Columns")).toBeInTheDocument();
    expect(screen.getByText("Body Rows")).toBeInTheDocument();
  });

  it("omits the Table section for every other tag", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "div-1", tag: "div", children: [] }}
        parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );
    expect(screen.queryByText("Body Rows")).not.toBeInTheDocument();
  });

  it("omits the Layout section for Table/Thead/Tbody/Tfoot/Tr — native table layout, not Layoutry's Flow/Flex/Grid", () => {
    for (const tag of ["table", "thead", "tbody", "tfoot", "tr"]) {
      const { unmount } = render(
        <InspectorNodeSummary
          node={{ id: `${tag}-1`, tag, children: [] }}
          parentId="parent-1" parentLayoutMode="flow" parentFlowDisplay="block"
        />,
      );
      expect(screen.queryByText("Content Layout"), tag).not.toBeInTheDocument();
      unmount();
    }
  });

  it("keeps the Layout section for an ordinary container that happens to sit next to a table (no accidental over-broad restriction)", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "div-1", tag: "div", children: [] }}
        parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );
    expect(screen.getByText("Content Layout")).toBeInTheDocument();
  });

  it("omits the Size section for Thead/Tbody/Tfoot/Tr — their size is computed entirely by native table layout", () => {
    for (const tag of ["thead", "tbody", "tfoot", "tr"]) {
      const { unmount } = render(
        <InspectorNodeSummary
          node={{ id: `${tag}-1`, tag, children: [] }}
          parentId="parent-1" parentLayoutMode="flow" parentFlowDisplay="block"
        />,
      );
      expect(screen.queryByLabelText("Width"), tag).not.toBeInTheDocument();
      unmount();
    }
  });

  it("keeps the Size section for Table itself and for Th/Td — an explicit width/height is a real, effective control there", () => {
    for (const tag of ["table", "th", "td"]) {
      const { unmount } = render(
        <InspectorNodeSummary
          node={{ id: `${tag}-1`, tag }}
          parentId="parent-1" parentLayoutMode="flow" parentFlowDisplay="block"
        />,
      );
      expect(screen.getByLabelText("Width"), tag).toBeInTheDocument();
      unmount();
    }
  });

  it("omits the Position section for every table primitive (Thead/Tbody/Tfoot/Tr/Th/Td) — an absolute/fixed value would break native table layout", () => {
    for (const tag of ["thead", "tbody", "tfoot", "tr", "th", "td"]) {
      const { unmount } = render(
        <InspectorNodeSummary
          node={{ id: `${tag}-1`, tag }}
          parentId="parent-1" parentLayoutMode="flow" parentFlowDisplay="block"
        />,
      );
      expect(screen.queryByText("Position"), tag).not.toBeInTheDocument();
      unmount();
    }
  });

  it("shows the Typography section for Th/Td — both are text-bearing leaves", () => {
    for (const tag of ["th", "td"]) {
      const { unmount } = render(
        <InspectorNodeSummary
          node={{ id: `${tag}-1`, tag, text: "Alpha" }}
          parentId="tr-1" parentLayoutMode="flow" parentFlowDisplay="block"
        />,
      );
      expect(screen.getByText("Typography"), tag).toBeInTheDocument();
      unmount();
    }
  });
});

describe("InspectorNodeSummary — Label (Checkpoint 1.11)", () => {
  it("shows the Layout section for Label — it's a real container, no Label-specific CSS controls", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "label-1", tag: "label" }}
        parentId="form-1" parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );

    expect(screen.getByText("Content Layout")).toBeInTheDocument();
    expect(screen.getByText("Background")).toBeInTheDocument();
  });

  it("omits the Heading Level and Form Control sections for Label", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "label-1", tag: "label" }}
        parentId="form-1" parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );

    expect(screen.queryByText("Heading Level")).not.toBeInTheDocument();
    expect(screen.queryByText("Form Control")).not.toBeInTheDocument();
  });
});

describe("InspectorNodeSummary — Video + Iframe (Checkpoint 1.15)", () => {
  it("shows the Video section only for tag: video", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "video-1", tag: "video" }}
        parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );
    expect(screen.getByRole("switch", { name: "Controls" })).toBeInTheDocument();
  });

  it("shows the Embed section only for tag: iframe", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "iframe-1", tag: "iframe", title: "Embedded content" }}
        parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );
    expect(screen.getByLabelText("Title")).toHaveValue("Embedded content");
  });

  it("omits the Video section for Iframe, and the Embed section for Video", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "video-1", tag: "video" }}
        parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
  });

  it("shows the Media (Object Fit/Position) section for Video", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "video-1", tag: "video" }}
        parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );
    expect(screen.getByText("Media")).toBeInTheDocument();
  });

  it("omits the Media (Object Fit/Position) section for Iframe — object-fit has no effect on an embedded document", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "iframe-1", tag: "iframe" }}
        parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );
    expect(screen.queryByText("Media")).not.toBeInTheDocument();
  });

  it("omits Typography for both Video and Iframe — neither is text-bearing", () => {
    for (const tag of ["video", "iframe"]) {
      const { unmount } = render(
        <InspectorNodeSummary
          node={{ id: `${tag}-1`, tag }}
          parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block"
        />,
      );
      expect(screen.queryByText("Typography"), tag).not.toBeInTheDocument();
      unmount();
    }
  });

  it("omits the Layout section for both Video and Iframe — both are leaves, not containers", () => {
    for (const tag of ["video", "iframe"]) {
      const { unmount } = render(
        <InspectorNodeSummary
          node={{ id: `${tag}-1`, tag }}
          parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block"
        />,
      );
      expect(screen.queryByText("Content Layout"), tag).not.toBeInTheDocument();
      unmount();
    }
  });

  it("shows the Size section for both Video and Iframe", () => {
    for (const tag of ["video", "iframe"]) {
      const { unmount } = render(
        <InspectorNodeSummary
          node={{ id: `${tag}-1`, tag }}
          parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block"
        />,
      );
      expect(screen.getByLabelText("Width"), tag).toBeInTheDocument();
      unmount();
    }
  });
});

describe("InspectorNodeSummary — Identity section (Checkpoint 1.15.1)", () => {
  it("shows the Identity section (ID/Classes) unconditionally, for an ordinary container", () => {
    render(
      <InspectorNodeSummary
        node={{ id: "section-1", tag: "section" }}
        parentId={null} parentLayoutMode="flow" parentFlowDisplay="block"
      />,
    );
    expect(screen.getByText("Identity")).toBeInTheDocument();
    expect(screen.getByLabelText("ID")).toBeInTheDocument();
    expect(screen.getByLabelText("Classes")).toBeInTheDocument();
  });

  it("shows the Identity section for real, non-container semantic tags too (table/option)", () => {
    for (const tag of ["table", "option"]) {
      const { unmount } = render(
        <InspectorNodeSummary
          node={{ id: `${tag}-1`, tag }}
          parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block"
        />,
      );
      expect(screen.getByText("Identity"), tag).toBeInTheDocument();
      unmount();
    }
  });
});
