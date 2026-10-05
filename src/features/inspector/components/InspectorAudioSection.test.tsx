import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InspectorAudioSection } from "./InspectorAudioSection";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";

const initialState = useEditorStore.getState();

const baseNode: EditorElementNode = { id: "audio-1", tag: "audio" };

describe("InspectorAudioSection (Checkpoint 1.15.6.12.3)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useEditorStore.setState(initialState, true);
  });

  it("shows Controls as on by default (getMediaControls's own effective-value fallback)", () => {
    render(<InspectorAudioSection node={baseNode} />);
    expect(screen.getByRole("switch", { name: "Controls" })).toHaveAttribute("aria-checked", "true");
  });

  it("shows Autoplay/Muted/Loop as off by default", () => {
    render(<InspectorAudioSection node={baseNode} />);
    expect(screen.getByRole("switch", { name: "Autoplay" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("switch", { name: "Muted" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("switch", { name: "Loop" })).toHaveAttribute("aria-checked", "false");
  });

  it("never renders a Poster field — Audio has no poster-equivalent concept", () => {
    render(<InspectorAudioSection node={baseNode} />);
    expect(screen.queryByLabelText("Poster URL")).not.toBeInTheDocument();
  });

  it("committing a valid Source URL calls setElementSrc", () => {
    const spy = vi.spyOn(useEditorStore.getState(), "setElementSrc");
    render(<InspectorAudioSection node={baseNode} />);

    const input = screen.getByLabelText("Source URL");
    fireEvent.change(input, { target: { value: "https://example.com/audio.mp3" } });
    fireEvent.blur(input);

    expect(spy).toHaveBeenCalledWith("audio-1", "https://example.com/audio.mp3");
  });

  it("rejects a javascript: Source URL and shows an error instead of committing", () => {
    const spy = vi.spyOn(useEditorStore.getState(), "setElementSrc");
    render(<InspectorAudioSection node={baseNode} />);

    const input = screen.getByLabelText("Source URL");
    fireEvent.change(input, { target: { value: "javascript:alert(1)" } });
    fireEvent.blur(input);

    expect(spy).not.toHaveBeenCalled();
    expect(screen.getByText("Enter a valid audio URL.")).toBeInTheDocument();
  });

  it("clicking Controls calls setElementControls with the opposite of its current effective state", () => {
    const spy = vi.spyOn(useEditorStore.getState(), "setElementControls");
    render(<InspectorAudioSection node={baseNode} />);

    fireEvent.click(screen.getByRole("switch", { name: "Controls" }));

    expect(spy).toHaveBeenCalledWith("audio-1", false);
  });

  it("clicking Autoplay calls setElementAutoplay and never touches Muted", () => {
    const autoplaySpy = vi.spyOn(useEditorStore.getState(), "setElementAutoplay");
    const mutedSpy = vi.spyOn(useEditorStore.getState(), "setElementMuted");
    render(<InspectorAudioSection node={baseNode} />);

    fireEvent.click(screen.getByRole("switch", { name: "Autoplay" }));

    expect(autoplaySpy).toHaveBeenCalledWith("audio-1", true);
    expect(mutedSpy).not.toHaveBeenCalled();
  });

  it("clicking Muted calls setElementMuted", () => {
    const spy = vi.spyOn(useEditorStore.getState(), "setElementMuted");
    render(<InspectorAudioSection node={baseNode} />);

    fireEvent.click(screen.getByRole("switch", { name: "Muted" }));

    expect(spy).toHaveBeenCalledWith("audio-1", true);
  });

  it("clicking Loop calls setElementLoop", () => {
    const spy = vi.spyOn(useEditorStore.getState(), "setElementLoop");
    render(<InspectorAudioSection node={baseNode} />);

    fireEvent.click(screen.getByRole("switch", { name: "Loop" }));

    expect(spy).toHaveBeenCalledWith("audio-1", true);
  });
});
