import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
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
});

describe("IframeElement — Video Embed placeholder (BC-08.2)", () => {
  it.each(["design", "preview"] as const)("%s: no iframe and no provider resource at all, only the static placeholder", (mode) => {
    useEditorStore.setState({ editorMode: mode });
    const embed: EditorElementNode = { ...createVideoEmbedNode(), id: "iframe-v", src: `https://www.youtube-nocookie.com/embed/${YT}` };
    const { container } = renderEmbed(embed);
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("img, script, video, object, embed, link")).toBeNull();
    expect(container.innerHTML).not.toContain("youtube");
    const placeholder = screen.getByRole("img");
    expect(placeholder).toHaveAttribute("data-video-embed-placeholder", "ready");
    expect(placeholder).toHaveTextContent("YouTube video");
    expect(placeholder).toHaveTextContent(mode === "preview" ? "The player isn't available in Preview yet" : "No video is loaded while you design");
  });

  it("shows a custom title, but never repeats the provider's default one", () => {
    const base = { ...createVideoEmbedNode(), id: "iframe-t", src: `https://www.youtube-nocookie.com/embed/${YT}` };
    const { unmount } = renderEmbed({ ...base, title: "Product tour" });
    expect(screen.getByRole("img")).toHaveAttribute("aria-label", "YouTube video. Product tour. No video is loaded while you design");
    unmount();
    renderEmbed({ ...base, title: "YouTube video" });
    expect(screen.getByRole("img")).toHaveAttribute("aria-label", "YouTube video. No video is loaded while you design");
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
