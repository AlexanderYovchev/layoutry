import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ContainerElement } from "./ContainerElement";

describe("ContainerElement", () => {
  it("renders a div-tagged node as a real <div>", () => {
    const { container } = render(
      <ContainerElement
        node={{ id: "container-1", tag: "div", children: [] }}
        parentId="page-root"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );

    const element = container.querySelector('[data-node-id="container-1"]');
    expect(element?.tagName).toBe("DIV");
  });

  it("renders a section-tagged node as a real <section>, not a div standing in for one (Checkpoint 1.2)", () => {
    const { container } = render(
      <ContainerElement
        node={{ id: "section-1", tag: "section", children: [] }}
        parentId="page-root"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );

    const element = container.querySelector('[data-node-id="section-1"]');
    expect(element?.tagName).toBe("SECTION");
    expect(element).toHaveAttribute("data-node-type", "section");
  });

  it("renders a ul-tagged node as a real <ul> (Checkpoint 1.6)", () => {
    const { container } = render(
      <ContainerElement
        node={{ id: "list-1", tag: "ul", children: [] }}
        parentId="page-root"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );

    const element = container.querySelector('[data-node-id="list-1"]');
    expect(element?.tagName).toBe("UL");
    expect(element).toHaveAttribute("data-node-type", "ul");
  });

  it("renders an ol-tagged node as a real <ol> (Checkpoint 1.6)", () => {
    const { container } = render(
      <ContainerElement
        node={{ id: "list-1", tag: "ol", children: [] }}
        parentId="page-root"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );

    const element = container.querySelector('[data-node-id="list-1"]');
    expect(element?.tagName).toBe("OL");
    expect(element).toHaveAttribute("data-node-type", "ol");
  });

  it("gives ul/ol visible native markers, overriding Tailwind Preflight's list-style: none reset (Checkpoint 1.6)", () => {
    const { container: ulContainer } = render(
      <ContainerElement node={{ id: "list-1", tag: "ul", children: [] }} parentId="page-root" parentLayoutMode="flow" parentFlowDisplay="block" />,
    );
    const { container: olContainer } = render(
      <ContainerElement node={{ id: "list-2", tag: "ol", children: [] }} parentId="page-root" parentLayoutMode="flow" parentFlowDisplay="block" />,
    );

    expect(ulContainer.querySelector('[data-node-id="list-1"]')?.className).toContain("list-disc");
    expect(olContainer.querySelector('[data-node-id="list-2"]')?.className).toContain("list-decimal");
  });

  it("renders its children regardless of which semantic tag it resolves to", () => {
    render(
      <ContainerElement
        node={{ id: "section-1", tag: "section", children: [] }}
        parentId="page-root"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      >
        <p>Nested content</p>
      </ContainerElement>,
    );

    expect(screen.getByText("Nested content")).toBeInTheDocument();
  });

  it("applies the same style resolvers to a section as to a div (e.g. background) — same component, only the DOM tag differs", () => {
    const backgroundNode = { background: { color: "#3366ff" } };

    const { container: divContainer } = render(
      <ContainerElement
        node={{ id: "div-1", tag: "div", ...backgroundNode }}
        parentId="page-root"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );
    const { container: sectionContainer } = render(
      <ContainerElement
        node={{ id: "section-1", tag: "section", ...backgroundNode }}
        parentId="page-root"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );

    const divEl = divContainer.querySelector('[data-node-id="div-1"]') as HTMLElement;
    const sectionEl = sectionContainer.querySelector('[data-node-id="section-1"]') as HTMLElement;
    expect(sectionEl.style.backgroundColor).not.toBe("");
    expect(sectionEl.style.backgroundColor).toBe(divEl.style.backgroundColor);
  });
});
