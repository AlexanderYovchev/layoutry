import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";
import { ButtonElement } from "./ButtonElement";
import { ContainerElement } from "./ContainerElement";
import { LinkElement } from "./LinkElement";

/**
 * BC-09.2 — the Canvas (Design and Preview) renders the generic format 3
 * accessibility fields. Preview uses these same components, so Preview and
 * Export (exportAccessibilityAttributes.test.ts) agree.
 */

const initialState = useEditorStore.getState();
const placement = { parentId: "nav-1", parentLayoutMode: "flow", parentFlowDisplay: "flex" } as const;
const setPreview = (preview: boolean) => useEditorStore.setState({ editorMode: preview ? "preview" : "design" });

function renderLink(node: Partial<EditorElementNode>) {
  return render(<LinkElement node={{ id: "a-1", tag: "a", text: "2", href: "?page=2", ...node }} {...placement} />);
}

describe("accessibility fields on the Canvas (BC-09.2)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  for (const preview of [false, true]) {
    const mode = preview ? "Preview" : "Design";

    it(`${mode}: an ordinary link keeps its href and gets no extra attributes`, () => {
      setPreview(preview);
      renderLink({});
      const link = screen.getByRole("link", { name: "2" });
      expect(link).toHaveAttribute("href", "?page=2");
      for (const name of ["aria-current", "aria-disabled", "role", "aria-label"]) expect(link).not.toHaveAttribute(name);
    });

    it(`${mode}: the current page is aria-current="page", has no href and isn't a link any more`, () => {
      setPreview(preview);
      const { container } = renderLink({ text: "1", ariaCurrent: "page" });
      const current = container.querySelector('[data-node-id="a-1"]');
      expect(current).toHaveAttribute("aria-current", "page");
      expect(current).not.toHaveAttribute("href");
      expect(screen.queryByRole("link")).toBeNull();
      expect(current?.tagName).toBe("A");
    });

    it(`${mode}: another aria-current token keeps the href`, () => {
      setPreview(preview);
      renderLink({ ariaCurrent: "step" });
      const link = screen.getByRole("link", { name: "2" });
      expect(link).toHaveAttribute("aria-current", "step");
      expect(link).toHaveAttribute("href", "?page=2");
    });

    it(`${mode}: a disabled link is role="link" aria-disabled="true" with no href, so it can't navigate`, () => {
      setPreview(preview);
      renderLink({ text: "Previous", disabled: true });
      const link = screen.getByRole("link", { name: "Previous" });
      expect(link).toHaveAttribute("aria-disabled", "true");
      expect(link).not.toHaveAttribute("href");
    });

    it(`${mode}: a nav gets its accessible name`, () => {
      setPreview(preview);
      render(<ContainerElement node={{ id: "nav-1", tag: "nav", ariaLabel: "Pagination", component: "pagination" }} parentId="page-root" parentLayoutMode="flow" parentFlowDisplay="block" />);
      expect(screen.getByRole("navigation", { name: "Pagination" })).toBeInTheDocument();
    });
  }

  it("Design: a disabled button stays clickable for selection (aria-disabled, not native disabled)", () => {
    setPreview(false);
    let clicks = 0;
    render(
      <div onClick={() => (clicks += 1)}>
        <ButtonElement node={{ id: "b-1", tag: "button", text: "Next", disabled: true }} {...placement} />
      </div>,
    );
    const button = screen.getByRole("button", { name: "Next" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toBeDisabled();
    fireEvent.click(button);
    expect(clicks).toBe(1);
  });

  it("Preview: a disabled button is natively disabled", () => {
    setPreview(true);
    render(<ButtonElement node={{ id: "b-1", tag: "button", text: "Next", disabled: true }} {...placement} />);
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("Design: clicking a disabled or current link still reaches selection and never navigates", () => {
    setPreview(false);
    let clicks = 0;
    render(
      <div onClick={() => (clicks += 1)}>
        <LinkElement node={{ id: "a-1", tag: "a", text: "1", href: "#", ariaCurrent: "page" }} {...placement} />
        <LinkElement node={{ id: "a-2", tag: "a", text: "Previous", href: "#", disabled: true }} {...placement} />
      </div>,
    );
    for (const id of ["a-1", "a-2"]) {
      const element = document.querySelector(`[data-node-id="${id}"]`);
      if (!element) throw new Error(id);
      expect(fireEvent.click(element)).toBe(false);
    }
    expect(clicks).toBe(2);
  });

  it("escapes a label as text, never markup", () => {
    const label = `"><img src=x onerror=alert(1)>`;
    const { container } = render(<ContainerElement node={{ id: "nav-1", tag: "nav", ariaLabel: label }} parentId="page-root" parentLayoutMode="flow" parentFlowDisplay="block" />);
    expect(container.querySelector("nav")).toHaveAttribute("aria-label", label);
    expect(container.querySelector("img")).toBeNull();
  });

  it("ignores a field on a tag that can't have it (the loader refuses such files anyway)", () => {
    const { container } = render(<ContainerElement node={{ id: "div-1", tag: "div", ariaLabel: "x", disabled: true } as EditorElementNode} parentId="page-root" parentLayoutMode="flow" parentFlowDisplay="block" />);
    const div = container.querySelector("div");
    expect(div).not.toHaveAttribute("aria-label");
    expect(div).not.toHaveAttribute("aria-disabled");
  });
});
