// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  compileDocumentSheet,
  DocumentStyleCompiler,
} from "@/features/canvas/styling/documentStyleCompiler";
import { createElementNode } from "@/features/editor/factories/elementFactories";
import type { EditorElementNode } from "@/features/editor/types/document";
import { everyFactoryDocument } from "@/features/project/utils/projectTestDocuments";

/*
 * BC-17.3 — the incremental compiler must always equal a fresh full
 * compilation of the same document, whatever sequence of edits led there
 * (insertions, deletions, reordering, reparenting, base-style and
 * parent-context changes, counter definition changes, snapshot
 * replacement as Undo/Redo does, and surfaces).
 */

/** Mulberry32: a small seeded PRNG, so every failure is reproducible from its seed. */
function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const CONTAINERS = new Set([
  "div",
  "section",
  "nav",
  "header",
  "footer",
  "main",
  "article",
  "aside",
  "form",
  "label",
  "ul",
  "ol",
  "fieldset",
  "figure",
]);

function all(
  root: EditorElementNode,
): { node: EditorElementNode; parent?: EditorElementNode }[] {
  const out: { node: EditorElementNode; parent?: EditorElementNode }[] = [];
  const walk = (node: EditorElementNode, parent?: EditorElementNode) => {
    out.push({ node, parent });
    for (const child of node.children ?? []) walk(child, node);
  };
  walk(root);
  return out;
}

function replace(
  root: EditorElementNode,
  id: string,
  update: (node: EditorElementNode) => EditorElementNode | null,
): EditorElementNode {
  const visit = (node: EditorElementNode): EditorElementNode | null => {
    if (node.id === id) return update(node);
    if (!node.children) return node;
    let changed = false;
    const children: EditorElementNode[] = [];
    for (const child of node.children) {
      const next = visit(child);
      if (next !== child) changed = true;
      if (next) children.push(next);
    }
    return changed ? { ...node, children } : node;
  };
  return visit(root) ?? root;
}

let counter = 0;
const freshId = () => `x${(counter += 1)}`;

function withFreshIds(node: EditorElementNode): EditorElementNode {
  return {
    ...node,
    id: freshId(),
    ...(node.children ? { children: node.children.map(withFreshIds) } : {}),
  };
}

type Edit = (
  document: EditorElementNode,
  rand: () => number,
) => EditorElementNode;
const pick = <T>(items: readonly T[], rand: () => number): T =>
  items[Math.floor(rand() * items.length)];

