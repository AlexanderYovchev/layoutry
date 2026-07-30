import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InspectorFontFamilyField } from "./InspectorFontFamilyField";
import { useRecentFontsStore } from "@/features/inspector/stores/useRecentFontsStore";

const initialRecentFontsState = useRecentFontsStore.getState();

describe("InspectorFontFamilyField", () => {
  afterEach(() => {
    useRecentFontsStore.setState(initialRecentFontsState, true);
  });

  it("shows 'Default' as a placeholder when no font family is set", () => {
    render(<InspectorFontFamilyField ariaLabel="Font family" value={undefined} onCommit={vi.fn()} />);
    const input = screen.getByRole("combobox", { name: "Font family" });
    expect(input).toHaveValue("");
    expect(input).toHaveAttribute("placeholder", "Default");
  });

  it("shows the catalog's friendly label for a known committed value", () => {
    render(
      <InspectorFontFamilyField
        ariaLabel="Font family"
        value={'Georgia, "Times New Roman", serif'}
        onCommit={vi.fn()}
      />,
    );
    // Not focused/open — displays the resolved label, not the raw CSS value.
    expect(screen.getByRole("combobox", { name: "Font family" })).toHaveValue("Georgia");
  });

  it("opens the dropdown on focus and lists catalog options grouped by category", () => {
    render(<InspectorFontFamilyField ariaLabel="Font family" value={undefined} onCommit={vi.fn()} />);
    fireEvent.focus(screen.getByRole("combobox", { name: "Font family" }));

    expect(screen.getByRole("listbox", { name: "Font family" })).toBeInTheDocument();
    expect(screen.getByText("System")).toBeInTheDocument();
    expect(screen.getByText("Generic")).toBeInTheDocument();
    expect(screen.getByText("Web-safe")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Arial" })).toBeInTheDocument();
  });

  it("filters options as the query is typed", () => {
    render(<InspectorFontFamilyField ariaLabel="Font family" value={undefined} onCommit={vi.fn()} />);
    const input = screen.getByRole("combobox", { name: "Font family" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "geo" } });

    expect(screen.getByRole("option", { name: "Georgia" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Arial" })).not.toBeInTheDocument();
  });

  it("commits the selected option's CSS value on click and closes the dropdown", () => {
    const onCommit = vi.fn();
    render(<InspectorFontFamilyField ariaLabel="Font family" value={undefined} onCommit={onCommit} />);
    fireEvent.focus(screen.getByRole("combobox", { name: "Font family" }));
    fireEvent.click(screen.getByRole("option", { name: "Arial" }));

    expect(onCommit).toHaveBeenCalledWith("Arial, Helvetica, sans-serif");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("commits the highlighted option on Enter after arrowing down", () => {
    const onCommit = vi.fn();
    render(<InspectorFontFamilyField ariaLabel="Font family" value={undefined} onCommit={onCommit} />);
    const input = screen.getByRole("combobox", { name: "Font family" });
    // A single ArrowDown while closed both opens the dropdown and highlights
    // the first option ("System UI" — System category, listed first) —
    // it does not itself move off that first option.
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onCommit).toHaveBeenCalledWith("system-ui, -apple-system, sans-serif");
  });

  it("closes without committing on Escape", () => {
    const onCommit = vi.fn();
    render(<InspectorFontFamilyField ariaLabel="Font family" value={undefined} onCommit={onCommit} />);
    const input = screen.getByRole("combobox", { name: "Font family" });
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "Escape" });

    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("records a selected font as recently used and surfaces it (for a different current value) on the next open", () => {
    const onCommit = vi.fn();
    const { rerender } = render(<InspectorFontFamilyField ariaLabel="Font family" value={undefined} onCommit={onCommit} />);
    fireEvent.focus(screen.getByRole("combobox", { name: "Font family" }));
    fireEvent.click(screen.getByRole("option", { name: "Verdana" }));

    // Re-render as if a different element (with its own, different font)
    // is now selected — Verdana should surface under "Recently used" since
    // it's no longer the current value (the current value is deliberately
    // excluded from its own recents list).
    rerender(<InspectorFontFamilyField ariaLabel="Font family" value="Arial, Helvetica, sans-serif" onCommit={onCommit} />);
    fireEvent.focus(screen.getByRole("combobox", { name: "Font family" }));

    expect(screen.getByText("Recently used")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Verdana" })).toBeInTheDocument();
  });

  it("closes the dropdown on blur without committing anything", () => {
    const onCommit = vi.fn();
    render(<InspectorFontFamilyField ariaLabel="Font family" value={undefined} onCommit={onCommit} />);
    const input = screen.getByRole("combobox", { name: "Font family" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Custom Font" } });
    fireEvent.blur(input);

    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("disables the input when disabled", () => {
    render(<InspectorFontFamilyField ariaLabel="Font family" value={undefined} onCommit={vi.fn()} disabled />);
    expect(screen.getByRole("combobox", { name: "Font family" })).toBeDisabled();
  });
});
