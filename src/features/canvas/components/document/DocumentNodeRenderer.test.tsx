import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { EditorElementNode } from "@/features/editor/types/document";
import { DocumentNodeRenderer } from "./DocumentNodeRenderer";

describe("DocumentNodeRenderer", () => {
  it("recursively renders nested nodes as their real HTML tags with content", () => {
    const tree: EditorElementNode = {
      id: "container-1",
      tag: "div",
      children: [
        { id: "heading-1", tag: "h3", text: "Heading text" },
        { id: "paragraph-1", tag: "p", text: "Paragraph text" },
        { id: "button-1", tag: "button", text: "Click me" },
      ],
    };

    render(<DocumentNodeRenderer node={tree} parentId={null} parentLayoutMode="flow" />);

    expect(
      screen.getByRole("heading", { level: 3, name: "Heading text" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Paragraph text").tagName).toBe("P");
    expect(
      screen.getByRole("button", { name: "Click me" }),
    ).toBeInTheDocument();
  });

  it("stamps every rendered node with its own id, type, and parent id", () => {
    const tree: EditorElementNode = {
      id: "container-1",
      tag: "div",
      children: [{ id: "heading-1", tag: "h1", text: "Title" }],
    };

    render(<DocumentNodeRenderer node={tree} parentId={null} parentLayoutMode="flow" />);

    const heading = screen.getByRole("heading", { name: "Title" });
    expect(heading).toHaveAttribute("data-node-id", "heading-1");
    expect(heading).toHaveAttribute("data-node-type", "h1");
    expect(heading).toHaveAttribute("data-parent-id", "container-1");
  });

  it("degrades an unregistered node type to a transparent wrapper that still renders its children", () => {
    const tree: EditorElementNode = {
      id: "nav-1",
      tag: "nav",
      children: [{ id: "paragraph-1", tag: "p", text: "Still visible" }],
    };

    render(<DocumentNodeRenderer node={tree} parentId={null} parentLayoutMode="flow" />);

    expect(screen.getByText("Still visible")).toBeInTheDocument();
  });

  it("renders the document root (tag page) via its own dedicated component", () => {
    const tree: EditorElementNode = {
      id: "page-root",
      tag: "page",
      children: [{ id: "heading-1", tag: "h1", text: "Title" }],
    };

    render(<DocumentNodeRenderer node={tree} parentId={null} parentLayoutMode="flow" />);

    const root = document.querySelector('[data-node-id="page-root"]');
    expect(root).toHaveAttribute("data-node-type", "page");
    expect(screen.getByRole("heading", { name: "Title" })).toBeInTheDocument();
  });

  it("renders an img node as an empty-image placeholder rather than nothing", () => {
    const tree: EditorElementNode = { id: "image-1", tag: "img" };

    render(<DocumentNodeRenderer node={tree} parentId={null} parentLayoutMode="flow" />);

    const placeholder = document.querySelector('[data-node-id="image-1"]');
    expect(placeholder).toBeInTheDocument();
    expect(placeholder).toHaveAttribute("data-node-type", "img");
  });
});
