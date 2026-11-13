import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RuntimeHiddenContext } from "@/features/canvas/components/document/previewRuntimeContext";
import { createVideoEmbedNode } from "@/features/editor/factories/elementFactories";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";
import { IframeElement } from "./IframeElement";

const initialState = useEditorStore.getState();
const YT = "dQw4w9WgXcQ";

function renderEmbed(node: EditorElementNode) {
  return render(<IframeElement node={node} parentId="page-root" parentLayoutMode="flow" parentFlowDisplay="block" />);
}

afterEach(() => {
  useEditorStore.setState(initialState, true);
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, "layoutryDesktop");
});

describe("IframeElement — Video Embed placeholder (BC-08.2)", () => {
  it("Design: no iframe and no provider resource at all, only the static placeholder", () => {
    const embed: EditorElementNode = { ...createVideoEmbedNode(), id: "iframe-v", src: `https://www.youtube-nocookie.com/embed/${YT}` };
    const { container } = renderEmbed(embed);
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("img, script, video, object, embed, link")).toBeNull();
    expect(container.innerHTML).not.toContain("youtube");
    const placeholder = screen.getByRole("img");
    expect(placeholder).toHaveAttribute("data-video-embed-placeholder", "ready");
    expect(placeholder).toHaveTextContent("YouTube video");
    expect(placeholder).toHaveTextContent("Plays in Preview. No video is loaded while you design");
  });

  it("shows a custom title, but never repeats the provider's default one", () => {
    const base = { ...createVideoEmbedNode(), id: "iframe-t", src: `https://www.youtube-nocookie.com/embed/${YT}` };
    const { unmount } = renderEmbed({ ...base, title: "Product tour" });
    expect(screen.getByRole("img")).toHaveAttribute("aria-label", "YouTube video. Product tour. Plays in Preview. No video is loaded while you design");
    unmount();
    renderEmbed({ ...base, title: "YouTube video" });
    expect(screen.getByRole("img")).toHaveAttribute("aria-label", "YouTube video. Plays in Preview. No video is loaded while you design");
    expect(screen.getAllByText("YouTube video")).toHaveLength(1);
  });

  it("an empty Video Embed says how to fill it", () => {
    renderEmbed({ ...createVideoEmbedNode(), id: "iframe-empty" });
    const placeholder = screen.getByRole("img");
    expect(placeholder).toHaveAttribute("data-video-embed-placeholder", "empty");
    expect(placeholder).toHaveTextContent("Video Embed");
    expect(placeholder).toHaveTextContent("Paste a video link in the Inspector");
  });

  it("lists only settings that will apply: Autoplay only with Muted, unsupported settings never", () => {
    const base = { ...createVideoEmbedNode(), id: "iframe-s" };
    const { unmount } = renderEmbed({ ...base, src: `https://www.youtube-nocookie.com/embed/${YT}?start=90`, autoplay: true, loop: true });
    expect(screen.getByRole("img")).toHaveTextContent("Loop · Starts at 1:30 · Privacy mode");
    expect(screen.getByRole("img")).not.toHaveTextContent("Autoplay");
    unmount();
    renderEmbed({ ...base, src: `https://www.loom.com/embed/${"a".repeat(32)}`, autoplay: true, muted: true, loop: true, controls: false });
    expect(screen.getByRole("img")).toHaveTextContent("Muted · Autoplay");
    expect(screen.getByRole("img")).not.toHaveTextContent("Loop");
    expect(screen.getByRole("img")).not.toHaveTextContent("No controls");
  });

  it("keeps the Embed's layout wrapper (selection/drag target) and its 16:9 aspect ratio", () => {
    const { container } = renderEmbed({ ...createVideoEmbedNode(), id: "iframe-w" });
    const wrapper = container.querySelector<HTMLElement>("[data-node-id='iframe-w']");
    expect(wrapper).not.toBeNull();
    expect(wrapper?.style.aspectRatio).toBe("16 / 9");
  });

  it("a generic Embed still renders its sandboxed iframe", () => {
    const { container } = renderEmbed({ id: "iframe-g", tag: "iframe", src: "https://example.com/embed", title: "Map" });
    expect(container.querySelector("iframe")).toHaveAttribute("sandbox", "allow-forms allow-popups allow-scripts allow-same-origin");
    expect(container.querySelector("[data-video-embed-placeholder]")).toBeNull();
  });
});

