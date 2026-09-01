import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { IframeElement } from "./IframeElement";

const initialState = useEditorStore.getState();

describe("IframeElement (Checkpoint 1.15)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useEditorStore.setState(initialState, true);
  });

  it("renders a genuine <iframe>, not a div/placeholder standing in for one", () => {
    render(<IframeElement node={{ id: "iframe-1", tag: "iframe", title: "Embedded content" }} parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block" />);
    const iframe = document.querySelector("iframe");
    expect(iframe).not.toBeNull();
    expect(iframe?.tagName).toBe("IFRAME");
  });

  it("renders even with no src at all", () => {
    render(<IframeElement node={{ id: "iframe-1", tag: "iframe" }} parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block" />);
    expect(document.querySelector("iframe")).not.toBeNull();
  });

  it("maps src/title to real native attributes", () => {
    render(
      <IframeElement
        node={{ id: "iframe-1", tag: "iframe", src: "https://example.com/embed", title: "Product tour" }}
        parentId="page-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );
    const iframe = document.querySelector("iframe");
    expect(iframe).toHaveAttribute("src", "https://example.com/embed");
    expect(iframe).toHaveAttribute("title", "Product tour");
  });

  it("stamps the node's own id/tag as data attributes on the OUTER wrapper, not the inner <iframe>", () => {
    render(<IframeElement node={{ id: "iframe-1", tag: "iframe" }} parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block" />);
    const wrapper = document.querySelector("[data-node-id='iframe-1']");
    expect(wrapper).not.toBeNull();
    expect(wrapper?.tagName).not.toBe("IFRAME");
    expect(document.querySelector("iframe")).not.toHaveAttribute("data-node-id");
  });

  it("renders a MediaInteractionShield sibling after the <iframe>", () => {
    render(<IframeElement node={{ id: "iframe-1", tag: "iframe" }} parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block" />);
    const wrapper = document.querySelector("[data-node-id='iframe-1']") as HTMLElement;
    const children = Array.from(wrapper.children);
    const iframeIndex = children.findIndex((el) => el.tagName === "IFRAME");
    const shieldIndex = children.findIndex((el) => el.getAttribute("aria-hidden") === "true");
    expect(iframeIndex).toBeGreaterThanOrEqual(0);
    expect(shieldIndex).toBeGreaterThan(iframeIndex);
  });

  it("neutralizes the iframe tag's own default border via inline style, since the outer wrapper owns the visible border", () => {
    render(<IframeElement node={{ id: "iframe-1", tag: "iframe" }} parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block" />);
    const iframe = document.querySelector("iframe") as HTMLIFrameElement;
    expect(iframe.getAttribute("style")).toMatch(/border:\s*0/);
  });

  it("applies authored HTML id/class to the real inner <iframe>, not the editor wrapper div (Checkpoint 1.15.1)", () => {
    render(
      <IframeElement
        node={{ id: "iframe-1", tag: "iframe", htmlId: "hero-embed", className: "my-custom-class" }}
        parentId="page-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );
    const iframe = document.querySelector("iframe") as HTMLIFrameElement;
    const wrapper = document.querySelector("[data-node-id='iframe-1']") as HTMLElement;
    expect(iframe).toHaveAttribute("id", "hero-embed");
    expect(iframe.className).toContain("my-custom-class");
    expect(wrapper).not.toHaveAttribute("id");
    expect(wrapper.className).not.toContain("my-custom-class");
  });
});
