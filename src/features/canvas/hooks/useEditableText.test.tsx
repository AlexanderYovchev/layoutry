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

/**
 * Two independent editable nodes side by side — one hook instance each,
 * matching how e.g. a Dropdown Button's trigger Button and its own menu
 * Links each get their own useEditableText call. Named "first"/"second"
 * (not by tag) since the bug this stands in for (Checkpoint 1.15.6.2.1)
 * reproduces for any two text-bearing tags in sequence, not a
 * Button-specific or Link-specific one.
 */
function TwoEditableHarness({ first, second }: { first: EditorElementNode; second: EditorElementNode }) {
  return (
    <>
      <EditableHarness node={first} />
      <EditableHarness node={second} />
    </>
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

  describe("Sequential Canvas Text Editing (Checkpoint 1.15.6.2.1)", () => {
    /**
     * The real, reproduced bug: after committing an edit on one
     * text-bearing node (Enter -> commit() -> blur(), still contentEditable
     * at the moment blur() runs), double-clicking a SECOND text-bearing
     * node correctly focuses and flips it to contentEditable, but the
     * browser's native Selection is left stale, still anchored inside the
     * first (now non-editable) node — breaking native Ctrl+A/typing on
     * the second node in a real browser (see this checkpoint's own report
     * for the full `document.getSelection()` diagnosis). jsdom's Selection/
     * Range implementation is what this test asserts against directly,
     * since jsdom (unlike real Chromium) doesn't actually restrict
     * `execCommand`/typing scope by Selection the same way — the bug's
     * OWN visible symptom (broken typing) only reproduces in a real
     * browser, but its root cause (the Selection never following focus
     * into the newly-edited element) is directly observable and testable
     * here via `window.getSelection()`.
     */
    it("re-anchors the Selection inside a node entered via double-click, even after a stale Selection was left behind by a prior commit elsewhere", () => {
      render(
        <TwoEditableHarness
          first={{ id: "node-1", tag: "button", text: "First" }}
          second={{ id: "node-2", tag: "a", text: "Second" }}
        />,
      );
      const [first, second] = screen.getAllByRole("textbox");

      // Edit and commit the first node via Enter (blur while still contentEditable, exactly like the real bug's own trigger).
      fireEvent.doubleClick(first);
      first.textContent = "First edited";
      fireEvent.keyDown(first, { key: "Enter" });
      fireEvent.blur(first);
      expect(first).toHaveAttribute("contenteditable", "false");

      // A stale Selection from the first node's own editing session must not still be the active one.
      const staleSelection = window.getSelection();
      const hadStaleRangeInFirst = staleSelection?.rangeCount === 1 && first.contains(staleSelection.anchorNode);

      fireEvent.doubleClick(second);

      const selection = window.getSelection();
      expect(selection?.rangeCount).toBe(1);
      expect(second.contains(selection?.anchorNode ?? null)).toBe(true);
      // Specifically: the Selection is no longer anchored in the first
      // node, regardless of whether jsdom itself left one there.
      if (hadStaleRangeInFirst) {
        expect(first.contains(selection?.anchorNode ?? null)).toBe(false);
      }
    });

    it("selects the node's full text when editing starts, so typing immediately replaces it", () => {
      render(<EditableHarness node={{ id: "node-1", tag: "h1", text: "Replace me" }} />);
      const el = screen.getByRole("textbox");

      fireEvent.doubleClick(el);

      const selection = window.getSelection();
      expect(selection?.toString()).toBe("Replace me");
    });

    it("chains three sequential edits across three different nodes without losing the Selection's anchor each time", () => {
      render(
        <>
          <EditableHarness node={{ id: "node-1", tag: "button", text: "One" }} />
          <EditableHarness node={{ id: "node-2", tag: "a", text: "Two" }} />
          <EditableHarness node={{ id: "node-3", tag: "h1", text: "Three" }} />
        </>,
      );
      const [first, second, third] = screen.getAllByRole("textbox");

      for (const el of [first, second, third]) {
        fireEvent.doubleClick(el);
        expect(window.getSelection()?.rangeCount).toBe(1);
        expect(el.contains(window.getSelection()?.anchorNode ?? null)).toBe(true);
        el.textContent = `${el.textContent} edited`;
        fireEvent.keyDown(el, { key: "Enter" });
        fireEvent.blur(el);
      }
    });
  });
});