const edits: Record<string, Edit> = {
  insert(document, rand) {
    const containers = all(document).filter(
      ({ node }) => node.tag === "page" || CONTAINERS.has(node.tag),
    );
    const target = pick(containers, rand).node;
    const added = withFreshIds(
      createElementNode(
        pick(
          [
            "paragraph",
            "heading",
            "primaryButton",
            "container",
            "image",
            "basicCard",
          ] as const,
          rand,
        ),
      ),
    );
    return replace(document, target.id, (node) => ({
      ...node,
      children: [...(node.children ?? []), added],
    }));
  },
  remove(document, rand) {
    const candidates = all(document).filter(({ parent }) => parent);
    if (candidates.length === 0) return document;
    return replace(document, pick(candidates, rand).node.id, () => null);
  },
  reorder(document, rand) {
    const parents = all(document).filter(
      ({ node }) => (node.children?.length ?? 0) > 1,
    );
    if (parents.length === 0) return document;
    return replace(document, pick(parents, rand).node.id, (node) => ({
      ...node,
      children: [...(node.children ?? [])].reverse(),
    }));
  },
  reparent(document, rand) {
    const movable = all(document).filter(
      ({ parent }) => parent && parent.tag !== "page",
    );
    if (movable.length === 0) return document;
    const { node: moving } = pick(movable, rand);
    const without = replace(document, moving.id, () => null);
    const ids = new Set(all(moving).map(({ node }) => node.id));
    const destinations = all(without).filter(
      ({ node }) =>
        (node.tag === "page" || CONTAINERS.has(node.tag)) && !ids.has(node.id),
    );
    const destination = pick(destinations, rand).node;
    return replace(without, destination.id, (node) => ({
      ...node,
      children: [moving, ...(node.children ?? [])],
    }));
  },
  restyle(document, rand) {
    const target = pick(all(document), rand).node;
    const color = pick(["#ef4444", "#22c55e", "#3b82f6"], rand);
    return replace(document, target.id, (node) => ({
      ...node,
      background: { color },
      styleRules:
        rand() < 0.5
          ? [
              {
                id: freshId(),
                target: "element",
                condition: { self: ["hover"] },
                groups: { background: { color } },
              },
            ]
          : node.styleRules,
    }));
  },
  parentContext(document, rand) {
    const containers = all(document).filter(
      ({ node }) =>
        CONTAINERS.has(node.tag) && node.tag !== "ul" && node.tag !== "ol",
    );
    if (containers.length === 0) return document;
    const display = pick(["block", "flex", "grid"] as const, rand);
    return replace(document, pick(containers, rand).node.id, (node) => ({
      ...node,
      flowLayout: { display },
    }));
  },
  counters(document, rand) {
    const names = rand() < 0.5 ? ["Steps"] : ["Steps", "Chapters"];
    const withAssets = {
      ...document,
      styleAssets: {
        counters: names.map((name, index) => ({
          id: `counter-${index}`,
          name: index === 0 && rand() < 0.5 ? `${name} renamed` : name,
        })),
      },
    };
    const target = pick(
      all(withAssets).filter(({ parent }) => parent),
      rand,
    )?.node;
    if (!target) return withAssets;
    return replace(withAssets, target.id, (node) => ({
      ...node,
      counters: {
        increment: [{ counter: { kind: "document", id: "counter-0" } }],
      },
    }));
  },
  ancestorRule(document, rand) {
    const nested = all(document).filter(
      ({ parent }) => parent && parent.tag !== "page",
    );
    if (nested.length === 0) return document;
    return replace(document, pick(nested, rand).node.id, (node) => ({
      ...node,
      styleRules: [
        {
          id: freshId(),
          target: "element",
          condition: { ancestor: { scope: { kind: "parent" }, atom: "hover" } },
          groups: { filters: { opacity: 0.8 } },
        },
      ],
    }));
  },
};

