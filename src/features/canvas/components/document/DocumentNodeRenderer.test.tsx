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

    render(<DocumentNodeRenderer node={tree} parentId={null} parentLayoutMode="flow" parentFlowDisplay="block" />);

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

    render(<DocumentNodeRenderer node={tree} parentId={null} parentLayoutMode="flow" parentFlowDisplay="block" />);

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

    render(<DocumentNodeRenderer node={tree} parentId={null} parentLayoutMode="flow" parentFlowDisplay="block" />);

    expect(screen.getByText("Still visible")).toBeInTheDocument();
  });

  it("renders the document root (tag page) via its own dedicated component", () => {
    const tree: EditorElementNode = {
      id: "page-root",
      tag: "page",
      children: [{ id: "heading-1", tag: "h1", text: "Title" }],
    };

    render(<DocumentNodeRenderer node={tree} parentId={null} parentLayoutMode="flow" parentFlowDisplay="block" />);

    const root = document.querySelector('[data-node-id="page-root"]');
    expect(root).toHaveAttribute("data-node-type", "page");
    expect(screen.getByRole("heading", { name: "Title" })).toBeInTheDocument();
  });

  it("renders nested Section/Container structures with correct semantic tags at every level (Checkpoint 1.2)", () => {
    const tree: EditorElementNode = {
      id: "section-1",
      tag: "section",
      children: [
        {
          id: "container-1",
          tag: "div",
          children: [
            { id: "heading-1", tag: "h1", text: "Nested heading" },
            { id: "paragraph-1", tag: "p", text: "Nested paragraph" },
          ],
        },
      ],
    };

    const { container } = render(
      <DocumentNodeRenderer node={tree} parentId={null} parentLayoutMode="flow" parentFlowDisplay="block" />,
    );

    expect(container.querySelector('[data-node-id="section-1"]')?.tagName).toBe("SECTION");
    expect(container.querySelector('[data-node-id="container-1"]')?.tagName).toBe("DIV");
    expect(
      screen.getByRole("heading", { level: 1, name: "Nested heading" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Nested paragraph")).toBeInTheDocument();
  });

  it("renders a Container nested inside a Section nested inside another Container (Checkpoint 1.2)", () => {
    const tree: EditorElementNode = {
      id: "outer-container",
      tag: "div",
      children: [
        {
          id: "inner-section",
          tag: "section",
          children: [{ id: "image-1", tag: "img" }],
        },
      ],
    };

    const { container } = render(
      <DocumentNodeRenderer node={tree} parentId={null} parentLayoutMode="flow" parentFlowDisplay="block" />,
    );

    expect(container.querySelector('[data-node-id="outer-container"]')?.tagName).toBe("DIV");
    expect(container.querySelector('[data-node-id="inner-section"]')?.tagName).toBe("SECTION");
    expect(container.querySelector('[data-node-id="image-1"]')).toBeInTheDocument();
  });

  it("renders Link alongside existing primitives inside a Container, and nested inside a Section (Checkpoint 1.4)", () => {
    const tree: EditorElementNode = {
      id: "section-1",
      tag: "section",
      children: [
        {
          id: "container-1",
          tag: "div",
          children: [
            { id: "heading-1", tag: "h1", text: "Title" },
            { id: "paragraph-1", tag: "p", text: "Body copy" },
            { id: "link-1", tag: "a", text: "Learn more", href: "/about" },
            { id: "image-1", tag: "img" },
          ],
        },
      ],
    };

    const { container } = render(
      <DocumentNodeRenderer node={tree} parentId={null} parentLayoutMode="flow" parentFlowDisplay="block" />,
    );

    expect(container.querySelector('[data-node-id="section-1"]')?.tagName).toBe("SECTION");
    expect(container.querySelector('[data-node-id="container-1"]')?.tagName).toBe("DIV");
    const link = container.querySelector('[data-node-id="link-1"]');
    expect(link?.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/about");
    expect(screen.getByRole("link", { name: "Learn more" })).toBeInTheDocument();
  });

  it("renders a full Unordered List with List Items, nested inside Section > Container (Checkpoint 1.6)", () => {
    const tree: EditorElementNode = {
      id: "section-1",
      tag: "section",
      children: [
        {
          id: "container-1",
          tag: "div",
          children: [
            { id: "heading-1", tag: "h1", text: "Title" },
            { id: "paragraph-1", tag: "p", text: "Body copy" },
            {
              id: "list-1",
              tag: "ul",
              children: [
                { id: "li-1", tag: "li", text: "Alpha" },
                { id: "li-2", tag: "li", text: "Beta" },
                { id: "li-3", tag: "li", text: "Gamma" },
              ],
            },
            { id: "link-1", tag: "a", text: "Learn more", href: "/about" },
            { id: "button-1", tag: "button", text: "Go" },
          ],
        },
      ],
    };

    const { container } = render(
      <DocumentNodeRenderer node={tree} parentId={null} parentLayoutMode="flow" parentFlowDisplay="block" />,
    );

    expect(container.querySelector('[data-node-id="section-1"]')?.tagName).toBe("SECTION");
    expect(container.querySelector('[data-node-id="container-1"]')?.tagName).toBe("DIV");
    const list = container.querySelector('[data-node-id="list-1"]');
    expect(list?.tagName).toBe("UL");
    const items = list?.querySelectorAll("li") ?? [];
    expect(items).toHaveLength(3);
    expect(Array.from(items).map((item) => item.textContent)).toEqual(["Alpha", "Beta", "Gamma"]);
    // Every li's own data-parent-id points at the ul, not the outer Container.
    for (const item of items) {
      expect(item).toHaveAttribute("data-parent-id", "list-1");
    }
  });

  it("renders a real <ol> as its genuine semantic tag, not a <ul> or <div> standing in for one (Checkpoint 1.6)", () => {
    const tree: EditorElementNode = {
      id: "list-1",
      tag: "ol",
      children: [{ id: "li-1", tag: "li", text: "First" }],
    };

    const { container } = render(
      <DocumentNodeRenderer node={tree} parentId={null} parentLayoutMode="flow" parentFlowDisplay="block" />,
    );

    expect(container.querySelector('[data-node-id="list-1"]')?.tagName).toBe("OL");
    expect(container.querySelector('[data-node-id="li-1"]')?.tagName).toBe("LI");
  });

  it("renders an img node as an empty-image placeholder rather than nothing", () => {
    const tree: EditorElementNode = { id: "image-1", tag: "img" };

    render(<DocumentNodeRenderer node={tree} parentId={null} parentLayoutMode="flow" parentFlowDisplay="block" />);

    const placeholder = document.querySelector('[data-node-id="image-1"]');
    expect(placeholder).toBeInTheDocument();
    expect(placeholder).toHaveAttribute("data-node-type", "img");
  });
});
