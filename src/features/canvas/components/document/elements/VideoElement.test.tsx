import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { VideoElement } from "./VideoElement";

const initialState = useEditorStore.getState();

describe("VideoElement (Checkpoint 1.15)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useEditorStore.setState(initialState, true);
  });

  it("renders a genuine <video>, not a div/placeholder standing in for one", () => {
    render(<VideoElement node={{ id: "video-1", tag: "video" }} parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block" />);
    const video = document.querySelector("video");
    expect(video).not.toBeNull();
    expect(video?.tagName).toBe("VIDEO");
  });

  it("renders even with no src at all — the real element is never swapped for a fake placeholder", () => {
    render(<VideoElement node={{ id: "video-1", tag: "video" }} parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block" />);
    expect(document.querySelector("video")).not.toBeNull();
  });

  it("maps src/poster to real native attributes", () => {
    render(
      <VideoElement
        node={{ id: "video-1", tag: "video", src: "https://example.com/video.mp4", poster: "https://example.com/poster.jpg" }}
        parentId="page-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );
    const video = document.querySelector("video");
    expect(video).toHaveAttribute("src", "https://example.com/video.mp4");
    expect(video).toHaveAttribute("poster", "https://example.com/poster.jpg");
  });

  it("defaults controls to true (visually present) when unset", () => {
    render(<VideoElement node={{ id: "video-1", tag: "video" }} parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block" />);
    expect((document.querySelector("video") as HTMLVideoElement).controls).toBe(true);
  });

  it("respects an explicit controls: false", () => {
    render(<VideoElement node={{ id: "video-1", tag: "video", controls: false }} parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block" />);
    expect((document.querySelector("video") as HTMLVideoElement).controls).toBe(false);
  });

  it("maps autoplay/muted/loop to real native boolean properties", () => {
    render(
      <VideoElement
        node={{ id: "video-1", tag: "video", autoplay: true, muted: true, loop: true }}
        parentId="page-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );
    const video = document.querySelector("video") as HTMLVideoElement;
    expect(video.autoplay).toBe(true);
    expect(video.muted).toBe(true);
    expect(video.loop).toBe(true);
  });

  it("leaves autoplay/muted/loop off by default", () => {
    render(<VideoElement node={{ id: "video-1", tag: "video" }} parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block" />);
    const video = document.querySelector("video") as HTMLVideoElement;
    expect(video.autoplay).toBe(false);
    expect(video.muted).toBe(false);
    expect(video.loop).toBe(false);
  });

  it("stamps the node's own id/tag as data attributes on the OUTER wrapper, not the inner <video>", () => {
    render(<VideoElement node={{ id: "video-1", tag: "video" }} parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block" />);
    const wrapper = document.querySelector("[data-node-id='video-1']");
    expect(wrapper).not.toBeNull();
    expect(wrapper?.tagName).not.toBe("VIDEO");
    expect(document.querySelector("video")).not.toHaveAttribute("data-node-id");
  });

  it("renders a MediaInteractionShield sibling after the <video>", () => {
    render(<VideoElement node={{ id: "video-1", tag: "video" }} parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block" />);
    const wrapper = document.querySelector("[data-node-id='video-1']") as HTMLElement;
    const children = Array.from(wrapper.children);
    const videoIndex = children.findIndex((el) => el.tagName === "VIDEO");
    const shieldIndex = children.findIndex((el) => el.getAttribute("aria-hidden") === "true");
    expect(videoIndex).toBeGreaterThanOrEqual(0);
    expect(shieldIndex).toBeGreaterThan(videoIndex);
  });

  it("applies authored HTML id/class to the real inner <video>, not the editor wrapper div (Checkpoint 1.15.1)", () => {
    render(
      <VideoElement
        node={{ id: "video-1", tag: "video", htmlId: "hero-video", className: "my-custom-class" }}
        parentId="page-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );
    const video = document.querySelector("video") as HTMLVideoElement;
    const wrapper = document.querySelector("[data-node-id='video-1']") as HTMLElement;
    expect(video).toHaveAttribute("id", "hero-video");
    expect(video.className).toContain("my-custom-class");
    expect(wrapper).not.toHaveAttribute("id");
    expect(wrapper.className).not.toContain("my-custom-class");
  });
});
