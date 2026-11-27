import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DocumentNodeRenderer } from "@/features/canvas/components/document/DocumentNodeRenderer";
import { useDocumentStyleSheet } from "@/features/canvas/hooks/useDocumentStyleSheet";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";

/*
 * BC-17.3 — the installed document stylesheet and the live gesture
 * override contract (BC-17.1.3 Report 1 §8.11), end to end through the
 * real store, the real host and the real element components.
 */

const initialState = useEditorStore.getState();

const FREE_BOX = { x: 10, y: 20, width: 80, height: 40 };

function freeDocument(): EditorElementNode {
  return {
    id: "page-root",
    tag: "page",
    children: [
      {
        id: "free-1",
        tag: "div",
        layoutMode: "free",
        children: [{ id: "box", tag: "div", freeLayout: FREE_BOX }],
      },
    ],
  };
}

function Surface() {
  const { scope, surface, styleRef } = useDocumentStyleSheet();
  const document = useEditorStore((state) => state.document);
  return (
    <>
      <style
        ref={styleRef}
        data-ly-document-styles={surface}
        data-ly-sheet={scope}
      />
      <div data-testid="surface" data-ly-sheet={scope}>
        <DocumentNodeRenderer
          node={document}
          parentId={null}
          parentLayoutMode="flow"
          parentFlowDisplay="block"
        />
      </div>
    </>
  );
}

function sheetText(): string {
  const element = document.querySelector<HTMLStyleElement>(
    "style[data-ly-document-styles]",
  );
  return Array.from(element?.sheet?.cssRules ?? [])
    .map((rule) => rule.cssText)
    .join("\n");
}

function countSheetMutations() {
  const insert = vi.spyOn(CSSStyleSheet.prototype, "insertRule");
  const remove = vi.spyOn(CSSStyleSheet.prototype, "deleteRule");
  return () => insert.mock.calls.length + remove.mock.calls.length;
}

function box(): HTMLElement {
  const element = document.querySelector<HTMLElement>('[data-node-id="box"]');
  if (!element) throw new Error("box not rendered");
  return element;
}

describe("useDocumentStyleSheet", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useEditorStore.setState(initialState, true);
  });

  it("installs one scoped sheet for the surface, styles the document from it, and removes it on unmount", () => {
    useEditorStore.setState({ document: freeDocument() });
    const { getByTestId, unmount } = render(<Surface />);

    const sheets = document.querySelectorAll("style[data-ly-document-styles]");
    expect(sheets).toHaveLength(1);
    expect(sheets[0]).toHaveAttribute("data-ly-document-styles", "design");
    expect(sheets[0].getAttribute("data-ly-sheet")).toBe(
      getByTestId("surface").getAttribute("data-ly-sheet"),
    );
    // Every rule is scoped to the surface, so nothing can reach editor chrome.
    expect(sheetText()).not.toBe("");
    for (const line of sheetText().split("\n"))
      expect(line).toContain(
        `[data-ly-sheet="${sheets[0].getAttribute("data-ly-sheet")}"]`,
      );
    // No authored CSS is inline any more.
    expect(box().style).toHaveLength(0);
    expect(getComputedStyle(box()).left).toBe("10px");

    unmount();
    expect(
      document.querySelectorAll("style[data-ly-document-styles]"),
    ).toHaveLength(0);
  });

  it("swaps to a Preview sheet when the editor enters Preview", () => {
    useEditorStore.setState({ document: freeDocument() });
    render(<Surface />);
    act(() => useEditorStore.getState().enterPreview());
    const sheets = document.querySelectorAll("style[data-ly-document-styles]");
    expect(sheets).toHaveLength(1);
    expect(sheets[0]).toHaveAttribute("data-ly-document-styles", "preview");
  });

  it("keeps the sheet untouched during a live drag while the node paints its live geometry inline", () => {
    useEditorStore.setState({ document: freeDocument() });
    render(<Surface />);
    const mutations = countSheetMutations();

    act(() => {
      useEditorStore.getState().beginResizeTransaction();
      for (let frame = 1; frame <= 20; frame += 1)
        useEditorStore
          .getState()
          .setFreeChildGeometryLive("box", { ...FREE_BOX, x: 10 + frame });
    });

    expect(mutations()).toBe(0);
    expect(sheetText()).toContain("left: 10px");
    expect(box()).toHaveAttribute("data-ly-gesture-override", "free-geometry");
    expect(box().style.left).toBe("30px");
    expect(getComputedStyle(box()).left).toBe("30px");
  });

  it("on commit, updates the sheet before the element drops its override, then paints from the sheet alone", () => {
    useEditorStore.setState({ document: freeDocument() });
    render(<Surface />);
    act(() => {
      useEditorStore.getState().beginResizeTransaction();
      useEditorStore
        .getState()
        .setFreeChildGeometryLive("box", { ...FREE_BOX, x: 55 });
    });

    // Subscribed after the sheet's own subscription, so it runs after it in the same store write.
    let atCommit: { sheet: string; override: string | null } | null = null;
    const unsubscribe = useEditorStore.subscribe(() => {
      atCommit ??= {
        sheet: sheetText(),
        override: box().getAttribute("data-ly-gesture-override"),
      };
    });
    act(() => useEditorStore.getState().commitResizeTransaction());
    unsubscribe();

    // Inside the commit write: the sheet already holds the committed geometry while the override is still painted.
    expect(atCommit).not.toBeNull();
    expect(atCommit!.sheet).toContain("left: 55px");
    expect(atCommit!.override).toBe("free-geometry");
    // After React re-rendered: the override is gone and the sheet alone paints the same geometry.
    expect(box()).not.toHaveAttribute("data-ly-gesture-override");
    expect(box().style).toHaveLength(0);
    expect(getComputedStyle(box()).left).toBe("55px");
  });

  it("on cancel, restores exactly: zero sheet mutations for the whole gesture and no override left", () => {
    useEditorStore.setState({ document: freeDocument() });
    render(<Surface />);
    const before = sheetText();
    const mutations = countSheetMutations();

    act(() => {
      const store = useEditorStore.getState();
      store.beginResizeTransaction();
      for (let frame = 1; frame <= 10; frame += 1)
        useEditorStore
          .getState()
          .setFreeChildGeometryLive("box", { ...FREE_BOX, width: 80 + frame });
      useEditorStore
        .getState()
        .restoreFreeLayoutsLive(new Map([["box", FREE_BOX]]));
      useEditorStore.getState().cancelResizeTransaction();
    });

    expect(mutations()).toBe(0);
    expect(sheetText()).toBe(before);
    expect(box()).not.toHaveAttribute("data-ly-gesture-override");
    expect(box().style).toHaveLength(0);
    expect(getComputedStyle(box()).width).toBe("80px");
  });

  it("updates only the edited node's rules for an ordinary edit", () => {
    useEditorStore.setState({ document: freeDocument() });
    render(<Surface />);
    const mutations = countSheetMutations();
    act(() =>
      useEditorStore
        .getState()
        .setFreeChildGeometry("box", { ...FREE_BOX, y: 99 }),
    );
    // The box's own base rule: one delete and one insert.
    expect(mutations()).toBe(2);
    expect(getComputedStyle(box()).top).toBe("99px");
  });
});
