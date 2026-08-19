import { fireEvent, render, screen } from "@testing-library/react";
import type { FormEvent } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { ButtonElement } from "./ButtonElement";

const initialState = useEditorStore.getState();

describe("ButtonElement", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useEditorStore.setState(initialState, true);
  });

  it("renders a genuine <button type=\"button\"> — safe by default against future Form submission (Checkpoint 1.5)", () => {
    render(<ButtonElement node={{ id: "button-1", tag: "button", text: "Go" }} parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block" />);

    const button = screen.getByRole("button", { name: "Go" });
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("type", "button");
  });

  it("does not submit a surrounding form on click, thanks to its explicit type=\"button\" (Checkpoint 1.5 — native action safety)", () => {
    const handleSubmit = vi.fn((event: FormEvent<HTMLFormElement>) => event.preventDefault());
    render(
      <form onSubmit={handleSubmit}>
        <ButtonElement node={{ id: "button-1", tag: "button", text: "Go" }} parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block" />
      </form>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Go" }));

    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it("is not editable until double-clicked (Checkpoint 1.5)", () => {
    render(<ButtonElement node={{ id: "button-1", tag: "button", text: "Go" }} parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block" />);

    expect(screen.getByRole("button", { name: "Go" })).toHaveAttribute("contenteditable", "false");
  });

  it("double-click enters editing mode while remaining a real <button> (Checkpoint 1.5 — reuses useEditableText, same as Heading/Paragraph/Link)", () => {
    render(<ButtonElement node={{ id: "button-1", tag: "button", text: "Go" }} parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block" />);

    const button = screen.getByRole("button", { name: "Go" });
    fireEvent.doubleClick(button);

    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("contenteditable", "true");
  });

  it("commits the edited label through setElementText on blur and exits editing", () => {
    render(<ButtonElement node={{ id: "button-1", tag: "button", text: "Go" }} parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block" />);
    const spy = vi.spyOn(useEditorStore.getState(), "setElementText");

    const button = screen.getByRole("button", { name: "Go" });
    fireEvent.doubleClick(button);
    button.textContent = "Start Building";
    fireEvent.blur(button);

    expect(spy).toHaveBeenCalledWith("button-1", "Start Building");
    expect(button).toHaveAttribute("contenteditable", "false");
  });

  it("renders with no inline size when not resized", () => {
    render(<ButtonElement node={{ id: "button-1", tag: "button", text: "Go" }} parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block" />);

    const button = screen.getByRole("button", { name: "Go" });
    expect(button.style.width).toBe("");
  });

  it("applies the preferred size and clips overflow once resized — universal resize, Checkpoint 3.4.3", () => {
    render(
      <ButtonElement
        node={{
          id: "button-1",
          tag: "button",
          text: "Go",
          dimensions: { preferredWidth: 200, preferredHeight: 50, offsetX: 0, offsetY: 0 },
        }}
        parentId="section-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );

    const button = screen.getByRole("button", { name: "Go" });
    expect(button.style.width).toBe("200px");
    expect(button.style.height).toBe("50px");
    expect(button.style.overflow).toBe("hidden");
  });

  it("defers to an explicit unified overflow value instead of the legacy resize-clip default (Checkpoint 5.4)", () => {
    render(
      <ButtonElement
        node={{
          id: "button-1",
          tag: "button",
          text: "Go",
          dimensions: { preferredWidth: 200, preferredHeight: 50, offsetX: 0, offsetY: 0 },
          display: { overflow: "visible" },
        }}
        parentId="section-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );

    const button = screen.getByRole("button", { name: "Go" });
    expect(button.style.overflow).toBe("visible");
  });

  it("defers to an explicit overflowX/overflowY axis instead of the legacy resize-clip default (Checkpoint 5.4)", () => {
    render(
      <ButtonElement
        node={{
          id: "button-1",
          tag: "button",
          text: "Go",
          dimensions: { preferredWidth: 200, preferredHeight: 50, offsetX: 0, offsetY: 0 },
          display: { overflowY: "auto" },
        }}
        parentId="section-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );

    const button = screen.getByRole("button", { name: "Go" });
    expect(button.style.overflow).toBe("");
    expect(button.style.overflowY).toBe("auto");
  });
});