describe("DocumentStyleCompiler: incremental = full rebuild", () => {
  for (const surface of ["design", "preview"] as const) {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      it(`${surface}, seed ${seed}: 40 random edits, with Undo/Redo snapshot replacement`, () => {
        const rand = random(seed);
        let document = everyFactoryDocument();
        const history: EditorElementNode[] = [document];
        const compiler = new DocumentStyleCompiler(surface);
        compiler.update(document);
        const names = Object.keys(edits);
        for (let step = 0; step < 40; step += 1) {
          const name =
            rand() < 0.15 && history.length > 1 ? "undo" : pick(names, rand);
          document =
            name === "undo" ? pick(history, rand) : edits[name](document, rand);
          if (name !== "undo") history.push(document);
          compiler.update(document);
          const expected = compileDocumentSheet(document, surface);
          const actual = compiler.printSheet();
          if (actual !== expected)
            throw new Error(
              `seed ${seed}, step ${step} (${name}): the incremental sheet differs from a full rebuild`,
            );
        }
        expect(compiler.printSheet()).toBe(
          compileDocumentSheet(document, surface),
        );
      });
    }
  }

  it("recompiles only the edited node, not its recreated ancestors", () => {
    const document = everyFactoryDocument();
    const compiler = new DocumentStyleCompiler("design");
    compiler.update(document);
    const leaf = all(document).find(
      ({ node, parent }) => node.tag === "p" && parent && parent.tag !== "page",
    )!.node;
    compiler.update(
      replace(document, leaf.id, (node) => ({
        ...node,
        typography: { color: "#123456" },
      })),
    );
    expect(compiler.lastStats.compiled).toBe(1);
    expect(compiler.lastStats.changed).toBe(1);
  });

  it("removes every entry of a deleted subtree, and a different document leaves nothing behind", () => {
    const document = everyFactoryDocument();
    const compiler = new DocumentStyleCompiler("design");
    compiler.update(document);
    const subtree = all(document).find(
      ({ node, parent }) => (node.children?.length ?? 0) > 0 && parent,
    )!.node;
    const removed = new Set(all(subtree).map(({ node }) => node.id));
    const change = compiler.update(replace(document, subtree.id, () => null));
    for (const id of removed) expect(change.changed.get(id)).toBeNull();
    for (const id of removed) expect(compiler.chunks().has(id)).toBe(false);
    compiler.update({
      id: "other-root",
      tag: "page",
      children: [{ id: "only", tag: "p", text: "x" }],
    });
    expect([...compiler.chunks().keys()].sort()).toEqual([
      "only",
      "other-root",
    ]);
  });

  it("during a live gesture compiles the committed node, so the sheet doesn't change while the live geometry does", () => {
    const committed: EditorElementNode = {
      id: "page-root",
      tag: "page",
      children: [
        {
          id: "free",
          tag: "div",
          layoutMode: "free",
          children: [
            {
              id: "c",
              tag: "p",
              text: "x",
              freeLayout: { x: 10, y: 10, width: 40, height: 20 },
            },
          ],
        },
      ],
    };
    const compiler = new DocumentStyleCompiler("design");
    compiler.update(committed);
    const before = compiler.printSheet();
    const committedChild = committed.children![0].children![0];
    for (let frame = 1; frame <= 20; frame += 1) {
      const live = replace(committed, "c", (node) => ({
        ...node,
        freeLayout: { x: 10 + frame, y: 10 + frame, width: 40, height: 20 },
      }));
      const change = compiler.update(live, {
        nodeIds: new Set(["c"]),
        committedNode: (id) => (id === "c" ? committedChild : undefined),
      });
      expect(change.changed.size).toBe(0);
    }
    expect(compiler.printSheet()).toBe(before);
    // Commit: the live document becomes committed; one change, the new geometry.
    const final = replace(committed, "c", (node) => ({
      ...node,
      freeLayout: { x: 30, y: 30, width: 40, height: 20 },
    }));
    expect(compiler.update(final).changed.size).toBe(1);
    expect(compiler.printSheet()).toContain("left: 30px;");
    // Cancel instead: back to the committed snapshot — the text equals what is printed, so nothing changes.
    expect(compiler.update(committed).changed.size).toBe(1);
    expect(compiler.printSheet()).toBe(before);
  });

  it("a gesture that ends on the SAME document object (a store commit only clears the gesture) still compiles the final geometry", () => {
    const committed: EditorElementNode = {
      id: "page-root",
      tag: "page",
      children: [
        {
          id: "free",
          tag: "div",
          layoutMode: "free",
          children: [
            {
              id: "c",
              tag: "p",
              text: "x",
              freeLayout: { x: 10, y: 10, width: 40, height: 20 },
            },
          ],
        },
      ],
    };
    const committedChild = committed.children![0].children![0];
    const view = {
      nodeIds: new Set(["c"]),
      committedNode: (id: string) => (id === "c" ? committedChild : undefined),
    };
    const compiler = new DocumentStyleCompiler("design");
    compiler.update(committed);
    const live = replace(committed, "c", (node) => ({
      ...node,
      freeLayout: { x: 30, y: 30, width: 40, height: 20 },
    }));
    expect(compiler.update(live, view).changed.size).toBe(0);
    // Commit: identical document, no live view any more.
    expect(compiler.update(live).changed.size).toBe(1);
    expect(compiler.printSheet()).toContain("left: 30px;");
    expect(compiler.printSheet()).toBe(compileDocumentSheet(live, "design"));
    // Cancel path: the live write restored to the committed values, then the gesture ends — nothing to change.
    const restarted = new DocumentStyleCompiler("design");
    restarted.update(committed);
    restarted.update(live, view);
    const restored = replace(live, "c", () => committedChild);
    expect(restarted.update(restored, view).changed.size).toBe(0);
    expect(restarted.update(restored).changed.size).toBe(0);
    expect(restarted.printSheet()).toBe(
      compileDocumentSheet(committed, "design"),
    );
  });
});
