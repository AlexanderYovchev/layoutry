import { describe, expect, it } from "vitest";
import { duplicateRootsInPlace, existingSelectedIds, orderedSelectionRoots, pasteCopiesInto } from "./multiClipboardCommands";
import type { EditorElementNode } from "@/features/editor/types/document";
import { cloneNodesWithFreshIds } from "@/features/editor/utils/cloneNodeWithFreshIds";
import { findNodeById } from "@/features/editor/utils/findNodeById";

/** BC-10.5 — the pure multi-element clipboard functions. */

/** Section A > [button, p, inner > deep], Section B > [q], list(ul) > [li] */
function root(): EditorElementNode {
  return {
    id: "page-root",
    tag: "page",
    children: [
      {
        id: "a",
        tag: "section",
        children: [
          { id: "button", tag: "button", text: "Go", interactions: [{ id: "i", trigger: "click", action: "toggle", targetId: "q" }] },
          { id: "p", tag: "p", text: "P" },
          { id: "inner", tag: "div", children: [{ id: "deep", tag: "p", text: "Deep" }] },
        ],
      },
      { id: "b", tag: "section", children: [{ id: "q", tag: "p", text: "Q" }] },
      { id: "list", tag: "ul", children: [{ id: "li", tag: "li", text: "Item" }] },
    ],
  };
}

describe("orderedSelectionRoots", () => {
  it("Section A + its Button + its Paragraph + Section B → A and B, each once, in document order", () => {
    const roots = orderedSelectionRoots(root(), ["b", "p", "button", "a"]);
    expect(roots.map((node) => node.id)).toEqual(["a", "b"]);
    // A's whole subtree, including the unselected nested div.
    expect(roots[0].children?.map((child) => child.id)).toEqual(["button", "p", "inner"]);
  });

  it("cross-container elements keep document order; missing ids and the page root are ignored", () => {
    expect(orderedSelectionRoots(root(), ["q", "ghost", "page-root", "deep"]).map((node) => node.id)).toEqual(["deep", "q"]);
    expect(existingSelectedIds(root(), ["q", "q", "ghost", "page-root"])).toEqual(["q"]);
  });
});

describe("cloneNodesWithFreshIds", () => {
  it("one map for the whole set: a reference into another cloned root is remapped; every id is fresh", () => {
    const [a, b] = cloneNodesWithFreshIds([findNodeById(root(), "a")!, findNodeById(root(), "b")!]);
    const qCopy = b.children![0].id;
    expect(qCopy).not.toBe("q");
    expect(a.children![0].interactions![0].targetId).toBe(qCopy);
    expect(a.children![0].interactions![0].id).not.toBe("i");
    expect(a.children![2].children![0].id).not.toBe("deep");
  });

  it("alone, a root's reference outside it is left as it was", () => {
    const [a] = cloneNodesWithFreshIds([findNodeById(root(), "a")!]);
    expect(a.children![0].interactions![0].targetId).toBe("q");
  });
});

describe("pasteCopiesInto", () => {
  it("appends every copy to the one destination, in order", () => {
    const document = root();
    const result = pasteCopiesInto(document, "b", [findNodeById(document, "p")!, findNodeById(document, "inner")!]);
    if (!result.ok) throw new Error("rejected");
    const children = findNodeById(result.document, "b")!.children!;
    expect(children.map((child) => child.tag)).toEqual(["p", "p", "div"]);
    expect(children.slice(1).map((child) => child.id)).toEqual(result.rootIds);
    expect(children[2].children![0].text).toBe("Deep");
  });

  it("all or nothing: a destination that rejects one copy keeps the document as it was", () => {
    const document = root();
    expect(pasteCopiesInto(document, "list", [findNodeById(document, "li")!, findNodeById(document, "p")!])).toEqual({ ok: false, reason: "destination" });
    expect(pasteCopiesInto(document, "missing", [findNodeById(document, "p")!])).toEqual({ ok: false, reason: "destination" });
  });
});

describe("duplicateRootsInPlace", () => {
  it("each copy right after its original, in its own parent", () => {
    const document = root();
    const result = duplicateRootsInPlace(document, orderedSelectionRoots(document, ["q", "p"]));
    if (!result.ok) throw new Error("rejected");
    expect(findNodeById(result.document, "a")!.children!.map((child) => child.id)).toEqual(["button", "p", result.rootIds[0], "inner"]);
    expect(findNodeById(result.document, "b")!.children!.map((child) => child.id)).toEqual(["q", result.rootIds[1]]);
  });

  it("rejects the whole duplicate when a root has no parent (the page root)", () => {
    const document = root();
    expect(duplicateRootsInPlace(document, [document, findNodeById(document, "p")!])).toEqual({ ok: false, reason: "destination" });
  });
});
