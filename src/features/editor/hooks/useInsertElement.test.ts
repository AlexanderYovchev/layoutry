import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { selectionFromSingle } from "@/features/editor/types/selection";
import { useInsertElement } from "./useInsertElement";

const initialState = useEditorStore.getState();

describe("useInsertElement", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("inserts into the requested target when it can accept children", () => {
    const { result } = renderHook(() => useInsertElement());

    result.current("button", "section-1");

    const section = useEditorStore
      .getState()
      .document.children?.find((child) => child.id === "section-1");
    expect(section?.children?.at(-1)?.tag).toBe("button");
  });

  it("selects the newly inserted node", () => {
    const { result } = renderHook(() => useInsertElement());

    result.current("heading", "section-1");

    const state = useEditorStore.getState();
    const inserted = state.document.children
      ?.find((child) => child.id === "section-1")
      ?.children?.at(-1);
    expect(state.selection.primaryId).toBe(inserted?.id);
  });

  it("falls back to the document root when no target is requested and nothing is selected", () => {
    const { result } = renderHook(() => useInsertElement());

    result.current("container");

    const state = useEditorStore.getState();
    expect(state.document.children?.at(-1)?.tag).toBe("div");
  });

  it("targets the current selection when no explicit drop target is requested and the selection can contain children", () => {
    useEditorStore.setState({ selection: selectionFromSingle("section-1") });
    const { result } = renderHook(() => useInsertElement());

    result.current("button");

    const section = useEditorStore
      .getState()
      .document.children?.find((child) => child.id === "section-1");
    expect(section?.children?.at(-1)?.tag).toBe("button");
  });

  it("targets the current selection's parent when no explicit drop target is requested and the selection is a leaf", () => {
    useEditorStore.setState({ selection: selectionFromSingle("image-1") });
    const { result } = renderHook(() => useInsertElement());

    result.current("image");

    const section = useEditorStore
      .getState()
      .document.children?.find((child) => child.id === "section-2");
    expect(section?.children?.at(-1)?.tag).toBe("img");
    expect(section?.children).toHaveLength(2);
  });

  it("falls back to the document root when no explicit drop target is requested and the selected node no longer exists", () => {
    useEditorStore.setState({ selection: selectionFromSingle("does-not-exist") });
    const { result } = renderHook(() => useInsertElement());

    result.current("container");

    const state = useEditorStore.getState();
    expect(state.document.children?.at(-1)?.tag).toBe("div");
  });

  it("falls back to the document root when the requested target cannot accept children", () => {
    const { result } = renderHook(() => useInsertElement());

    result.current("button", "heading-1");

    const state = useEditorStore.getState();
    expect(state.document.children?.at(-1)?.tag).toBe("button");
  });

  it("falls back to the document root when the requested target does not exist", () => {
    const { result } = renderHook(() => useInsertElement());

    result.current("paragraph", "does-not-exist");

    const state = useEditorStore.getState();
    expect(state.document.children?.at(-1)?.tag).toBe("p");
  });

  it("inserts before the target as a sibling when zone is 'before'", () => {
    const { result } = renderHook(() => useInsertElement());

    result.current("heading", "heading-1", "before");

    const section = useEditorStore
      .getState()
      .document.children?.find((child) => child.id === "section-1");
    expect(section?.children?.map((child) => child.tag)).toEqual([
      "h1",
      "h1",
      "p",
      "button",
    ]);
  });

  it("inserts after the target as a sibling when zone is 'after'", () => {
    const { result } = renderHook(() => useInsertElement());

    result.current("paragraph", "heading-1", "after");

    const section = useEditorStore
      .getState()
      .document.children?.find((child) => child.id === "section-1");
    expect(section?.children?.map((child) => child.id)).toEqual([
      "heading-1",
      expect.stringMatching(/^p-/),
      "paragraph-1",
      "button-1",
    ]);
  });

  it("treats zone 'inside' the same as the default append behavior", () => {
    const { result } = renderHook(() => useInsertElement());

    result.current("button", "section-1", "inside");

    const section = useEditorStore
      .getState()
      .document.children?.find((child) => child.id === "section-1");
    expect(section?.children?.at(-1)?.tag).toBe("button");
  });

  it("inserts a Container into a Section (Checkpoint 1.2 — both tags accept the same insertable types via the shared containment rule)", () => {
    const { result } = renderHook(() => useInsertElement());

    result.current("container", "section-1");

    const section = useEditorStore
      .getState()
      .document.children?.find((child) => child.id === "section-1");
    expect(section?.children?.at(-1)?.tag).toBe("div");
  });

  it("inserts a Section into a Container", () => {
    // Two separate renderHook calls, not one reused across both inserts —
    // the hook closes over the store snapshot from its own render, so a
    // second insert needs a fresh render to see the first insert's result
    // (the store itself, read directly below, is always current).
    const { result: insertContainer } = renderHook(() => useInsertElement());
    insertContainer.current("container");
    const newContainerId = useEditorStore.getState().document.children?.at(-1)?.id;

    const { result: insertSection } = renderHook(() => useInsertElement());
    insertSection.current("section", newContainerId);

    const container = useEditorStore
      .getState()
      .document.children?.find((child) => child.id === newContainerId);
    expect(container?.children?.at(-1)?.tag).toBe("section");
  });

  it("inserts a Link into a Section (Checkpoint 1.4 — reuses the same shared containment rule, no Link-specific nesting logic)", () => {
    const { result } = renderHook(() => useInsertElement());

    result.current("link", "section-1");

    const section = useEditorStore
      .getState()
      .document.children?.find((child) => child.id === "section-1");
    expect(section?.children?.at(-1)?.tag).toBe("a");
  });

  it("inserts a Link into a Container", () => {
    const { result: insertContainer } = renderHook(() => useInsertElement());
    insertContainer.current("container");
    const newContainerId = useEditorStore.getState().document.children?.at(-1)?.id;

    const { result: insertLink } = renderHook(() => useInsertElement());
    insertLink.current("link", newContainerId);

    const container = useEditorStore
      .getState()
      .document.children?.find((child) => child.id === newContainerId);
    expect(container?.children?.at(-1)?.tag).toBe("a");
  });

  it("falls back to the default container when a before/after target is the document root", () => {
    const { result } = renderHook(() => useInsertElement());

    result.current("button", "page-root", "before");

    const state = useEditorStore.getState();
    expect(state.document.children?.at(-1)?.tag).toBe("button");
  });
});

