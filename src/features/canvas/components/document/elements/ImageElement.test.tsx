import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
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

  it("renders a real <img> with object-fit: contain, object-position: 50% 50% by default when the node has a src", () => {
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
    expect(img.style.objectPosition).toBe("50% 50%");
    expect(img.style.width).toBe("100%");
    expect(img.style.height).toBe("100%");
  });

  it("applies the node's explicit mediaFit settings to the rendered <img> (Checkpoint 5.6)", () => {
    const { container } = render(
      <ImageElement
        node={{
          id: "image-1",
          tag: "img",
          src: "data:image/svg+xml;utf8,<svg/>",
          mediaFit: { objectFit: "cover", objectPositionX: { value: 0, unit: "%" }, objectPositionY: { value: 0, unit: "%" } },
        }}
        parentId="section-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );

    const img = container.querySelector("img") as HTMLImageElement;
    expect(img.style.objectFit).toBe("cover");
    expect(img.style.objectPosition).toBe("0% 0%");
  });

  it("supports the full Object Fit value set, including none/scale-down (Checkpoint 5.6)", () => {
    for (const objectFit of ["fill", "contain", "cover", "none", "scale-down"] as const) {
      const { container } = render(
        <ImageElement
          node={{ id: "image-1", tag: "img", src: "data:image/svg+xml;utf8,<svg/>", mediaFit: { objectFit } }}
          parentId="section-1"
          parentLayoutMode="flow"
          parentFlowDisplay="block"
        />,
      );
      const img = container.querySelector("img") as HTMLImageElement;
      expect(img.style.objectFit).toBe(objectFit);
    }
  });

  it("supports an out-of-range custom object position (Checkpoint 5.6 — CSS permits cropping/overflow on purpose)", () => {
    const { container } = render(
      <ImageElement
        node={{
          id: "image-1",
          tag: "img",
          src: "data:image/svg+xml;utf8,<svg/>",
          mediaFit: { objectPositionX: { value: -20, unit: "%" }, objectPositionY: { value: 120, unit: "%" } },
        }}
        parentId="section-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );

    const img = container.querySelector("img") as HTMLImageElement;
    expect(img.style.objectPosition).toBe("-20% 120%");
  });

  it("keeps objectFit/objectPosition off the outer wrapper and aspectRatio off the inner <img> (Checkpoint 5.6 — outer/inner ownership separation)", () => {
    const { container } = render(
      <ImageElement
        node={{
          id: "image-1",
          tag: "img",
          src: "data:image/svg+xml;utf8,<svg/>",
          aspectRatio: { mode: "ratio", width: 1, height: 1 },
          mediaFit: { objectFit: "cover", objectPositionX: { value: 0, unit: "%" }, objectPositionY: { value: 0, unit: "%" } },
        }}
        parentId="section-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );

    const img = container.querySelector("img") as HTMLImageElement;
    const wrapper = img.parentElement as HTMLElement;

    expect(wrapper.style.aspectRatio).toBe("1 / 1");
    expect(wrapper.style.objectFit).toBe("");
    expect(wrapper.style.objectPosition).toBe("");

    expect(img.style.objectFit).toBe("cover");
    expect(img.style.objectPosition).toBe("0% 0%");
    expect(img.style.aspectRatio).toBe("");
  });

  it("keeps the fixed h-40 placeholder height by default, so an unresized image still has a real box", () => {
    const { container } = render(
      <ImageElement node={{ id: "image-1", tag: "img" }} parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block" />,
    );
    const wrapper = container.querySelector('[data-node-id="image-1"]') as HTMLElement;
    expect(wrapper.className).toContain("h-40");
  });

  it("drops the fixed h-40 placeholder height once an explicit ratio-mode aspect ratio is set, so the ratio can actually reshape the box (Checkpoint 5.6 fix — h-40 previously fixed height unconditionally, silently blocking Aspect Ratio's own visual effect on every unresized Image)", () => {
    const { container } = render(
      <ImageElement
        node={{ id: "image-1", tag: "img", aspectRatio: { mode: "ratio", width: 1, height: 1 } }}
        parentId="section-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );
    const wrapper = container.querySelector('[data-node-id="image-1"]') as HTMLElement;
    expect(wrapper.className).not.toContain("h-40");
    expect(wrapper.style.aspectRatio).toBe("1 / 1");
  });

  it("keeps the fixed h-40 placeholder height for an explicit Auto aspect ratio (mode: 'auto' has no visual effect to unblock)", () => {
    const { container } = render(
      <ImageElement
        node={{ id: "image-1", tag: "img", aspectRatio: { mode: "auto" } }}
        parentId="section-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );
    const wrapper = container.querySelector('[data-node-id="image-1"]') as HTMLElement;
    expect(wrapper.className).toContain("h-40");
  });

  it("changing mediaFit never mutates aspectRatio and vice versa — independent properties on the same node (Checkpoint 5.6)", () => {
    const node = {
      id: "image-1",
      tag: "img",
      src: "data:image/svg+xml;utf8,<svg/>",
      aspectRatio: { mode: "ratio" as const, width: 16, height: 9 },
      mediaFit: { objectFit: "contain" as const },
    };

    const { container, rerender } = render(
      <ImageElement node={node} parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block" />,
    );
    const wrapperBefore = (container.querySelector("img")!.parentElement as HTMLElement).style.aspectRatio;

    rerender(
      <ImageElement
        node={{ ...node, mediaFit: { objectFit: "cover" } }}
        parentId="section-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );
    const img = container.querySelector("img") as HTMLImageElement;
    const wrapper = img.parentElement as HTMLElement;
    expect(img.style.objectFit).toBe("cover");
    expect(wrapper.style.aspectRatio).toBe(wrapperBefore);
    expect(wrapper.style.aspectRatio).toBe("16 / 9");
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

  it("applies an explicit aspect ratio to the outer wrapper, not the inner <img> (Checkpoint 5.5)", () => {
    const { container } = render(
      <ImageElement
        node={{ id: "image-1", tag: "img", src: "data:image/svg+xml;utf8,<svg/>", aspectRatio: { mode: "ratio", width: 16, height: 9 } }}
        parentId="section-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );

    const img = container.querySelector("img") as HTMLImageElement;
    const wrapper = img.parentElement as HTMLElement;
    expect(wrapper.style.aspectRatio).toBe("16 / 9");
    // The inner <img> keeps filling its wrapper via resolveMediaFitStyle —
    // aspect-ratio shapes the *box* (the wrapper), object-fit/object-
    // position (Checkpoint 5.6) will govern the *content* inside it, kept
    // deliberately separate for that future checkpoint to build on.
    expect(img.style.aspectRatio).toBe("");
    expect(img.style.width).toBe("100%");
    expect(img.style.height).toBe("100%");
  });

  it("preserves normal intrinsic image behavior with an explicit Auto aspect ratio", () => {
    const { container } = render(
      <ImageElement
        node={{ id: "image-1", tag: "img", src: "data:image/svg+xml;utf8,<svg/>", aspectRatio: { mode: "auto" } }}
        parentId="section-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );

    const img = container.querySelector("img") as HTMLImageElement;
    const wrapper = img.parentElement as HTMLElement;
    expect(wrapper.style.aspectRatio).toBe("auto");
  });

  it("applies authored HTML id/class to the real inner <img>, not the editor wrapper div (Checkpoint 1.15.1)", () => {
    const { container } = render(
      <ImageElement
        node={{ id: "image-1", tag: "img", src: "data:image/svg+xml;utf8,<svg/>", htmlId: "hero-image", className: "my-custom-class" }}
        parentId="section-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );

    const img = container.querySelector("img") as HTMLImageElement;
    const wrapper = img.parentElement as HTMLElement;
    expect(img).toHaveAttribute("id", "hero-image");
    expect(img.className).toContain("my-custom-class");
    // The wrapper div (editor-only geometry box, data-node-id owner) never receives it.
    expect(wrapper).not.toHaveAttribute("id");
    expect(wrapper.className).not.toContain("my-custom-class");
  });
});

describe("ImageElement — CSS Transition Foundation (Checkpoint 1.15.6.14.1)", () => {
  const initialState = useEditorStore.getState();
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("places the authored transition on the outer wrapper, never the inner <img>, and only renders it in Preview", () => {
    const transition = { property: "opacity" as const, durationMs: 200, timingFunction: "ease" as const, delayMs: 0 };
    useEditorStore.setState({ editorMode: "preview" });
    const { container } = render(
      <ImageElement
        node={{ id: "image-1", tag: "img", src: "data:image/svg+xml;utf8,<svg/>", transition }}
        parentId="section-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );

    const img = container.querySelector("img") as HTMLImageElement;
    const wrapper = img.parentElement as HTMLElement;
    expect(wrapper.style.transitionProperty).toBe("opacity");
    expect(img.style.transitionProperty).toBe("");
  });
});

describe("ImageElement — CSS Transform Foundation (Checkpoint 1.15.6.14.3)", () => {
  const initialState = useEditorStore.getState();
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("places the authored Transform on the outer wrapper, never the inner <img>", () => {
    const { container } = render(
      <ImageElement
        node={{ id: "image-1", tag: "img", src: "data:image/svg+xml;utf8,<svg/>", transform: { rotateDeg: 15 } }}
        parentId="section-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );

    const img = container.querySelector("img") as HTMLImageElement;
    const wrapper = img.parentElement as HTMLElement;
    expect(wrapper.style.transform).toBe("rotate(15deg)");
    expect(img.style.transform).toBe("");
  });
});
