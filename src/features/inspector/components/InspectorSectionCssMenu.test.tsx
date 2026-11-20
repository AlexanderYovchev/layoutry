import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";
import { createSelection } from "@/features/editor/types/selection";
import { findNodeById } from "@/features/editor/utils/findNodeById";
import { InspectorContent } from "./InspectorContent";

/** BC-11.3 — the Inspector section headers' Copy/Paste <section> CSS menu. */

const initialState = useEditorStore.getState();
const store = () => useEditorStore.getState();
const node = (id: string) => findNodeById(store().document, id)!;
const px = (value: number) => ({ value, unit: "px" as const });

function show(children: EditorElementNode[], ids: string[]) {
  useEditorStore.setState(initialState, true);
  store().replaceDocument({ id: "page-root", tag: "page", children });
  useEditorStore.setState({ selection: createSelection(ids, ids[ids.length - 1]) });
  return render(<InspectorContent />);
}

const trigger = (section: string) => screen.getByRole("button", { name: `${section} CSS actions` });
const menu = (section: string) => screen.getByRole("menu", { name: `${section} CSS` });

describe("Inspector section CSS menu (BC-11.3)", () => {
  beforeEach(() => useEditorStore.setState(initialState, true));
  afterEach(() => useEditorStore.setState(initialState, true));

  it("CSS sections have the menu; non-CSS sections (Identity, Interactions) don't", () => {
    show([{ id: "h", tag: "h2", text: "H", typography: { color: "#ff0000" } }], ["h"]);
    for (const section of ["Typography", "Background", "Border", "Border Radius", "Box Shadow", "Visual Effects", "Transition", "Transform", "Display & Visibility", "Position", "Spacing", "Size"]) {
      expect(trigger(section)).toHaveAttribute("aria-haspopup", "menu");
    }
    expect(screen.queryByRole("button", { name: "Identity CSS actions" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Interactions CSS actions" })).toBeNull();
  });

  it("Copy is enabled only with authored values in the section; Paste only with that group copied; using it never toggles the section", async () => {
    const user = userEvent.setup();
    show(
      [
        { id: "h", tag: "h2", text: "H", typography: { color: "#ff0000", fontSize: px(30) } },
        { id: "p", tag: "p", text: "P" },
      ],
      ["h"],
    );
    const header = screen.getAllByRole("button", { name: "Typography" }).find((button) => button.hasAttribute("aria-expanded"))!;
    const expanded = header.getAttribute("aria-expanded");
    await user.click(trigger("Typography"));
    expect(header.getAttribute("aria-expanded")).toBe(expanded);
    expect(within(menu("Typography")).getByRole("menuitem", { name: "Copy Typography CSS" })).toBeEnabled();
    expect(within(menu("Typography")).getByRole("menuitem", { name: "Paste Typography CSS" })).toBeDisabled();
    await user.click(screen.getByRole("menuitem", { name: "Copy Typography CSS" }));
    expect(store().styleClipboard?.groups).toEqual({ typography: { color: "#ff0000", fontSize: px(30) } });
    // Background has nothing authored: Copy disabled; the Typography copy has no Background: Paste disabled.
    await user.click(trigger("Background"));
    expect(screen.getByRole("menuitem", { name: "Copy Background CSS" })).toBeDisabled();
    expect(screen.getByRole("menuitem", { name: "Paste Background CSS" })).toBeDisabled();
  });

  it("keyboard: Enter opens with focus on the first item, arrows move, Enter runs it, Escape closes and returns focus", async () => {
    const user = userEvent.setup();
    show(
      [
        { id: "a", tag: "p", text: "A", typography: { color: "#00ff00" } },
        { id: "b", tag: "p", text: "B" },
      ],
      ["a"],
    );
    trigger("Typography").focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("menuitem", { name: "Copy Typography CSS" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(store().styleClipboard?.groups.typography).toEqual({ color: "#00ff00" });
    expect(trigger("Typography")).toHaveFocus();
    act(() => useEditorStore.setState({ selection: createSelection(["b"], "b") }));
    trigger("Typography").focus();
    await user.keyboard(" ");
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Paste Typography CSS" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu", { name: "Typography CSS" })).toBeNull();
    expect(trigger("Typography")).toHaveFocus();
    // Space on the item pastes.
    await user.keyboard("{Enter}{ArrowDown} ");
    expect(node("b").typography).toEqual({ color: "#00ff00" });
    expect(store().past).toHaveLength(1);
  });

  it("works on a collapsed section, and closes on an outside click", async () => {
    const user = userEvent.setup();
    show([{ id: "a", tag: "p", text: "A", boxShadow: [{ id: "l", enabled: true, inset: false, offsetX: px(1), offsetY: px(1), blur: px(0), spread: px(0), color: "#000000" }] }], ["a"]);
    const header = screen.getAllByRole("button", { name: "Box Shadow" }).find((button) => button.hasAttribute("aria-expanded"))!;
    if (header.getAttribute("aria-expanded") === "true") fireEvent.click(header);
    expect(header).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger("Box Shadow"));
    await user.click(screen.getByRole("menuitem", { name: "Copy Box Shadow CSS" }));
    expect(store().styleClipboard?.groups.boxShadow).toHaveLength(1);
    expect(header).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger("Box Shadow"));
    expect(menu("Box Shadow")).toBeInTheDocument();
    await user.click(document.body);
    expect(screen.queryByRole("menu", { name: "Box Shadow CSS" })).toBeNull();
  });

  it("multi-selection: mixed tags (bulk Typography), a Mixed panel (Box Shadow), Copy from the primary, Paste onto all", async () => {
    const user = userEvent.setup();
    show(
      [
        { id: "h", tag: "h1", text: "H", typography: { color: "#ff0000" }, boxShadow: [{ id: "l1", enabled: true, inset: false, offsetX: px(1), offsetY: px(1), blur: px(0), spread: px(0), color: "#000000" }] },
        { id: "p", tag: "p", text: "P", typography: { color: "#0000ff" }, boxShadow: [{ id: "l2", enabled: true, inset: false, offsetX: px(5), offsetY: px(5), blur: px(0), spread: px(0), color: "#000000" }] },
      ],
      ["h", "p"],
    );
    // The primary is p (last selected).
    await user.click(trigger("Typography"));
    await user.click(screen.getByRole("menuitem", { name: "Copy Typography CSS" }));
    expect(store().styleClipboard?.groups.typography).toEqual({ color: "#0000ff" });
    // The Mixed Box Shadow panel has the menu too.
    expect(trigger("Box Shadow")).toBeInTheDocument();
    await user.click(trigger("Typography"));
    await user.click(screen.getByRole("menuitem", { name: "Paste Typography CSS" }));
    expect([node("h").typography?.color, node("p").typography?.color]).toEqual(["#0000ff", "#0000ff"]);
    expect(store().past).toHaveLength(1);
    expect(store().selection.ids).toEqual(["h", "p"]);
  });
});
