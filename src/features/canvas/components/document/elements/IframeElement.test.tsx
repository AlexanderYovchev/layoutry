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

  it("Checkpoint 1.15.6.12.3 — the MediaInteractionShield is present in Design (unchanged) but absent in Preview (the fix), so the embedded document becomes reachable", () => {
    const { rerender } = render(
      <IframeElement node={{ id: "iframe-1", tag: "iframe" }} parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block" />,
    );
    expect(document.querySelector("[aria-hidden='true']")).not.toBeNull();

    useEditorStore.setState({ editorMode: "preview" });
    rerender(<IframeElement node={{ id: "iframe-1", tag: "iframe" }} parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block" />);
    expect(document.querySelector("[aria-hidden='true']")).toBeNull();
    expect(document.querySelector("iframe")).not.toBeNull();
  });
});

describe("IframeElement embed safety (BC-02.3)", () => {
  const props = { parentId: "page-1", parentLayoutMode: "flow", parentFlowDisplay: "block" } as const;

  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("always renders an explicit sandbox, with allow-same-origin only for another origin", () => {
    const { rerender } = render(<IframeElement node={{ id: "iframe-1", tag: "iframe", src: "https://example.com/embed" }} {...props} />);
    expect(document.querySelector("iframe")).toHaveAttribute("sandbox", "allow-forms allow-popups allow-scripts allow-same-origin");
    rerender(<IframeElement node={{ id: "iframe-1", tag: "iframe", src: "/same-origin.html" }} {...props} />);
    expect(document.querySelector("iframe")).toHaveAttribute("sandbox", "allow-forms allow-popups allow-scripts");
    rerender(<IframeElement node={{ id: "iframe-1", tag: "iframe" }} {...props} />);
    expect(document.querySelector("iframe")).toHaveAttribute("sandbox", "allow-forms allow-popups allow-scripts");
  });

  it("does not load a data:, blob:, file: or about: source, but keeps the element and its title", () => {
    for (const src of ["data:text/html,<script>top.location='x'</script>", "blob:http://localhost:3000/1", "file:///C:/x", "about:blank"]) {
      const { unmount } = render(<IframeElement node={{ id: "iframe-1", tag: "iframe", src, title: "Embedded content" }} {...props} />);
      const iframe = document.querySelector("iframe");
      expect(iframe, src).not.toBeNull();
      expect(iframe, src).not.toHaveAttribute("src");
      expect(iframe, src).toHaveAttribute("title", "Embedded content");
      unmount();
    }
  });

  it("never copies other attributes from the node, even ones smuggled into the in-memory document", () => {
    const node = Object.assign({ id: "iframe-1", tag: "iframe", src: "https://example.com/embed" }, {
      sandbox: "allow-top-navigation allow-same-origin allow-scripts",
      srcdoc: "<script>top.location='https://evil.test'</script>",
      allow: "camera; microphone",
      referrerpolicy: "unsafe-url",
    });
    render(<IframeElement node={node} {...props} />);
    const iframe = document.querySelector("iframe");
    expect(iframe).toHaveAttribute("sandbox", "allow-forms allow-popups allow-scripts allow-same-origin");
    expect(iframe).not.toHaveAttribute("srcdoc");
    expect(iframe).not.toHaveAttribute("allow");
    expect(iframe).not.toHaveAttribute("referrerpolicy");
  });

  it("keeps the same iframe across a source change within the same policy, and replaces it when the sandbox changes", () => {
    const { rerender } = render(<IframeElement node={{ id: "iframe-1", tag: "iframe", src: "https://a.example/1" }} {...props} />);
    const first = document.querySelector("iframe");
    rerender(<IframeElement node={{ id: "iframe-1", tag: "iframe", src: "https://b.example/2" }} {...props} />);
    expect(document.querySelector("iframe")).toBe(first);
    rerender(<IframeElement node={{ id: "iframe-1", tag: "iframe", src: "/same-origin.html" }} {...props} />);
    expect(document.querySelector("iframe")).not.toBe(first);
  });

  it("keeps the same iframe across Design and Preview", () => {
    const { rerender } = render(<IframeElement node={{ id: "iframe-1", tag: "iframe", src: "https://a.example/1" }} {...props} />);
    const first = document.querySelector("iframe");
    useEditorStore.setState({ editorMode: "preview" });
    rerender(<IframeElement node={{ id: "iframe-1", tag: "iframe", src: "https://a.example/1" }} {...props} />);
    expect(document.querySelector("iframe")).toBe(first);
  });
});
