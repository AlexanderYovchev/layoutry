import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { InputElement } from "./InputElement";

const initialState = useEditorStore.getState();

describe("InputElement (Checkpoint 1.10)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useEditorStore.setState(initialState, true);
  });

  it("renders a genuine <input type=\"text\">, not a div standing in for one", () => {
    render(<InputElement node={{ id: "input-1", tag: "input", inputType: "text" }} parentId="form-1" parentLayoutMode="flow" parentFlowDisplay="block" />);

    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.tagName).toBe("INPUT");
    expect(input.type).toBe("text");
  });

  it("reflects name and placeholder as real DOM attributes", () => {
    render(
      <InputElement
        node={{ id: "input-1", tag: "input", inputType: "text", name: "email", placeholder: "Enter your email" }}
        parentId="form-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );

    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("name", "email");
    expect(input).toHaveAttribute("placeholder", "Enter your email");
  });

  it("uses the authored value as the initial/default value, not a locked controlled value", () => {
    render(
      <InputElement
        node={{ id: "input-1", tag: "input", inputType: "text", value: "test@example.com" }}
        parentId="form-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );

    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("test@example.com");

    // Prove it's uncontrolled (defaultValue, not value+onChange): a raw
    // DOM change must persist rather than being reverted by a locking
    // React render — the exact failure mode this project has already
    // hit once (the Checkpoint 4.3.0.1 color picker footgun).
    fireEvent.change(input, { target: { value: "changed@example.com" } });
    expect(input.value).toBe("changed@example.com");
  });

  it("renders no value attribute at all when unset, rather than inventing a default", () => {
    render(<InputElement node={{ id: "input-1", tag: "input", inputType: "text" }} parentId="form-1" parentLayoutMode="flow" parentFlowDisplay="block" />);

    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("");
  });

  it("resyncs the displayed value when node.value changes from OUTSIDE an editing session (e.g. Undo/Redo/Reset) — an uncontrolled input's defaultValue alone would NOT do this on a later render", () => {
    const { rerender } = render(
      <InputElement node={{ id: "input-1", tag: "input", inputType: "text", value: "before" }} parentId="form-1" parentLayoutMode="flow" parentFlowDisplay="block" />,
    );
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("before");

    rerender(
      <InputElement node={{ id: "input-1", tag: "input", inputType: "text", value: "after undo" }} parentId="form-1" parentLayoutMode="flow" parentFlowDisplay="block" />,
    );

    expect(input.value).toBe("after undo");
  });

  it("does not fight live typing mid-session — the resync effect is skipped while isEditing", () => {
    const { rerender } = render(
      <InputElement node={{ id: "input-1", tag: "input", inputType: "text", value: "original" }} parentId="form-1" parentLayoutMode="flow" parentFlowDisplay="block" />,
    );
    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.doubleClick(input);
    fireEvent.change(input, { target: { value: "mid-typing draft" } });

    // A re-render with the SAME still-uncommitted node.value (e.g. caused
    // by an unrelated sibling store update) must not clobber the live draft.
    rerender(
      <InputElement node={{ id: "input-1", tag: "input", inputType: "text", value: "original" }} parentId="form-1" parentLayoutMode="flow" parentFlowDisplay="block" />,
    );

    expect(input.value).toBe("mid-typing draft");
  });

  describe("Canvas interaction (Checkpoint 1.10)", () => {
    it("is read-only until double-clicked — a plain click never allows native typing", () => {
      render(<InputElement node={{ id: "input-1", tag: "input", inputType: "text" }} parentId="form-1" parentLayoutMode="flow" parentFlowDisplay="block" />);

      expect(screen.getByRole("textbox")).toHaveAttribute("readonly");
    });

    it("double-click enters editing mode and clears readOnly", () => {
      render(<InputElement node={{ id: "input-1", tag: "input", inputType: "text" }} parentId="form-1" parentLayoutMode="flow" parentFlowDisplay="block" />);

      const input = screen.getByRole("textbox");
      fireEvent.doubleClick(input);

      expect(input).not.toHaveAttribute("readonly");
    });

    it("double-click gives the native control real DOM focus — the moment useEditorKeyboardShortcuts' isEditableTarget check is meaningful", () => {
      render(<InputElement node={{ id: "input-1", tag: "input", inputType: "text" }} parentId="form-1" parentLayoutMode="flow" parentFlowDisplay="block" />);

      const input = screen.getByRole("textbox");
      fireEvent.doubleClick(input);

      expect(document.activeElement).toBe(input);
    });

    it("a plain mousedown while not editing is prevented, so it never steals native focus", () => {
      render(<InputElement node={{ id: "input-1", tag: "input", inputType: "text" }} parentId="form-1" parentLayoutMode="flow" parentFlowDisplay="block" />);

      const input = screen.getByRole("textbox");
      const notCancelled = fireEvent.mouseDown(input);

      expect(notCancelled).toBe(false);
    });

    it("commits the typed value through setElementValue on blur — one editing session, one call", () => {
      render(
        <InputElement
          node={{ id: "input-1", tag: "input", inputType: "text", value: "old" }}
          parentId="form-1"
          parentLayoutMode="flow"
          parentFlowDisplay="block"
        />,
      );
      const spy = vi.spyOn(useEditorStore.getState(), "setElementValue");

      const input = screen.getByRole("textbox") as HTMLInputElement;
      fireEvent.doubleClick(input);
      fireEvent.change(input, { target: { value: "new value" } });
      fireEvent.blur(input);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith("input-1", "new value");
      expect(input).toHaveAttribute("readonly");
    });

    it("commits on Enter and blurs the native control", () => {
      render(
        <InputElement
          node={{ id: "input-1", tag: "input", inputType: "text", value: "old" }}
          parentId="form-1"
          parentLayoutMode="flow"
          parentFlowDisplay="block"
        />,
      );
      const spy = vi.spyOn(useEditorStore.getState(), "setElementValue");

      const input = screen.getByRole("textbox") as HTMLInputElement;
      fireEvent.doubleClick(input);
      fireEvent.change(input, { target: { value: "committed via enter" } });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(spy).toHaveBeenCalledWith("input-1", "committed via enter");
      // Enter's own synthetic blur() must not double-commit through the
      // subsequent native blur event (see suppressNextBlurCommitRef).
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("Escape cancels — reverts the displayed value and never calls setElementValue", () => {
      render(
        <InputElement
          node={{ id: "input-1", tag: "input", inputType: "text", value: "original" }}
          parentId="form-1"
          parentLayoutMode="flow"
          parentFlowDisplay="block"
        />,
      );
      const spy = vi.spyOn(useEditorStore.getState(), "setElementValue");

      const input = screen.getByRole("textbox") as HTMLInputElement;
      fireEvent.doubleClick(input);
      fireEvent.change(input, { target: { value: "something totally different" } });
      fireEvent.keyDown(input, { key: "Escape" });

      expect(input.value).toBe("original");
      expect(spy).not.toHaveBeenCalled();
    });

    it("an unchanged editing session (double-click then blur with no edit) does not call setElementValue", () => {
      render(
        <InputElement
          node={{ id: "input-1", tag: "input", inputType: "text", value: "unchanged" }}
          parentId="form-1"
          parentLayoutMode="flow"
          parentFlowDisplay="block"
        />,
      );
      const spy = vi.spyOn(useEditorStore.getState(), "setElementValue");

      const input = screen.getByRole("textbox");
      fireEvent.doubleClick(input);
      fireEvent.blur(input);

      expect(spy).not.toHaveBeenCalled();
    });

    it("Enter is prevented from also submitting an ancestor <form>", () => {
      render(
        <form>
          <InputElement node={{ id: "input-1", tag: "input", inputType: "text" }} parentId="form-1" parentLayoutMode="flow" parentFlowDisplay="block" />
        </form>,
      );

      const input = screen.getByRole("textbox") as HTMLInputElement;
      fireEvent.doubleClick(input);
      const notCancelled = fireEvent.keyDown(input, { key: "Enter" });

      expect(notCancelled).toBe(false);
    });
  });

  describe("expanded text-like Input types (Checkpoint 1.11)", () => {
    it("renders the genuine native type for every text-like variant — one shared renderer, no duplicate components", () => {
      for (const inputType of ["text", "email", "password", "number", "search", "url", "tel"] as const) {
        const { container, unmount } = render(
          <InputElement node={{ id: "input-1", tag: "input", inputType }} parentId="form-1" parentLayoutMode="flow" parentFlowDisplay="block" />,
        );
        const input = container.querySelector('[data-node-id="input-1"]') as HTMLInputElement;
        expect(input.tagName, inputType).toBe("INPUT");
        expect(input.type, inputType).toBe(inputType);
        unmount();
      }
    });

    it("the full native editing lifecycle (double-click, type, commit, Escape-cancel) still works for representative text-like variants — email, password, number", () => {
      // A real <input type="number"> silently sanitizes its own DOM
      // .value to "" for any non-numeric string (the HTML value-
      // sanitization algorithm — a genuine browser/jsdom behavior, not
      // something Layoutry adds) — so unlike email/password, its
      // starter authored value has to actually look numeric for this
      // loop's later assertions to mean what they say.
      const startingValues = { email: "old", password: "old", number: "7" } as const;
      const editedValues = { email: "new-value", password: "new-value", number: "42" } as const;

      for (const inputType of ["email", "password", "number"] as const) {
        const startingValue = startingValues[inputType];
        const { container, unmount } = render(
          <InputElement node={{ id: "input-1", tag: "input", inputType, value: startingValue }} parentId="form-1" parentLayoutMode="flow" parentFlowDisplay="block" />,
        );
        const input = container.querySelector('[data-node-id="input-1"]') as HTMLInputElement;
        const spy = vi.spyOn(useEditorStore.getState(), "setElementValue");

        expect(input, inputType).toHaveAttribute("readonly");
        fireEvent.doubleClick(input);
        expect(input, inputType).not.toHaveAttribute("readonly");

        const nextValue = editedValues[inputType];
        fireEvent.change(input, { target: { value: nextValue } });
        fireEvent.blur(input);
        expect(spy, inputType).toHaveBeenCalledWith("input-1", nextValue);
        expect(input, inputType).toHaveAttribute("readonly");

        fireEvent.doubleClick(input);
        fireEvent.change(input, { target: { value: inputType === "number" ? "99" : "discarded" } });
        fireEvent.keyDown(input, { key: "Escape" });
        // Escape reverts to node.value (the static starting-value prop
        // this test rendered with, since setElementValue above was only
        // spied on, not connected to a live store re-render) — not to
        // whatever was typed and committed in the DOM a moment earlier.
        // This proves cancel() reads the authored value, never the DOM's
        // own most recent state.
        expect(input.value, inputType).toBe(startingValue);

        unmount();
        vi.restoreAllMocks();
      }
    });

    it("Type switching preserves name/placeholder/value and re-renders the correct native type — the Checkpoint 1.10 defaultValue resync fix applies identically across a type change", () => {
      const { rerender } = render(
        <InputElement
          node={{ id: "input-1", tag: "input", inputType: "text", name: "contact", placeholder: "Enter contact", value: "hello" }}
          parentId="form-1"
          parentLayoutMode="flow"
          parentFlowDisplay="block"
        />,
      );
      let input = screen.getByRole("textbox") as HTMLInputElement;
      expect(input.type).toBe("text");
      expect(input.value).toBe("hello");

      rerender(
        <InputElement
          node={{ id: "input-1", tag: "input", inputType: "email", name: "contact", placeholder: "Enter contact", value: "hello" }}
          parentId="form-1"
          parentLayoutMode="flow"
          parentFlowDisplay="block"
        />,
      );
      input = screen.getByRole("textbox") as HTMLInputElement;
      expect(input.type).toBe("email");
      expect(input).toHaveAttribute("name", "contact");
      expect(input).toHaveAttribute("placeholder", "Enter contact");
      expect(input.value).toBe("hello");
    });
  });
});
