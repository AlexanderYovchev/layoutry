import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { ImageElement } from "./ImageElement";
import { generatedStyleOf, installDocumentStyles } from "../../../../../../test/documentStyles";
import type { EditorElementNode } from "@/features/editor/types/document";

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
    const node: EditorElementNode = { id: "image-1", tag: "img", src: "data:image/svg+xml;utf8,<svg/>" };
    const { container } = render(
      <ImageElement
        node={node}
        parentId="section-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );
    installDocumentStyles(node);

    const img = container.querySelector("img") as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.src).toContain("data:image/svg+xml");
    expect(getComputedStyle(img).objectFit).toBe("contain");
    expect(getComputedStyle(img).objectPosition).toBe("50% 50%");
    expect(getComputedStyle(img).width).toBe("100%");
    expect(getComputedStyle(img).height).toBe("100%");
  });

  it("applies the node's explicit mediaFit settings to the rendered <img> (Checkpoint 5.6)", () => {
    const node: EditorElementNode = {
      id: "image-1",
      tag: "img",
      src: "data:image/svg+xml;utf8,<svg/>",
      mediaFit: { objectFit: "cover", objectPositionX: { value: 0, unit: "%" }, objectPositionY: { value: 0, unit: "%" } },
    };
    const { container } = render(
      <ImageElement
        node={node}
        parentId="section-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );
    installDocumentStyles(node);

    const img = container.querySelector("img") as HTMLImageElement;
    expect(getComputedStyle(img).objectFit).toBe("cover");
    expect(getComputedStyle(img).objectPosition).toBe("0% 0%");
  });

  it("supports the full Object Fit value set, including none/scale-down (Checkpoint 5.6)", () => {
    for (const objectFit of ["fill", "contain", "cover", "none", "scale-down"] as const) {
      const node: EditorElementNode = { id: "image-1", tag: "img", src: "data:image/svg+xml;utf8,<svg/>", mediaFit: { objectFit } };
      const { container } = render(
        <ImageElement
          node={node}
          parentId="section-1"
          parentLayoutMode="flow"
          parentFlowDisplay="block"
        />,
      );
      installDocumentStyles(node);
      const img = container.querySelector("img") as HTMLImageElement;
      expect(getComputedStyle(img).objectFit).toBe(objectFit);
    }
  });

  it("supports an out-of-range custom object position (Checkpoint 5.6 — CSS permits cropping/overflow on purpose)", () => {
    const node: EditorElementNode = {
      id: "image-1",
      tag: "img",
      src: "data:image/svg+xml;utf8,<svg/>",
      mediaFit: { objectPositionX: { value: -20, unit: "%" }, objectPositionY: { value: 120, unit: "%" } },
    };
    const { container } = render(
      <ImageElement
        node={node}
        parentId="section-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );
    installDocumentStyles(node);

    const img = container.querySelector("img") as HTMLImageElement;
    expect(getComputedStyle(img).objectPosition).toBe("-20% 120%");
  });

  it("keeps objectFit/objectPosition off the outer wrapper and aspectRatio off the inner <img> (Checkpoint 5.6 — outer/inner ownership separation)", () => {
    const node: EditorElementNode = {
      id: "image-1",
      tag: "img",
      src: "data:image/svg+xml;utf8,<svg/>",
      aspectRatio: { mode: "ratio", width: 1, height: 1 },
      mediaFit: { objectFit: "cover", objectPositionX: { value: 0, unit: "%" }, objectPositionY: { value: 0, unit: "%" } },
    };
    const { container } = render(
      <ImageElement
        node={node}
        parentId="section-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );
    installDocumentStyles(node);

    const img = container.querySelector("img") as HTMLImageElement;
    const wrapper = img.parentElement as HTMLElement;

    expect(getComputedStyle(wrapper).aspectRatio).toBe("1 / 1");
    expect(generatedStyleOf(wrapper).objectFit).toBe("");
    expect(generatedStyleOf(wrapper).objectPosition).toBe("");

    expect(getComputedStyle(img).objectFit).toBe("cover");
    expect(getComputedStyle(img).objectPosition).toBe("0% 0%");
    expect(generatedStyleOf(img).aspectRatio).toBe("");
  });

  it("keeps the fixed h-40 placeholder height by default, so an unresized image still has a real box", () => {
    const node: EditorElementNode = { id: "image-1", tag: "img" };
    const { container } = render(
      <ImageElement node={node} parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block" />,
    );
    installDocumentStyles(node);
    const wrapper = container.querySelector('[data-node-id="image-1"]') as HTMLElement;
    expect(getComputedStyle(wrapper).height).toBe("10rem");
  });

  it("drops the fixed h-40 placeholder height once an explicit ratio-mode aspect ratio is set, so the ratio can actually reshape the box (Checkpoint 5.6 fix — h-40 previously fixed height unconditionally, silently blocking Aspect Ratio's own visual effect on every unresized Image)", () => {
    const node: EditorElementNode = { id: "image-1", tag: "img", aspectRatio: { mode: "ratio", width: 1, height: 1 } };
    const { container } = render(
      <ImageElement
        node={node}
        parentId="section-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );
    installDocumentStyles(node);
    const wrapper = container.querySelector('[data-node-id="image-1"]') as HTMLElement;
    expect(generatedStyleOf(wrapper).height).toBe("");
    expect(getComputedStyle(wrapper).aspectRatio).toBe("1 / 1");
  });

  it("keeps the fixed h-40 placeholder height for an explicit Auto aspect ratio (mode: 'auto' has no visual effect to unblock)", () => {
    const node: EditorElementNode = { id: "image-1", tag: "img", aspectRatio: { mode: "auto" } };
    const { container } = render(
      <ImageElement
        node={node}
        parentId="section-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );
    installDocumentStyles(node);
    const wrapper = container.querySelector('[data-node-id="image-1"]') as HTMLElement;
    expect(getComputedStyle(wrapper).height).toBe("10rem");
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
    installDocumentStyles(node);
    const wrapperBefore = getComputedStyle((container.querySelector("img")!.parentElement as HTMLElement)).aspectRatio;

    const node1: EditorElementNode = { ...node, mediaFit: { objectFit: "cover" } };
    rerender(
      <ImageElement
        node={node1}
        parentId="section-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );
    installDocumentStyles(node1);
    const img = container.querySelector("img") as HTMLImageElement;
    const wrapper = img.parentElement as HTMLElement;
    expect(getComputedStyle(img).objectFit).toBe("cover");
    expect(getComputedStyle(wrapper).aspectRatio).toBe(wrapperBefore);
    expect(getComputedStyle(wrapper).aspectRatio).toBe("16 / 9");
  });

  it("stretches the outer wrapper to fill its Grid track regardless of the image's own aspect ratio", () => {
    const node: EditorElementNode = { id: "image-1", tag: "img", src: "data:image/svg+xml;utf8,<svg/>" };
    const { container } = render(
      <ImageElement
        node={node}
        parentId="section-1"
        parentLayoutMode="flow"
        parentFlowDisplay="grid"
      />,
    );
    installDocumentStyles(node, { parentFlowDisplay: "grid" });

    const wrapper = container.querySelector("img")!.parentElement as HTMLElement;
    expect(getComputedStyle(wrapper).width).toBe("100%");
    expect(getComputedStyle(wrapper).height).toBe("100%");
  });

  it("applies an explicit aspect ratio to the outer wrapper, not the inner <img> (Checkpoint 5.5)", () => {
    const node: EditorElementNode = { id: "image-1", tag: "img", src: "data:image/svg+xml;utf8,<svg/>", aspectRatio: { mode: "ratio", width: 16, height: 9 } };
    const { container } = render(
      <ImageElement
        node={node}
        parentId="section-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );
    installDocumentStyles(node);

    const img = container.querySelector("img") as HTMLImageElement;
    const wrapper = img.parentElement as HTMLElement;
    expect(getComputedStyle(wrapper).aspectRatio).toBe("16 / 9");
    // The inner <img> keeps filling its wrapper via resolveMediaFitStyle —
    // aspect-ratio shapes the *box* (the wrapper), object-fit/object-
    // position (Checkpoint 5.6) will govern the *content* inside it, kept
    // deliberately separate for that future checkpoint to build on.
    expect(generatedStyleOf(img).aspectRatio).toBe("");
    expect(getComputedStyle(img).width).toBe("100%");
    expect(getComputedStyle(img).height).toBe("100%");
  });

  it("preserves normal intrinsic image behavior with an explicit Auto aspect ratio", () => {
    const node: EditorElementNode = { id: "image-1", tag: "img", src: "data:image/svg+xml;utf8,<svg/>", aspectRatio: { mode: "auto" } };
    const { container } = render(
      <ImageElement
        node={node}
        parentId="section-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );
    installDocumentStyles(node);

    const img = container.querySelector("img") as HTMLImageElement;
    const wrapper = img.parentElement as HTMLElement;
    expect(getComputedStyle(wrapper).aspectRatio).toBe("auto");
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
    const node: EditorElementNode = { id: "image-1", tag: "img", src: "data:image/svg+xml;utf8,<svg/>", transition };
    const { container } = render(
      <ImageElement
        node={node}
        parentId="section-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );
    installDocumentStyles(node);

    const img = container.querySelector("img") as HTMLImageElement;
    const wrapper = img.parentElement as HTMLElement;
    expect(getComputedStyle(wrapper).transitionProperty).toBe("opacity");
    expect(generatedStyleOf(img).transitionProperty).toBe("");
  });
});

describe("ImageElement — CSS Transform Foundation (Checkpoint 1.15.6.14.3)", () => {
  const initialState = useEditorStore.getState();
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("places the authored Transform on the outer wrapper, never the inner <img>", () => {
    const node: EditorElementNode = { id: "image-1", tag: "img", src: "data:image/svg+xml;utf8,<svg/>", transform: { rotateDeg: 15 } };
    const { container } = render(
      <ImageElement
        node={node}
        parentId="section-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );
    installDocumentStyles(node);

    const img = container.querySelector("img") as HTMLImageElement;
    const wrapper = img.parentElement as HTMLElement;
    expect(getComputedStyle(wrapper).transform).toBe("rotate(15deg)");
    expect(generatedStyleOf(img).transform).toBe("");
  });
});