describe("useInsertElement — constrained list nesting (Checkpoint 1.6)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("inserts an Unordered List into a Container", () => {
    const { result: insertContainer } = renderHook(() => useInsertElement());
    insertContainer.current("container");
    const containerId = useEditorStore.getState().document.children?.at(-1)?.id;

    const { result: insertList } = renderHook(() => useInsertElement());
    insertList.current("unorderedList", containerId);

    const container = useEditorStore.getState().document.children?.find((c) => c.id === containerId);
    expect(container?.children?.at(-1)?.tag).toBe("ul");
  });

  it("inserts an Ordered List into a Section", () => {
    const { result } = renderHook(() => useInsertElement());

    result.current("orderedList", "section-1");

    const section = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(section?.children?.at(-1)?.tag).toBe("ol");
  });

  it("inserts a List Item into a UL", () => {
    const { result: insertList } = renderHook(() => useInsertElement());
    insertList.current("unorderedList", "section-1");
    const listId = useEditorStore.getState().selection.primaryId;

    const { result: insertItem } = renderHook(() => useInsertElement());
    insertItem.current("listItem", listId!);

    const list = useEditorStore
      .getState()
      .document.children?.find((c) => c.id === "section-1")
      ?.children?.find((c) => c.id === listId);
    expect(list?.children).toHaveLength(4);
    expect(list?.children?.at(-1)?.tag).toBe("li");
  });

  it("inserts a List Item into an OL", () => {
    const { result: insertList } = renderHook(() => useInsertElement());
    insertList.current("orderedList", "section-1");
    const listId = useEditorStore.getState().selection.primaryId;

    const { result: insertItem } = renderHook(() => useInsertElement());
    insertItem.current("listItem", listId!);

    const list = useEditorStore
      .getState()
      .document.children?.find((c) => c.id === "section-1")
      ?.children?.find((c) => c.id === listId);
    expect(list?.children).toHaveLength(4);
  });

  it("rejects inserting a List Item directly into a Container — invalid HTML, silently no-ops rather than corrupting the tree", () => {
    const { result: insertContainer } = renderHook(() => useInsertElement());
    insertContainer.current("container");
    const containerId = useEditorStore.getState().document.children?.at(-1)?.id;
    const before = useEditorStore.getState().document;

    const { result: insertItem } = renderHook(() => useInsertElement());
    insertItem.current("listItem", containerId);

    expect(useEditorStore.getState().document).toBe(before);
  });

  it("rejects inserting a List Item directly into a Section", () => {
    const before = useEditorStore.getState().document;
    const { result } = renderHook(() => useInsertElement());

    result.current("listItem", "section-1");

    expect(useEditorStore.getState().document).toBe(before);
  });

  it("rejects inserting a Heading directly into a UL", () => {
    const { result: insertList } = renderHook(() => useInsertElement());
    insertList.current("unorderedList", "section-1");
    const listId = useEditorStore.getState().selection.primaryId;
    const before = useEditorStore.getState().document;

    const { result: insertHeading } = renderHook(() => useInsertElement());
    insertHeading.current("heading", listId!);

    expect(useEditorStore.getState().document).toBe(before);
  });

  it("rejects inserting an Image directly into an OL", () => {
    const { result: insertList } = renderHook(() => useInsertElement());
    insertList.current("orderedList", "section-1");
    const listId = useEditorStore.getState().selection.primaryId;
    const before = useEditorStore.getState().document;

    const { result: insertImage } = renderHook(() => useInsertElement());
    insertImage.current("image", listId!);

    expect(useEditorStore.getState().document).toBe(before);
  });

  it("rejects a List Item aimed at a leaf target that would otherwise fall back to the document root", () => {
    // Mirrors "falls back to the document root when the requested target
    // cannot accept children" above for an ordinary tag — but a List Item
    // has no meaning at the document root either, so this must reject
    // rather than fall back and corrupt the tree with a bare <li> under
    // <page>.
    const before = useEditorStore.getState().document;
    const { result } = renderHook(() => useInsertElement());

    result.current("listItem", "heading-1");

    expect(useEditorStore.getState().document).toBe(before);
  });

  it("confirms existing Container/Section relationships remain unrestricted after the list nesting extension (regression)", () => {
    const { result } = renderHook(() => useInsertElement());

    result.current("heading", "section-1");
    result.current("image", "section-1");

    const section = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(section?.children?.some((c) => c.tag === "h1")).toBe(true);
    expect(section?.children?.some((c) => c.tag === "img")).toBe(true);
  });
});

