import { fireEvent, render, screen } from "@testing-library/react";
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

  it("renders every semantic sectioning tag as its genuine native element (Checkpoint 1.8)", () => {
    const tagToDomTag: Record<string, string> = {
      header: "HEADER",
      nav: "NAV",
      main: "MAIN",
      article: "ARTICLE",
      aside: "ASIDE",
      footer: "FOOTER",
    };

    for (const [tag, domTag] of Object.entries(tagToDomTag)) {
      const { container, unmount } = render(
        <ContainerElement
          node={{ id: `node-${tag}`, tag, children: [] }}
          parentId="page-root"
          parentLayoutMode="flow"
          parentFlowDisplay="block"
        />,
      );

      const element = container.querySelector(`[data-node-id="node-${tag}"]`);
      expect(element?.tagName, tag).toBe(domTag);
      expect(element).toHaveAttribute("data-node-type", tag);
      unmount();
    }
  });

  it("applies the same style resolvers to a semantic sectioning element as to a div (e.g. background) — same component, only the DOM tag differs", () => {
    const backgroundNode = { background: { color: "#3366ff" } };

    const { container: divContainer } = render(
      <ContainerElement node={{ id: "div-1", tag: "div", ...backgroundNode }} parentId="page-root" parentLayoutMode="flow" parentFlowDisplay="block" />,
    );
    const { container: footerContainer } = render(
      <ContainerElement node={{ id: "footer-1", tag: "footer", ...backgroundNode }} parentId="page-root" parentLayoutMode="flow" parentFlowDisplay="block" />,
    );

    const divEl = divContainer.querySelector('[data-node-id="div-1"]') as HTMLElement;
    const footerEl = footerContainer.querySelector('[data-node-id="footer-1"]') as HTMLElement;
    expect(footerEl.style.backgroundColor).not.toBe("");
    expect(footerEl.style.backgroundColor).toBe(divEl.style.backgroundColor);
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

  it("renders a form-tagged node as a real <form>, not a div standing in for one (Checkpoint 1.10)", () => {
    const { container } = render(
      <ContainerElement node={{ id: "form-1", tag: "form", children: [] }} parentId="page-root" parentLayoutMode="flow" parentFlowDisplay="block" />,
    );

    const element = container.querySelector('[data-node-id="form-1"]');
    expect(element?.tagName).toBe("FORM");
    expect(element).toHaveAttribute("data-node-type", "form");
  });

  it("prevents a real <form>'s native submission inside the editor (Checkpoint 1.10)", () => {
    const { container } = render(
      <ContainerElement node={{ id: "form-1", tag: "form", children: [] }} parentId="page-root" parentLayoutMode="flow" parentFlowDisplay="block" />,
    );

    const form = container.querySelector('[data-node-id="form-1"]') as HTMLFormElement;
    // fireEvent.submit returns false exactly when preventDefault() was
    // called by a handler — the same signal a native dispatchEvent gives
    // (mirrors LinkElement's own navigation-prevention test).
    const notCancelled = fireEvent.submit(form);

    expect(notCancelled).toBe(false);
  });

  it("does not attach a submit handler to non-form semantic tags", () => {
    const { container } = render(
      <ContainerElement node={{ id: "div-1", tag: "div", children: [] }} parentId="page-root" parentLayoutMode="flow" parentFlowDisplay="block" />,
    );

    const div = container.querySelector('[data-node-id="div-1"]') as HTMLElement;
    const notCancelled = fireEvent.submit(div);

    expect(notCancelled).toBe(true);
  });

  it("renders a label-tagged node as a real <label>, not a div standing in for one (Checkpoint 1.11)", () => {
    const { container } = render(
      <ContainerElement node={{ id: "label-1", tag: "label", children: [] }} parentId="form-1" parentLayoutMode="flow" parentFlowDisplay="block" />,
    );

    const element = container.querySelector('[data-node-id="label-1"]');
    expect(element?.tagName).toBe("LABEL");
    expect(element).toHaveAttribute("data-node-type", "label");
  });

  it("renders its children inside a real <label> — Label wrapping an ordinary child element", () => {
    render(
      <ContainerElement node={{ id: "label-1", tag: "label", children: [] }} parentId="form-1" parentLayoutMode="flow" parentFlowDisplay="block">
        <input type="text" />
      </ContainerElement>,
    );

    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("prevents a real <label>'s native click-activation of a wrapped control (Checkpoint 1.11)", () => {
    const { container } = render(
      <ContainerElement node={{ id: "label-1", tag: "label", children: [] }} parentId="form-1" parentLayoutMode="flow" parentFlowDisplay="block" />,
    );

    const label = container.querySelector('[data-node-id="label-1"]') as HTMLLabelElement;
    // fireEvent.click returns false exactly when preventDefault() was
    // called by a handler — the same signal used for Link's own
    // navigation-prevention test and Form's own submission-prevention
    // test above.
    const notCancelled = fireEvent.click(label);

    expect(notCancelled).toBe(false);
  });

  it("renders a fieldset-tagged node as a real <fieldset>, not a div standing in for one (Checkpoint 1.15.6.12.1)", () => {
    const { container } = render(
      <ContainerElement node={{ id: "fieldset-1", tag: "fieldset", children: [] }} parentId="form-1" parentLayoutMode="flow" parentFlowDisplay="block" />,
    );

    const element = container.querySelector('[data-node-id="fieldset-1"]');
    expect(element?.tagName).toBe("FIELDSET");
    expect(element).toHaveAttribute("data-node-type", "fieldset");
  });

  it("renders its children inside a real <fieldset> — no onSubmit/onClick special-case attached, unlike Form/Label", () => {
    const { container } = render(
      <ContainerElement node={{ id: "fieldset-1", tag: "fieldset", children: [] }} parentId="form-1" parentLayoutMode="flow" parentFlowDisplay="block">
        <input type="text" />
      </ContainerElement>,
    );

    expect(screen.getByRole("textbox")).toBeInTheDocument();
    const fieldset = container.querySelector('[data-node-id="fieldset-1"]') as HTMLFieldSetElement;
    const notCancelled = fireEvent.click(fieldset);
    expect(notCancelled).toBe(true);
  });

  it("renders a figure-tagged node as a real <figure>, not a div standing in for one (Checkpoint 1.15.6.12.2)", () => {
    const { container } = render(
      <ContainerElement node={{ id: "figure-1", tag: "figure", children: [] }} parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block" />,
    );

    const element = container.querySelector('[data-node-id="figure-1"]');
    expect(element?.tagName).toBe("FIGURE");
    expect(element).toHaveAttribute("data-node-type", "figure");
  });

  it("renders ordinary children (img + figcaption) inside a real <figure> — no special-case behavior attached", () => {
    const { container } = render(
      <ContainerElement node={{ id: "figure-1", tag: "figure", children: [] }} parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block">
        {/* eslint-disable-next-line @next/next/no-img-element -- a plain DOM assertion fixture, not app image content */}
        <img alt="" />
        <figcaption>Caption</figcaption>
      </ContainerElement>,
    );

    expect(screen.getByText("Caption")).toBeInTheDocument();
    const figure = container.querySelector('[data-node-id="figure-1"]') as HTMLElement;
    const notCancelled = fireEvent.click(figure);
    expect(notCancelled).toBe(true);
  });

  it("does not attach a click-activation guard to non-label semantic tags", () => {
    const { container } = render(
      <ContainerElement node={{ id: "form-1", tag: "form", children: [] }} parentId="page-root" parentLayoutMode="flow" parentFlowDisplay="block" />,
    );

    const form = container.querySelector('[data-node-id="form-1"]') as HTMLElement;
    const notCancelled = fireEvent.click(form);

    expect(notCancelled).toBe(true);
  });

  it("renders the authored HTML id and appends the authored class alongside required editor classes (Checkpoint 1.15.1)", () => {
    const { container } = render(
      <ContainerElement
        node={{ id: "container-1", tag: "div", children: [], htmlId: "hero", className: "hero-section featured" }}
        parentId="page-root"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );

    const element = container.querySelector('[data-node-id="container-1"]') as HTMLElement;
    expect(element).toHaveAttribute("id", "hero");
    expect(element.className).toContain("hero-section");
    expect(element.className).toContain("featured");
    // Layoutry's own required editor chrome is still present alongside it.
    expect(element.className).toContain("flex");
  });

  it("omits the id attribute entirely when htmlId is unset — never a synthesized default", () => {
    const { container } = render(
      <ContainerElement node={{ id: "container-1", tag: "div", children: [] }} parentId="page-root" parentLayoutMode="flow" parentFlowDisplay="block" />,
    );

    const element = container.querySelector('[data-node-id="container-1"]') as HTMLElement;
    expect(element).not.toHaveAttribute("id");
  });
});

describe("ContainerElement — Advanced Container Shapes (Checkpoint 1.15.4)", () => {
  it("applies the mapped clip-path for a non-rectangle shape preset", () => {
    const { container } = render(
      <ContainerElement
        node={{ id: "container-1", tag: "div", shape: "hexagon", children: [] }}
        parentId="page-root"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );

    const element = container.querySelector('[data-node-id="container-1"]') as HTMLElement;
    expect(element.style.clipPath).toBe("polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)");
  });

  it("applies no clip-path at all for an unset shape (ordinary rectangle)", () => {
    const { container } = render(
      <ContainerElement
        node={{ id: "container-1", tag: "div", children: [] }}
        parentId="page-root"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );

    const element = container.querySelector('[data-node-id="container-1"]') as HTMLElement;
    expect(element.style.clipPath).toBe("");
  });

  it("preserves background/border-radius on the same box a non-rectangle shape is applied to", () => {
    const { container } = render(
      <ContainerElement
        node={{
          id: "container-1",
          tag: "section",
          shape: "circle",
          background: { color: "#ff0000" },
          borderRadius: { topLeft: { value: 12, unit: "px" } },
          children: [],
        }}
        parentId="page-root"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );

    const element = container.querySelector('[data-node-id="container-1"]') as HTMLElement;
    expect(element.style.clipPath).toBe("circle(50% at 50% 50%)");
    expect(element.style.backgroundColor).toBe("rgb(255, 0, 0)");
    expect(element.style.borderTopLeftRadius).toBe("12px");
  });
});
