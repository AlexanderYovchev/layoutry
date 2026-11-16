import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RuntimeHiddenContext } from "@/features/canvas/components/document/previewRuntimeContext";
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

  it("BC-08.3.1 (approved): entering and leaving Preview each give a fresh iframe — nothing from Preview keeps running in Design", () => {
    const node = { id: "iframe-1", tag: "iframe", src: "https://a.example/1" };
    const { rerender } = render(<IframeElement node={node} {...props} />);
    const design = document.querySelector("iframe");
    useEditorStore.setState({ editorMode: "preview" });
    rerender(<IframeElement node={node} {...props} />);
    const preview = document.querySelector("iframe");
    expect(preview).not.toBeNull();
    expect(preview).not.toBe(design);
    useEditorStore.setState({ editorMode: "design" });
    rerender(<IframeElement node={node} {...props} />);
    const back = document.querySelector("iframe");
    expect(back).not.toBe(preview);
    expect(document.querySelectorAll("iframe")).toHaveLength(1);
    // Same source, sandbox and attributes throughout.
    expect(back).toHaveAttribute("src", "https://a.example/1");
    expect(back).toHaveAttribute("sandbox", "allow-forms allow-popups allow-scripts allow-same-origin");
  });
});

describe("generic Embed Preview lifecycle (BC-08.3.1)", () => {
  const props = { parentId: "page-root", parentLayoutMode: "flow", parentFlowDisplay: "block" } as const;
  const node = { id: "generic-1", tag: "iframe", src: "https://maps.example/embed", title: "Map" };

  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  const tree = (hidden: boolean) => (
    <RuntimeHiddenContext.Provider value={hidden}>
      <IframeElement node={node} {...props} />
    </RuntimeHiddenContext.Provider>
  );

  it("hidden by an interaction on itself or an ancestor: the iframe is removed (the element stays); shown again: a fresh one", () => {
    useEditorStore.setState({ editorMode: "preview" });
    const { container, rerender } = render(tree(false));
    const first = container.querySelector("iframe");
    expect(first).not.toBeNull();
    rerender(tree(true));
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("[data-node-id='generic-1']")).not.toBeNull();
    rerender(tree(false));
    const second = container.querySelector("iframe");
    expect(second).not.toBeNull();
    expect(second).not.toBe(first);
    expect(second).toHaveAttribute("src", "https://maps.example/embed");
  });

  it("authored Display none on an ancestor: no iframe in Preview (Design keeps the live embed, as before)", () => {
    useEditorStore.getState().insertElement("page-root", { id: "box", tag: "div", display: { display: "none" }, children: [node] });
    const { container, rerender } = render(<IframeElement node={node} {...props} />);
    expect(container.querySelector("iframe")).not.toBeNull();
    useEditorStore.setState({ editorMode: "preview" });
    rerender(<IframeElement node={node} {...props} />);
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("Design is unaffected by runtime hiding (it only exists in Preview)", () => {
    const { container } = render(tree(true));
    expect(container.querySelector("iframe")).not.toBeNull();
  });

  it("writes nothing: same document, same history", () => {
    const before = { document: useEditorStore.getState().document, past: useEditorStore.getState().past };
    useEditorStore.setState({ editorMode: "preview" });
    const { rerender } = render(tree(false));
    rerender(tree(true));
    rerender(tree(false));
    expect(useEditorStore.getState().document).toBe(before.document);
    expect(useEditorStore.getState().past).toBe(before.past);
  });

  it("a generic Embed with a Vimeo URL never gets a permission", () => {
    useEditorStore.setState({ editorMode: "preview" });
    const { container } = render(<IframeElement node={{ ...node, src: "https://player.vimeo.com/video/76979871" }} {...props} />);
    expect(container.querySelector("iframe")?.hasAttribute("allow")).toBe(false);
  });
});
