import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SvgElement } from "./SvgElement";

const baseProps = { parentId: "page-root", parentLayoutMode: "flow" as const, parentFlowDisplay: "block" as const };

describe("SvgElement", () => {
  it("renders a genuine <svg> element, not an <img> or a div standing in for one", () => {
    const { container } = render(
      <SvgElement node={{ id: "svg-1", tag: "svg" }} {...baseProps} />,
    );
    const element = container.querySelector('[data-node-id="svg-1"]');
    expect(element?.tagName.toLowerCase()).toBe("svg");
    expect(element).toHaveAttribute("data-node-type", "svg");
  });

  it("renders the default starter Rectangle geometry when svgKind is unset", () => {
    const { container } = render(<SvgElement node={{ id: "svg-1", tag: "svg" }} {...baseProps} />);
    expect(container.querySelector("rect")).toBeInTheDocument();
    expect(container.querySelector("circle")).not.toBeInTheDocument();
    expect(container.querySelector("polygon")).not.toBeInTheDocument();
  });

  it("renders Circle geometry", () => {
    const { container } = render(<SvgElement node={{ id: "svg-1", tag: "svg", svgKind: "circle" }} {...baseProps} />);
    const circle = container.querySelector("circle");
    expect(circle).toBeInTheDocument();
    expect(circle).toHaveAttribute("cx", "50");
    expect(circle).toHaveAttribute("cy", "50");
    expect(circle).toHaveAttribute("r", "40");
  });

  it("renders Triangle geometry as a polygon", () => {
    const { container } = render(<SvgElement node={{ id: "svg-1", tag: "svg", svgKind: "triangle" }} {...baseProps} />);
    expect(container.querySelector("polygon")).toHaveAttribute("points", "50,10 90,90 10,90");
  });

  it("renders Star geometry as a 10-point polygon", () => {
    const { container } = render(<SvgElement node={{ id: "svg-1", tag: "svg", svgKind: "star" }} {...baseProps} />);
    const points = container.querySelector("polygon")?.getAttribute("points");
    expect(points?.split(" ")).toHaveLength(10);
  });

  it("applies the default 0 0 100 100 viewBox when unset, and a custom one when set", () => {
    const { container: defaultContainer } = render(<SvgElement node={{ id: "svg-1", tag: "svg" }} {...baseProps} />);
    expect(defaultContainer.querySelector("svg")).toHaveAttribute("viewBox", "0 0 100 100");

    const { container: customContainer } = render(
      <SvgElement
        node={{ id: "svg-2", tag: "svg", svgViewBox: { minX: -10, minY: -10, width: 50, height: 50 } }}
        {...baseProps}
      />,
    );
    expect(customContainer.querySelector("svg")).toHaveAttribute("viewBox", "-10 -10 50 50");
  });

  it("applies fill/stroke/strokeWidth as real SVG presentation attributes on the geometry, not CSS", () => {
    const { container } = render(
      <SvgElement
        node={{ id: "svg-1", tag: "svg", svgKind: "circle", svgFill: "#ff0000", svgStroke: "#000000", svgStrokeWidth: 3 }}
        {...baseProps}
      />,
    );
    const circle = container.querySelector("circle");
    expect(circle).toHaveAttribute("fill", "#ff0000");
    expect(circle).toHaveAttribute("stroke", "#000000");
    expect(circle).toHaveAttribute("stroke-width", "3");
  });

  it("omits stroke/stroke-width entirely when stroke is unset (None)", () => {
    const { container } = render(<SvgElement node={{ id: "svg-1", tag: "svg", svgKind: "circle" }} {...baseProps} />);
    const circle = container.querySelector("circle");
    expect(circle).not.toHaveAttribute("stroke");
    expect(circle).not.toHaveAttribute("stroke-width");
  });

  it("resolves an unset fill to native SVG black on the geometry itself", () => {
    const { container } = render(<SvgElement node={{ id: "svg-1", tag: "svg", svgKind: "rectangle" }} {...baseProps} />);
    expect(container.querySelector("rect")).toHaveAttribute("fill", "#000000");
  });

  it("real HTML identity (id/class) belongs to the actual <svg> element", () => {
    const { container } = render(
      <SvgElement node={{ id: "svg-1", tag: "svg", htmlId: "hero-graphic", className: "featured" }} {...baseProps} />,
    );
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("id", "hero-graphic");
    expect(svg?.getAttribute("class")).toContain("featured");
  });

  it("applies CSS background/border/border-radius to the same <svg> box, independent of fill/stroke", () => {
    const { container } = render(
      <SvgElement
        node={{
          id: "svg-1",
          tag: "svg",
          background: { color: "#eeeeee" },
          borderRadius: { topLeft: { value: 8, unit: "px" } },
        }}
        {...baseProps}
      />,
    );
    const svg = container.querySelector("svg") as unknown as HTMLElement;
    expect(svg.style.backgroundColor).toBe("rgb(238, 238, 238)");
    expect(svg.style.borderTopLeftRadius).toBe("8px");
  });
});
