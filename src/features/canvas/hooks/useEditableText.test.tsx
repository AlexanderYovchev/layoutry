import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";
import { useEditableText } from "./useEditableText";

const initialState = useEditorStore.getState();

/** Minimal harness — a plain, unstyled element wired through the hook, standing in for HeadingElement/ParagraphElement's own real usage. */
function EditableHarness({ node }: { node: EditorElementNode }) {
  const { elementRef, isEditing, editableProps } = useEditableText(node);
  return (
    <div
      role="textbox"
      ref={(element) => elementRef(element)}
      data-editing={isEditing}
      {...editableProps}
    >
      {node.text}
    </div>
  );
}

describe("useEditableText", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useEditorStore.setState(initialState, true);
  });

  it("is not editable until double-clicked", () => {
    render(<EditableHarness node={{ id: "heading-1", tag: "h1", text: "Title" }} />);

    expect(screen.getByRole("textbox")).toHaveAttribute("contenteditable", "false");
  });

  it("becomes contentEditable and focused after a double-click", () => {
    render(<EditableHarness node={{ id: "heading-1", tag: "h1", text: "Title" }} />);

    fireEvent.doubleClick(screen.getByRole("textbox"));

    const el = screen.getByRole("textbox");
    expect(el).toHaveAttribute("contenteditable", "true");
    expect(el).toHaveFocus();
  });

  it("commits the DOM's current text through setElementText on blur", () => {
    render(<EditableHarness node={{ id: "heading-1", tag: "h1", text: "Title" }} />);
    const spy = vi.spyOn(useEditorStore.getState(), "setElementText");

    const el = screen.getByRole("textbox");
    fireEvent.doubleClick(el);
    el.textContent = "New title";
    fireEvent.blur(el);

    expect(spy).toHaveBeenCalledWith("heading-1", "New title");
  });

  it("commits on Enter and prevents the default newline-insertion behavior", () => {
    render(<EditableHarness node={{ id: "heading-1", tag: "h1", text: "Title" }} />);
    const spy = vi.spyOn(useEditorStore.getState(), "setElementText");

    const el = screen.getByRole("textbox");
    fireEvent.doubleClick(el);
    el.textContent = "New title";
    const enterEvent = fireEvent.keyDown(el, { key: "Enter" });

    expect(enterEvent).toBe(false); // fireEvent returns false when preventDefault was called
    expect(spy).toHaveBeenCalledWith("heading-1", "New title");
  });

  it("Enter does not double-commit via the blur it triggers", () => {
    render(<EditableHarness node={{ id: "heading-1", tag: "h1", text: "Title" }} />);
    const spy = vi.spyOn(useEditorStore.getState(), "setElementText");

    const el = screen.getByRole("textbox");
    fireEvent.doubleClick(el);
    el.textContent = "New title";
    fireEvent.keyDown(el, { key: "Enter" });
    fireEvent.blur(el);

    expect(spy).toHaveBeenCalledOnce();
  });

  it("Escape reverts the DOM text and exits without committing", () => {
    render(<EditableHarness node={{ id: "heading-1", tag: "h1", text: "Title" }} />);
    const spy = vi.spyOn(useEditorStore.getState(), "setElementText");

    const el = screen.getByRole("textbox");
    fireEvent.doubleClick(el);
    el.textContent = "Discarded edit";
    fireEvent.keyDown(el, { key: "Escape" });

    expect(el.textContent).toBe("Title");
    expect(el).toHaveAttribute("contenteditable", "false");
    expect(spy).not.toHaveBeenCalled();
  });

  it("Escape does not double-revert-and-commit via the blur it triggers", () => {
    render(<EditableHarness node={{ id: "heading-1", tag: "h1", text: "Title" }} />);
    const spy = vi.spyOn(useEditorStore.getState(), "setElementText");

    const el = screen.getByRole("textbox");
    fireEvent.doubleClick(el);
    el.textContent = "Discarded edit";
    fireEvent.keyDown(el, { key: "Escape" });
    fireEvent.blur(el);

    expect(spy).not.toHaveBeenCalled();
  });

  it("does not commit when the text is unchanged (avoids a spurious history entry)", () => {
    render(<EditableHarness node={{ id: "heading-1", tag: "h1", text: "Title" }} />);
    const spy = vi.spyOn(useEditorStore.getState(), "setElementText");

    const el = screen.getByRole("textbox");
    fireEvent.doubleClick(el);
    fireEvent.blur(el);

    expect(spy).not.toHaveBeenCalled();
  });

  it("commits an intentionally emptied node safely", () => {
    render(<EditableHarness node={{ id: "heading-1", tag: "h1", text: "Title" }} />);
    const spy = vi.spyOn(useEditorStore.getState(), "setElementText");

    const el = screen.getByRole("textbox");
    fireEvent.doubleClick(el);
    el.textContent = "";
    fireEvent.blur(el);

    expect(spy).toHaveBeenCalledWith("heading-1", "");
  });

  it("exits editing mode after a commit", () => {
    render(<EditableHarness node={{ id: "heading-1", tag: "h1", text: "Title" }} />);

    const el = screen.getByRole("textbox");
    fireEvent.doubleClick(el);
    el.textContent = "New title";
    fireEvent.blur(el);

    expect(el).toHaveAttribute("contenteditable", "false");
  });
});
