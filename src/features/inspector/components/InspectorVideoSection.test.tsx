import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InspectorVideoSection } from "./InspectorVideoSection";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";

const initialState = useEditorStore.getState();

const baseNode: EditorElementNode = { id: "video-1", tag: "video" };

describe("InspectorVideoSection (Checkpoint 1.15)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useEditorStore.setState(initialState, true);
  });

  it("shows Controls as on by default (getVideoControls's own effective-value fallback)", () => {
    render(<InspectorVideoSection node={baseNode} />);
    expect(screen.getByRole("switch", { name: "Controls" })).toHaveAttribute("aria-checked", "true");
  });

  it("shows Autoplay/Muted/Loop as off by default", () => {
    render(<InspectorVideoSection node={baseNode} />);
    expect(screen.getByRole("switch", { name: "Autoplay" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("switch", { name: "Muted" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("switch", { name: "Loop" })).toHaveAttribute("aria-checked", "false");
  });

  it("shows the autoplay browser-behavior hint", () => {
    render(<InspectorVideoSection node={baseNode} />);
    expect(screen.getByText(/only allow autoplay when the video is muted/i)).toBeInTheDocument();
  });

  it("committing a valid Source URL calls setElementSrc", () => {
    const spy = vi.spyOn(useEditorStore.getState(), "setElementSrc");
    render(<InspectorVideoSection node={baseNode} />);

    const input = screen.getByLabelText("Source URL");
    fireEvent.change(input, { target: { value: "https://example.com/video.mp4" } });
    fireEvent.blur(input);

    expect(spy).toHaveBeenCalledWith("video-1", "https://example.com/video.mp4");
  });

  it("rejects a javascript: Source URL and shows an error instead of committing", () => {
    const spy = vi.spyOn(useEditorStore.getState(), "setElementSrc");
    render(<InspectorVideoSection node={baseNode} />);

    const input = screen.getByLabelText("Source URL");
    fireEvent.change(input, { target: { value: "javascript:alert(1)" } });
    fireEvent.blur(input);

    expect(spy).not.toHaveBeenCalled();
    expect(screen.getByText("Enter a valid video URL.")).toBeInTheDocument();
  });

  it("committing a valid Poster URL calls setElementPoster", () => {
    const spy = vi.spyOn(useEditorStore.getState(), "setElementPoster");
    render(<InspectorVideoSection node={baseNode} />);

    const input = screen.getByLabelText("Poster URL");
    fireEvent.change(input, { target: { value: "https://example.com/poster.jpg" } });
    fireEvent.blur(input);

    expect(spy).toHaveBeenCalledWith("video-1", "https://example.com/poster.jpg");
  });

  it("clicking Controls calls setElementControls with the opposite of its current effective state", () => {
    const spy = vi.spyOn(useEditorStore.getState(), "setElementControls");
    render(<InspectorVideoSection node={baseNode} />);

    fireEvent.click(screen.getByRole("switch", { name: "Controls" }));

    expect(spy).toHaveBeenCalledWith("video-1", false);
  });

  it("clicking Autoplay calls setElementAutoplay and never touches Muted", () => {
    const autoplaySpy = vi.spyOn(useEditorStore.getState(), "setElementAutoplay");
    const mutedSpy = vi.spyOn(useEditorStore.getState(), "setElementMuted");
    render(<InspectorVideoSection node={baseNode} />);

    fireEvent.click(screen.getByRole("switch", { name: "Autoplay" }));

    expect(autoplaySpy).toHaveBeenCalledWith("video-1", true);
    expect(mutedSpy).not.toHaveBeenCalled();
  });

  it("clicking Muted calls setElementMuted", () => {
    const spy = vi.spyOn(useEditorStore.getState(), "setElementMuted");
    render(<InspectorVideoSection node={baseNode} />);

    fireEvent.click(screen.getByRole("switch", { name: "Muted" }));

    expect(spy).toHaveBeenCalledWith("video-1", true);
  });

  it("clicking Loop calls setElementLoop", () => {
    const spy = vi.spyOn(useEditorStore.getState(), "setElementLoop");
    render(<InspectorVideoSection node={baseNode} />);

    fireEvent.click(screen.getByRole("switch", { name: "Loop" }));

    expect(spy).toHaveBeenCalledWith("video-1", true);
  });
});
