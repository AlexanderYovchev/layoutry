import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ImageElement } from "./ImageElement";

describe("ImageElement", () => {
  it("renders the icon-only placeholder when the node has no src yet", () => {
    const { container } = render(
      <ImageElement
        node={{ id: "image-1", tag: "img" }}
        parentId="section-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );

    expect(container.querySelector("img")).not.toBeInTheDocument();
  });

  it("renders a real <img> with object-fit: contain by default when the node has a src", () => {
    const { container } = render(
      <ImageElement
        node={{ id: "image-1", tag: "img", src: "data:image/svg+xml;utf8,<svg/>" }}
        parentId="section-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );

    const img = container.querySelector("img") as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.src).toContain("data:image/svg+xml");
    expect(img.style.objectFit).toBe("contain");
    expect(img.style.objectPosition).toBe("center");
    expect(img.style.width).toBe("100%");
    expect(img.style.height).toBe("100%");
  });

  it("applies the node's explicit mediaFit settings to the rendered <img>", () => {
    const { container } = render(
      <ImageElement
        node={{
          id: "image-1",
          tag: "img",
          src: "data:image/svg+xml;utf8,<svg/>",
          mediaFit: { fit: "cover", position: "top", preserveAspectRatio: true },
        }}
        parentId="section-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );

    const img = container.querySelector("img") as HTMLImageElement;
    expect(img.style.objectFit).toBe("cover");
    expect(img.style.objectPosition).toBe("top");
  });

  it("forces object-fit: fill when preserveAspectRatio is false", () => {
    const { container } = render(
      <ImageElement
        node={{
          id: "image-1",
          tag: "img",
          src: "data:image/svg+xml;utf8,<svg/>",
          mediaFit: { fit: "contain", position: "center", preserveAspectRatio: false },
        }}
        parentId="section-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );

    const img = container.querySelector("img") as HTMLImageElement;
    expect(img.style.objectFit).toBe("fill");
  });

  it("stretches the outer wrapper to fill its Grid track regardless of the image's own aspect ratio", () => {
    const { container } = render(
      <ImageElement
        node={{ id: "image-1", tag: "img", src: "data:image/svg+xml;utf8,<svg/>" }}
        parentId="section-1"
        parentLayoutMode="flow"
        parentFlowDisplay="grid"
      />,
    );

    const wrapper = container.querySelector("img")!.parentElement as HTMLElement;
    expect(wrapper.style.width).toBe("100%");
    expect(wrapper.style.height).toBe("100%");
  });
});
