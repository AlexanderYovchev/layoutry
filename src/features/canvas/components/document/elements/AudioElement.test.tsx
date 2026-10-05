import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { AudioElement } from "./AudioElement";

const initialState = useEditorStore.getState();

describe("AudioElement (Checkpoint 1.15.6.12.3)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useEditorStore.setState(initialState, true);
  });

  it("renders a genuine <audio>, not a div/placeholder standing in for one", () => {
    render(<AudioElement node={{ id: "audio-1", tag: "audio" }} parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block" />);
    const audio = document.querySelector("audio");
    expect(audio).not.toBeNull();
    expect(audio?.tagName).toBe("AUDIO");
  });

  it("renders even with no src at all — the real element is never swapped for a fake placeholder", () => {
    render(<AudioElement node={{ id: "audio-1", tag: "audio" }} parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block" />);
    expect(document.querySelector("audio")).not.toBeNull();
  });

  it("maps src to a real native attribute", () => {
    render(
      <AudioElement
        node={{ id: "audio-1", tag: "audio", src: "https://example.com/audio.mp3" }}
        parentId="page-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );
    const audio = document.querySelector("audio");
    expect(audio).toHaveAttribute("src", "https://example.com/audio.mp3");
  });

  it("defaults controls to true (visually present) when unset", () => {
    render(<AudioElement node={{ id: "audio-1", tag: "audio" }} parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block" />);
    expect((document.querySelector("audio") as HTMLAudioElement).controls).toBe(true);
  });

  it("respects an explicit controls: false", () => {
    render(<AudioElement node={{ id: "audio-1", tag: "audio", controls: false }} parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block" />);
    expect((document.querySelector("audio") as HTMLAudioElement).controls).toBe(false);
  });

  it("maps muted/loop to real native boolean properties regardless of mode", () => {
    render(
      <AudioElement
        node={{ id: "audio-1", tag: "audio", muted: true, loop: true }}
        parentId="page-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );
    const audio = document.querySelector("audio") as HTMLAudioElement;
    expect(audio.muted).toBe(true);
    expect(audio.loop).toBe(true);
  });

  it("leaves autoplay/muted/loop off by default", () => {
    render(<AudioElement node={{ id: "audio-1", tag: "audio" }} parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block" />);
    const audio = document.querySelector("audio") as HTMLAudioElement;
    expect(audio.autoplay).toBe(false);
    expect(audio.muted).toBe(false);
    expect(audio.loop).toBe(false);
  });

  it("an authored autoplay: true never actually autoplays in Design mode, even though the field itself is preserved", () => {
    render(
      <AudioElement node={{ id: "audio-1", tag: "audio", autoplay: true }} parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block" />,
    );
    const audio = document.querySelector("audio") as HTMLAudioElement;
    expect(audio.autoplay).toBe(false);
  });

  it("an authored autoplay: true DOES render as native autoplay once in Preview mode", () => {
    useEditorStore.setState({ editorMode: "preview" });
    render(
      <AudioElement node={{ id: "audio-1", tag: "audio", autoplay: true }} parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block" />,
    );
    const audio = document.querySelector("audio") as HTMLAudioElement;
    expect(audio.autoplay).toBe(true);
  });

  it("stamps the node's own id/tag as data attributes on the OUTER wrapper, not the inner <audio>", () => {
    render(<AudioElement node={{ id: "audio-1", tag: "audio" }} parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block" />);
    const wrapper = document.querySelector("[data-node-id='audio-1']");
    expect(wrapper).not.toBeNull();
    expect(wrapper?.tagName).not.toBe("AUDIO");
    expect(document.querySelector("audio")).not.toHaveAttribute("data-node-id");
  });

  it("renders a MediaInteractionShield in Design, which disappears in Preview so native controls become reachable", () => {
    const { rerender } = render(
      <AudioElement node={{ id: "audio-1", tag: "audio" }} parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block" />,
    );
    const wrapper = document.querySelector("[data-node-id='audio-1']") as HTMLElement;
    const audioIndex = Array.from(wrapper.children).findIndex((el) => el.tagName === "AUDIO");
    const shieldIndex = Array.from(wrapper.children).findIndex((el) => el.getAttribute("aria-hidden") === "true");
    expect(audioIndex).toBeGreaterThanOrEqual(0);
    expect(shieldIndex).toBeGreaterThan(audioIndex);

    useEditorStore.setState({ editorMode: "preview" });
    rerender(<AudioElement node={{ id: "audio-1", tag: "audio" }} parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block" />);
    expect(document.querySelector("[aria-hidden='true']")).toBeNull();
    expect(document.querySelector("audio")).not.toBeNull();
  });

  it("applies authored HTML id/class to the real inner <audio>, not the editor wrapper div", () => {
    render(
      <AudioElement
        node={{ id: "audio-1", tag: "audio", htmlId: "podcast-player", className: "my-custom-class" }}
        parentId="page-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );
    const audio = document.querySelector("audio") as HTMLAudioElement;
    const wrapper = document.querySelector("[data-node-id='audio-1']") as HTMLElement;
    expect(audio).toHaveAttribute("id", "podcast-player");
    expect(audio.className).toContain("my-custom-class");
    expect(wrapper).not.toHaveAttribute("id");
    expect(wrapper.className).not.toContain("my-custom-class");
  });

  it("never renders <source>/<track> children or any custom player markup", () => {
    render(
      <AudioElement
        node={{ id: "audio-1", tag: "audio", src: "https://example.com/audio.mp3" }}
        parentId="page-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );
    expect(document.querySelector("source")).toBeNull();
    expect(document.querySelector("track")).toBeNull();
    expect((document.querySelector("audio") as HTMLAudioElement).children.length).toBe(0);
  });

  it("applies a CSS background to the wrapper — unlike Video/Image, Audio's native control bar does not always fill its box", () => {
    render(
      <AudioElement
        node={{ id: "audio-1", tag: "audio", background: { color: "#ff0000" } }}
        parentId="page-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );
    const wrapper = document.querySelector("[data-node-id='audio-1']") as HTMLElement;
    expect(wrapper.getAttribute("style")).toMatch(/background-color/);
  });
});