describe("useInsertElement — semantic sectioning family (Checkpoint 1.8)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("inserts a Header into a Section", () => {
    const { result } = renderHook(() => useInsertElement());

    result.current("header", "section-1");

    const section = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(section?.children?.at(-1)?.tag).toBe("header");
  });

  it("inserts a Container into a Header", () => {
    const { result: insertHeader } = renderHook(() => useInsertElement());
    insertHeader.current("header", "section-1");
    const headerId = useEditorStore.getState().selection.primaryId;

    const { result: insertContainer } = renderHook(() => useInsertElement());
    insertContainer.current("container", headerId!);

    const header = useEditorStore
      .getState()
      .document.children?.find((c) => c.id === "section-1")
      ?.children?.find((c) => c.id === headerId);
    expect(header?.children?.at(-1)?.tag).toBe("div");
  });

  it("inserts a Nav into a Header, and a Link into that Nav", () => {
    const { result: insertHeader } = renderHook(() => useInsertElement());
    insertHeader.current("header", "section-1");
    const headerId = useEditorStore.getState().selection.primaryId;

    const { result: insertNav } = renderHook(() => useInsertElement());
    insertNav.current("nav", headerId!);
    const navId = useEditorStore.getState().selection.primaryId;

    const { result: insertLink } = renderHook(() => useInsertElement());
    insertLink.current("link", navId!);

    const nav = useEditorStore
      .getState()
      .document.children?.find((c) => c.id === "section-1")
      ?.children?.find((c) => c.id === headerId)
      ?.children?.find((c) => c.id === navId);
    expect(nav?.children?.at(-1)?.tag).toBe("a");
  });

  it("inserts a Main into a Section, and a Section into that Main", () => {
    const { result: insertMain } = renderHook(() => useInsertElement());
    insertMain.current("main", "section-1");
    const mainId = useEditorStore.getState().selection.primaryId;

    const { result: insertSection } = renderHook(() => useInsertElement());
    insertSection.current("section", mainId!);

    const main = useEditorStore
      .getState()
      .document.children?.find((c) => c.id === "section-1")
      ?.children?.find((c) => c.id === mainId);
    expect(main?.children?.at(-1)?.tag).toBe("section");
  });

  it("inserts an Article with a Heading and a Paragraph", () => {
    const { result: insertArticle } = renderHook(() => useInsertElement());
    insertArticle.current("article", "section-1");
    const articleId = useEditorStore.getState().selection.primaryId;

    const { result: insertHeading } = renderHook(() => useInsertElement());
    insertHeading.current("heading", articleId!);
    const { result: insertParagraph } = renderHook(() => useInsertElement());
    insertParagraph.current("paragraph", articleId!);

    const article = useEditorStore
      .getState()
      .document.children?.find((c) => c.id === "section-1")
      ?.children?.find((c) => c.id === articleId);
    expect(article?.children?.map((c) => c.tag)).toEqual(["h1", "p"]);
  });

  it("inserts an Aside with a Paragraph", () => {
    const { result: insertAside } = renderHook(() => useInsertElement());
    insertAside.current("aside", "section-1");
    const asideId = useEditorStore.getState().selection.primaryId;

    const { result: insertParagraph } = renderHook(() => useInsertElement());
    insertParagraph.current("paragraph", asideId!);

    const aside = useEditorStore
      .getState()
      .document.children?.find((c) => c.id === "section-1")
      ?.children?.find((c) => c.id === asideId);
    expect(aside?.children?.at(-1)?.tag).toBe("p");
  });

  it("inserts a Footer with a Container inside it", () => {
    const { result: insertFooter } = renderHook(() => useInsertElement());
    insertFooter.current("footer", "section-1");
    const footerId = useEditorStore.getState().selection.primaryId;

    const { result: insertContainer } = renderHook(() => useInsertElement());
    insertContainer.current("container", footerId!);

    const footer = useEditorStore
      .getState()
      .document.children?.find((c) => c.id === "section-1")
      ?.children?.find((c) => c.id === footerId);
    expect(footer?.children?.at(-1)?.tag).toBe("div");
  });

  it("still rejects a List Item inserted directly into any of the six semantic containers (Checkpoint 1.6's constraint remains intact)", () => {
    for (const semanticType of ["header", "nav", "main", "article", "aside", "footer"] as const) {
      const { result: insertSemantic } = renderHook(() => useInsertElement());
      insertSemantic.current(semanticType, "section-1");
      const semanticId = useEditorStore.getState().selection.primaryId;
      const before = useEditorStore.getState().document;

      const { result: insertItem } = renderHook(() => useInsertElement());
      insertItem.current("listItem", semanticId!);

      expect(useEditorStore.getState().document, semanticType).toBe(before);
    }
  });

  it("still rejects an arbitrary semantic container inserted directly into a UL/OL (only li is a valid list child)", () => {
    const { result: insertList } = renderHook(() => useInsertElement());
    insertList.current("unorderedList", "section-1");
    const listId = useEditorStore.getState().selection.primaryId;
    const before = useEditorStore.getState().document;

    const { result: insertArticle } = renderHook(() => useInsertElement());
    insertArticle.current("article", listId!);

    expect(useEditorStore.getState().document).toBe(before);
  });
});

