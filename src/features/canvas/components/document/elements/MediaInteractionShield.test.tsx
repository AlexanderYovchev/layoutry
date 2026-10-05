import { fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MediaInteractionShield } from "./MediaInteractionShield";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";

const initialState = useEditorStore.getState();

describe("MediaInteractionShield (Checkpoint 1.15)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useEditorStore.setState(initialState, true);
  });

  it("is purely decorative — aria-hidden, no document-model side effects", () => {
    render(<MediaInteractionShield />);
    const shield = document.querySelector("[aria-hidden='true']");
    expect(shield).not.toBeNull();
  });

  it("a click on the shield still bubbles up to an ancestor listener — never calls stopPropagation", () => {
    const onClick = vi.fn();
    render(
      <div onClick={onClick}>
        <MediaInteractionShield />
      </div>,
    );
    const shield = document.querySelector("[aria-hidden='true']") as HTMLElement;
    fireEvent.click(shield);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("a mousedown on the shield also bubbles — the drag-source's own pointerdown listener on an ancestor still fires", () => {
    const onMouseDown = vi.fn();
    render(
      <div onMouseDown={onMouseDown}>
        <MediaInteractionShield />
      </div>,
    );
    const shield = document.querySelector("[aria-hidden='true']") as HTMLElement;
    fireEvent.mouseDown(shield);
    expect(onMouseDown).toHaveBeenCalledTimes(1);
  });

  it("renders as an absolutely positioned div covering its parent (position: absolute; inset: 0)", () => {
    render(<MediaInteractionShield />);
    const shield = document.querySelector("[aria-hidden='true']") as HTMLElement;
    expect(shield.className).toContain("absolute");
    expect(shield.className).toContain("inset-0");
  });

  it("Checkpoint 1.15.6.12.3 — still renders while editorMode is \"design\" (the default), protecting native controls from accidental selection/drag clicks", () => {
    render(<MediaInteractionShield />);
    expect(document.querySelector("[aria-hidden='true']")).not.toBeNull();
  });

  it("Checkpoint 1.15.6.12.3 — renders nothing at all while editorMode is \"preview\", fixing a real pre-existing bug: native Video/Audio/Iframe controls were unreachable in Preview because this shield unconditionally covered them", () => {
    useEditorStore.setState({ editorMode: "preview" });
    const { container } = render(<MediaInteractionShield />);
    expect(container.firstChild).toBeNull();
    expect(document.querySelector("[aria-hidden='true']")).toBeNull();
  });
});
