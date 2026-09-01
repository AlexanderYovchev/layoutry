import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MediaInteractionShield } from "./MediaInteractionShield";

describe("MediaInteractionShield (Checkpoint 1.15)", () => {
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
});