describe("useInsertElement — Free destinations (Checkpoint 3.4.4)", () => {
  const initialState = useEditorStore.getState();

  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  function makeSection1Free() {
    useEditorStore.getState().convertToFreeLayout("section-1", {
      "heading-1": { x: 16, y: 16, width: 240, height: 48 },
      "paragraph-1": { x: 16, y: 80, width: 240, height: 80 },
      "button-1": { x: 16, y: 176, width: 120, height: 40 },
    });
    // Give the container a large enough size that a non-overlapping grid
    // slot genuinely exists for a default-sized new element — approximateFreeContainerSize
    // falls back to a generous 400x300 otherwise, too tight for this test.
    useEditorStore
      .getState()
      .resizeElement("section-1", { preferredWidth: 900, preferredHeight: 700, offsetX: 0, offsetY: 0 });
  }

  it("assigns a deterministic freeLayout when inserting into a Free container", () => {
    makeSection1Free();
    const { result } = renderHook(() => useInsertElement());

    result.current("image", "section-1");

    const section = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    const inserted = section?.children?.at(-1);
    expect(inserted?.tag).toBe("img");
    expect(inserted?.freeLayout).toBeDefined();
  });

  it("never overlaps an existing Free sibling when inserting", () => {
    makeSection1Free();
    const { result } = renderHook(() => useInsertElement());

    result.current("image", "section-1");

    const section = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    const inserted = section!.children!.at(-1)!;
    for (const sibling of section!.children!.slice(0, -1)) {
      const a = inserted.freeLayout!;
      const b = sibling.freeLayout!;
      const overlaps = a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
      expect(overlaps).toBe(false);
    }
  });

  it("leaves freeLayout unset when inserting into a Flow container", () => {
    const { result } = renderHook(() => useInsertElement());

    result.current("image", "section-1");

    const section = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(section?.children?.at(-1)?.freeLayout).toBeUndefined();
  });
});