describe("VideoEmbedFrame — Preview player (BC-08.3)", () => {
  const embed: EditorElementNode = { ...createVideoEmbedNode(), id: "iframe-p", src: `https://www.youtube-nocookie.com/embed/${YT}`, title: "Product tour" };

  function preview() {
    useEditorStore.setState({ editorMode: "preview" });
  }

  it("Preview mounts the real provider player with the shared configuration", () => {
    preview();
    const { container } = renderEmbed({ ...embed, muted: true, autoplay: true });
    const iframe = container.querySelector("iframe");
    expect(iframe).not.toBeNull();
    expect(iframe).toHaveAttribute("data-video-embed-player", "youtube");
    expect(iframe).toHaveAttribute("src", `https://www.youtube-nocookie.com/embed/${YT}?autoplay=1&mute=1`);
    expect(iframe).toHaveAttribute("sandbox", "allow-forms allow-popups allow-scripts allow-same-origin");
    expect(iframe).toHaveAttribute("allow", "fullscreen");
    expect(iframe).toHaveAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    expect(iframe).toHaveAttribute("loading", "lazy");
    expect(iframe).toHaveAttribute("title", "Product tour");
    expect(iframe?.hasAttribute("allowfullscreen")).toBe(false);
    expect(container.querySelector("[data-video-embed-placeholder]")).toBeNull();
  });

  it("unmuted autoplay is never requested, and nothing is muted for the user", () => {
    preview();
    const { container } = renderEmbed({ ...embed, autoplay: true, muted: false });
    expect(container.querySelector("iframe")).toHaveAttribute("src", `https://www.youtube-nocookie.com/embed/${YT}`);
  });

  it("leaving Preview unmounts the player (the placeholder returns)", () => {
    preview();
    const { container, rerender } = renderEmbed(embed);
    expect(container.querySelector("iframe")).not.toBeNull();
    useEditorStore.setState({ editorMode: "design" });
    rerender(<IframeElement node={embed} parentId="page-root" parentLayoutMode="flow" parentFlowDisplay="block" />);
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("[data-video-embed-placeholder]")).not.toBeNull();
  });

  it("hidden by an interaction (itself or an ancestor): no player; shown again: a fresh one", () => {
    preview();
    const tree = (hidden: boolean) => (
      <RuntimeHiddenContext.Provider value={hidden}>
        <IframeElement node={embed} parentId="page-root" parentLayoutMode="flow" parentFlowDisplay="block" />
      </RuntimeHiddenContext.Provider>
    );
    const { container, rerender } = render(tree(false));
    const first = container.querySelector("iframe");
    expect(first).not.toBeNull();
    rerender(tree(true));
    expect(container.querySelector("iframe")).toBeNull();
    rerender(tree(false));
    const second = container.querySelector("iframe");
    expect(second).not.toBeNull();
    expect(second).not.toBe(first);
  });

  it("authored Display none on an ancestor: no player", () => {
    useEditorStore.getState().insertElement("page-root", { id: "box", tag: "div", display: { display: "none" }, children: [embed] });
    preview();
    const { container } = renderEmbed(embed);
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("reduced motion: the player loads without autoplay", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce"), addEventListener: () => {}, removeEventListener: () => {} }));
    preview();
    const { container } = renderEmbed({ ...embed, autoplay: true, muted: true });
    expect(container.querySelector("iframe")).toHaveAttribute("src", `https://www.youtube-nocookie.com/embed/${YT}?mute=1`);
  });

  it("desktop app: no fullscreen delegation (BC-08.4), everything else identical", () => {
    Reflect.set(window, "layoutryDesktop", {});
    preview();
    const { container } = renderEmbed(embed);
    const iframe = container.querySelector("iframe");
    expect(iframe?.hasAttribute("allow")).toBe(false);
    expect(iframe).toHaveAttribute("sandbox", "allow-forms allow-popups allow-scripts allow-same-origin");
  });

  it("an invalid stored source never becomes an iframe, even in Preview", () => {
    preview();
    for (const src of ["https://evil.example/embed/x", "javascript:alert(1)", `https://youtube.com.evil.example/embed/${YT}`]) {
      const { container, unmount } = renderEmbed({ ...embed, src });
      expect(container.querySelector("iframe"), src).toBeNull();
      unmount();
    }
  });

  it("Preview writes nothing: the document and history are untouched", () => {
    const before = { document: useEditorStore.getState().document, past: useEditorStore.getState().past };
    preview();
    renderEmbed({ ...embed, muted: true, autoplay: true });
    expect(useEditorStore.getState().document).toBe(before.document);
    expect(useEditorStore.getState().past).toBe(before.past);
  });

  it("a generic Embed keeps its own iframe with no allow / referrer / loading attributes", () => {
    preview();
    const { container } = renderEmbed({ id: "iframe-g2", tag: "iframe", src: `https://www.youtube.com/embed/${YT}`, title: "Old embed" });
    const iframe = container.querySelector("iframe");
    expect(iframe).toHaveAttribute("src", `https://www.youtube.com/embed/${YT}`);
    for (const name of ["allow", "allowfullscreen", "referrerpolicy", "loading", "data-video-embed-player"]) expect(iframe?.hasAttribute(name), name).toBe(false);
  });
});
