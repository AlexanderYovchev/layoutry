import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { TextareaElement } from "./TextareaElement";

const initialState = useEditorStore.getState();

describe("TextareaElement (Checkpoint 1.12)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useEditorStore.setState(initialState, true);
  });

  it("renders a genuine <textarea>, not a div standing in for one", () => {
    render(<TextareaElement node={{ id: "textarea-1", tag: "textarea" }} parentId="form-1" parentLayoutMode="flow" parentFlowDisplay="block" />);

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.tagName).toBe("TEXTAREA");
  });

  it("reflects name and placeholder as real DOM attributes", () => {
    render(
      <TextareaElement
        node={{ id: "textarea-1", tag: "textarea", name: "message", placeholder: "Write your message" }}
        parentId="form-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );

    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveAttribute("name", "message");
    expect(textarea).toHaveAttribute("placeholder", "Write your message");
  });

  it("uses the authored value as the initial/default value, not a locked controlled value", () => {
    render(<TextareaElement node={{ id: "textarea-1", tag: "textarea", value: "one" }} parentId="form-1" parentLayoutMode="flow" parentFlowDisplay="block" />);

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.value).toBe("one");

    fireEvent.change(textarea, { target: { value: "changed" } });
    expect(textarea.value).toBe("changed");
  });

  it("renders empty when unset, rather than inventing a default", () => {
    render(<TextareaElement node={{ id: "textarea-1", tag: "textarea" }} parentId="form-1" parentLayoutMode="flow" parentFlowDisplay="block" />);
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("");
  });

  describe("normal-mode safety (same foundation as Input)", () => {
    it("is read-only until double-clicked", () => {
      render(<TextareaElement node={{ id: "textarea-1", tag: "textarea" }} parentId="form-1" parentLayoutMode="flow" parentFlowDisplay="block" />);
      expect(screen.getByRole("textbox")).toHaveAttribute("readonly");
    });

    it("double-click enters editing mode and clears readOnly", () => {
      render(<TextareaElement node={{ id: "textarea-1", tag: "textarea" }} parentId="form-1" parentLayoutMode="flow" parentFlowDisplay="block" />);
      const textarea = screen.getByRole("textbox");
      fireEvent.doubleClick(textarea);
      expect(textarea).not.toHaveAttribute("readonly");
    });

    it("a plain mousedown while not editing is prevented, so it never steals native focus", () => {
      render(<TextareaElement node={{ id: "textarea-1", tag: "textarea" }} parentId="form-1" parentLayoutMode="flow" parentFlowDisplay="block" />);
      const notCancelled = fireEvent.mouseDown(screen.getByRole("textbox"));
      expect(notCancelled).toBe(false);
    });
  });

  describe("multiline editing / commit semantics (Checkpoint 1.12 — commitOnEnter: false)", () => {
    it("Enter inserts a newline instead of committing — no preventDefault, no store call", () => {
      render(<TextareaElement node={{ id: "textarea-1", tag: "textarea", value: "old" }} parentId="form-1" parentLayoutMode="flow" parentFlowDisplay="block" />);
      const spy = vi.spyOn(useEditorStore.getState(), "setElementValue");

      const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
      fireEvent.doubleClick(textarea);
      const notCancelled = fireEvent.keyDown(textarea, { key: "Enter" });

      // Enter's default action (inserting a newline) is NOT prevented —
      // unlike text-like Input, where the same keyDown returns false.
      expect(notCancelled).toBe(true);
      expect(spy).not.toHaveBeenCalled();
      // Still in an active editing session — Enter did not exit it.
      expect(textarea).not.toHaveAttribute("readonly");
    });

    it("multiline typed content commits correctly on blur", () => {
      render(<TextareaElement node={{ id: "textarea-1", tag: "textarea" }} parentId="form-1" parentLayoutMode="flow" parentFlowDisplay="block" />);
      const spy = vi.spyOn(useEditorStore.getState(), "setElementValue");

      const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
      fireEvent.doubleClick(textarea);
      fireEvent.change(textarea, { target: { value: "Line one\nLine two\nLine three" } });
      fireEvent.blur(textarea);

      expect(spy).toHaveBeenCalledWith("textarea-1", "Line one\nLine two\nLine three");
      expect(textarea).toHaveAttribute("readonly");
    });

    it("Escape cancels — reverts the displayed value and never calls setElementValue", () => {
      render(<TextareaElement node={{ id: "textarea-1", tag: "textarea", value: "original" }} parentId="form-1" parentLayoutMode="flow" parentFlowDisplay="block" />);
      const spy = vi.spyOn(useEditorStore.getState(), "setElementValue");

      const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
      fireEvent.doubleClick(textarea);
      fireEvent.change(textarea, { target: { value: "discarded" } });
      fireEvent.keyDown(textarea, { key: "Escape" });

      expect(textarea.value).toBe("original");
      expect(spy).not.toHaveBeenCalled();
      expect(textarea).toHaveAttribute("readonly");
    });

    it("an unchanged editing session (double-click then blur with no edit) does not call setElementValue", () => {
      render(<TextareaElement node={{ id: "textarea-1", tag: "textarea", value: "unchanged" }} parentId="form-1" parentLayoutMode="flow" parentFlowDisplay="block" />);
      const spy = vi.spyOn(useEditorStore.getState(), "setElementValue");

      const textarea = screen.getByRole("textbox");
      fireEvent.doubleClick(textarea);
      fireEvent.blur(textarea);

      expect(spy).not.toHaveBeenCalled();
    });
  });

  it("resyncs the displayed value when node.value changes from OUTSIDE an editing session (Undo/Redo/Reset) — same imperative-sync fix Checkpoint 1.10 established for Input, reused unchanged", () => {
    const { rerender } = render(
      <TextareaElement node={{ id: "textarea-1", tag: "textarea", value: "one" }} parentId="form-1" parentLayoutMode="flow" parentFlowDisplay="block" />,
    );
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.value).toBe("one");

    rerender(<TextareaElement node={{ id: "textarea-1", tag: "textarea", value: "two" }} parentId="form-1" parentLayoutMode="flow" parentFlowDisplay="block" />);
    expect(textarea.value).toBe("two");

    rerender(<TextareaElement node={{ id: "textarea-1", tag: "textarea", value: "one" }} parentId="form-1" parentLayoutMode="flow" parentFlowDisplay="block" />);
    expect(textarea.value).toBe("one");
  });
});
