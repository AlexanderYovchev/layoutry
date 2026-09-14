import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InspectorMultiNodeSummary } from "./InspectorMultiNodeSummary";
import type { EditorElementNode } from "@/features/editor/types/document";

describe("InspectorMultiNodeSummary (Checkpoint 1.15.2)", () => {
  it("shows 'N Paragraphs selected' when every selected node shares the same tag", () => {
    const nodes: EditorElementNode[] = [
      { id: "p-1", tag: "p" },
      { id: "p-2", tag: "p" },
      { id: "p-3", tag: "p" },
    ];
    render(<InspectorMultiNodeSummary nodes={nodes} />);
    expect(screen.getByText("3 Paragraphs selected")).toBeInTheDocument();
  });

  it("shows 'N elements selected' for a mixed-tag selection", () => {
    const nodes: EditorElementNode[] = [
      { id: "p-1", tag: "p" },
      { id: "button-1", tag: "button" },
      { id: "image-1", tag: "img" },
    ];
    render(<InspectorMultiNodeSummary nodes={nodes} />);
    expect(screen.getByText("3 elements selected")).toBeInTheDocument();
  });

  it("shows Typography for Paragraph + Heading (both text-bearing)", () => {
    const nodes: EditorElementNode[] = [
      { id: "p-1", tag: "p" },
      { id: "h1-1", tag: "h1" },
    ];
    render(<InspectorMultiNodeSummary nodes={nodes} />);
    expect(screen.getByText("Typography")).toBeInTheDocument();
  });

  it("hides Typography for Paragraph + Image (Image doesn't support it)", () => {
    const nodes: EditorElementNode[] = [
      { id: "p-1", tag: "p" },
      { id: "image-1", tag: "img" },
    ];
    render(<InspectorMultiNodeSummary nodes={nodes} />);
    expect(screen.queryByText("Typography")).not.toBeInTheDocument();
  });

  it("shows Media for Image + Video (both support Media Fit)", () => {
    const nodes: EditorElementNode[] = [
      { id: "image-1", tag: "img" },
      { id: "video-1", tag: "video" },
    ];
    render(<InspectorMultiNodeSummary nodes={nodes} />);
    expect(screen.getByText("Media")).toBeInTheDocument();
  });

  it("hides Media for Image + Iframe (object-fit has no effect on an iframe)", () => {
    const nodes: EditorElementNode[] = [
      { id: "image-1", tag: "img" },
      { id: "iframe-1", tag: "iframe" },
    ];
    render(<InspectorMultiNodeSummary nodes={nodes} />);
    expect(screen.queryByText("Media")).not.toBeInTheDocument();
  });

  it("shows Shape for Container + Section (both shape-capable, Checkpoint 1.15.4)", () => {
    const nodes: EditorElementNode[] = [
      { id: "div-1", tag: "div" },
      { id: "section-1", tag: "section" },
    ];
    render(<InspectorMultiNodeSummary nodes={nodes} />);
    // "Shape" appears twice (the section header and the grid's own inner
    // label) — a role-scoped query avoids the getByText ambiguity.
    expect(screen.getByRole("group", { name: "Shape" })).toBeInTheDocument();
  });

  it("hides Shape for Container + Paragraph (Paragraph isn't shape-capable)", () => {
    const nodes: EditorElementNode[] = [
      { id: "div-1", tag: "div" },
      { id: "p-1", tag: "p" },
    ];
    render(<InspectorMultiNodeSummary nodes={nodes} />);
    expect(screen.queryByRole("group", { name: "Shape" })).not.toBeInTheDocument();
  });

  it("shows SVG for two SVG nodes (Checkpoint 1.15.5)", () => {
    const nodes: EditorElementNode[] = [
      { id: "svg-1", tag: "svg" },
      { id: "svg-2", tag: "svg" },
    ];
    render(<InspectorMultiNodeSummary nodes={nodes} />);
    expect(screen.getByRole("group", { name: "Primitive" })).toBeInTheDocument();
  });

  it("hides SVG for SVG + Container (Container isn't svg-settings-capable)", () => {
    const nodes: EditorElementNode[] = [
      { id: "svg-1", tag: "svg" },
      { id: "div-1", tag: "div" },
    ];
    render(<InspectorMultiNodeSummary nodes={nodes} />);
    expect(screen.queryByRole("group", { name: "Primitive" })).not.toBeInTheDocument();
  });

  it("never renders semantic sections (Identity, Link, Video, Iframe, ...) for a multi-selection", () => {
    const nodes: EditorElementNode[] = [
      { id: "p-1", tag: "p" },
      { id: "a-1", tag: "a" },
    ];
    render(<InspectorMultiNodeSummary nodes={nodes} />);
    expect(screen.queryByText("Identity")).not.toBeInTheDocument();
    expect(screen.queryByText("Link")).not.toBeInTheDocument();
  });

  it("always shows Spacing regardless of tag mix (no capability gate on it, matching single-selection)", () => {
    const nodes: EditorElementNode[] = [
      { id: "p-1", tag: "p" },
      { id: "image-1", tag: "img" },
    ];
    render(<InspectorMultiNodeSummary nodes={nodes} />);
    expect(screen.getByText("Spacing")).toBeInTheDocument();
  });

  it("shows the empty-selection message only when nothing beyond Spacing is shared, alongside a still-working Spacing section", () => {
    // Option keeps only typography/background true (everything else —
    // border/borderRadius/mediaFit/aspectRatio/display/position/filters —
    // is false via its own override); Image keeps typography/background
    // false (not text-bearing/container) but everything else true. Paired
    // together, every single bulk-gated capability lands on false.
    const nodes: EditorElementNode[] = [
      { id: "option-1", tag: "option" },
      { id: "image-1", tag: "img" },
    ];
    render(<InspectorMultiNodeSummary nodes={nodes} />);
    expect(screen.getByText("No shared style controls are available for this selection.")).toBeInTheDocument();
    expect(screen.getByText("Spacing")).toBeInTheDocument();
  });
});
