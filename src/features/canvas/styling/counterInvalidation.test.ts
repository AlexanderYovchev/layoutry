// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  compileDocumentSheet,
  DocumentStyleCompiler,
} from "@/features/canvas/styling/documentStyleCompiler";
import { StyleSheetHost } from "@/features/canvas/utils/styleSheetHost";
import type { EditorElementNode } from "@/features/editor/types/document";

/*
 * BC-17.3.1 QA-3 — counter dependency invalidation. A counter definition
 * change (renaming changes its CSS identifier) must recompile exactly the
 * nodes that reference THAT counter: not the unrelated elements, and not
 * the nodes that reference another, unchanged counter. Traversal, cache
 * lookups, recompilations and actual sheet mutations are measured apart.
 */

afterEach(() => {
  for (const element of document.querySelectorAll("style")) element.remove();
});

const UNRELATED = 200;

/** The same document with other counter names: the root is new, every element keeps its identity (as a store edit of the definitions does). */
function renamed(
  document: EditorElementNode,
  names: Record<string, string>,
): EditorElementNode {
  return {
    ...document,
    styleAssets: {
      ...document.styleAssets,
      counters: (document.styleAssets?.counters ?? []).map((counter) => ({
        ...counter,
        name: names[counter.id] ?? counter.name,
      })),
    },
  };
}

function documentWith(counterX: string, counterY = "Other"): EditorElementNode {
  const unrelated: EditorElementNode[] = Array.from(
    { length: UNRELATED },
    (_, index) => ({
      id: `p-${index}`,
      tag: "p",
      text: `P${index}`,
      typography: { color: "#333333" },
    }),
  );
  return {
    id: "page-root",
    tag: "page",
    styleAssets: {
      counters: [
        { id: "counter-x", name: counterX },
        { id: "counter-y", name: counterY },
      ],
    },
    children: [
      {
        id: "steps",
        tag: "section",
        counters: {
          reset: [{ counter: { kind: "document", id: "counter-x" } }],
        },
        children: [
          ...["h-1", "h-2"].map((id) => ({
            id,
            tag: "h2",
            text: id,
            counters: {
              increment: [
                { counter: { kind: "document" as const, id: "counter-x" } },
              ],
            },
            styleRules: [
              {
                id: `${id}-before`,
                target: "before" as const,
                condition: {},
                groups: {},
                content: {
                  kind: "parts" as const,
                  parts: [
                    {
                      kind: "counter" as const,
                      counter: { kind: "document" as const, id: "counter-x" },
                      style: {
                        kind: "predefined" as const,
                        style: "decimal" as const,
                      },
                    },
                  ],
                },
              },
            ],
          })),
        ],
      },
      {
        id: "other",
        tag: "div",
        counters: {
          increment: [{ counter: { kind: "document", id: "counter-y" } }],
        },
      },
      ...unrelated,
    ],
  };
}

describe("counter dependency invalidation (BC-17.3.1 QA-3)", () => {
  for (const surface of ["design", "preview"] as const) {
    it(`${surface}: renaming one counter recompiles only its dependants and rewrites only their rules`, () => {
      const compiler = new DocumentStyleCompiler(surface, "s1");
      const host = new StyleSheetHost(document, surface, "s1");
      const initial = documentWith("Steps");
      host.apply(compiler.update(initial));
      const before = host.mutations;

      const next = renamed(initial, { "counter-x": "Stages" });
      const change = compiler.update(next);
      host.apply(change);
      const stats = compiler.lastStats;
      const measured = {
        visited: stats.visited,
        compiled: stats.compiled,
        changed: stats.changed,
        mutations: host.mutations - before,
      };
      // Measured (BC-17.3.1 report): 205 visited, 3 recompiled, 3 changed, 10 sheet mutations (1 base rule each + the headings' ::before).
      expect(measured).toEqual({
        visited: 205,
        compiled: 3,
        changed: 3,
        mutations: 10,
      });

      // The three nodes that use counter-x (the reset on the section, the increments and the content on the headings).
      expect([...change.changed.keys()].sort()).toEqual([
        "h-1",
        "h-2",
        "steps",
      ]);
      expect(stats.compiled).toBe(3);
      expect(stats.changed).toBe(3);
      // Still identical to a full rebuild.
      expect(compiler.printSheet()).toBe(
        compileDocumentSheet(next, surface, "s1"),
      );
      expect(compiler.printSheet()).toContain("c-stages");
      expect(compiler.printSheet()).not.toContain("c-steps");
    });
  }

  it("renaming a counter nothing references recompiles nothing", () => {
    const compiler = new DocumentStyleCompiler("design");
    const initial = documentWith("Steps", "Other");
    compiler.update(initial);
    const change = compiler.update({
      ...initial,
      styleAssets: {
        counters: [
          ...(initial.styleAssets?.counters ?? []),
          { id: "counter-z", name: "Unused" },
        ],
      },
    });
    expect(compiler.lastStats.compiled).toBe(0);
    expect(change.changed.size).toBe(0);
    // No cached node depends on a changed identifier, so no subtree is walked: the new root, then one cache
    // lookup per direct child (each unchanged, skipped at once) — the section's headings are never reached.
    expect(compiler.lastStats.visited).toBe(
      1 + (initial.children?.length ?? 0),
    );
  });

  it("adding a definition that shifts a collision suffix recompiles the node whose identifier changed", () => {
    // Two definitions with the same slug: the second gets "-2". Removing the first renames the second.
    const base = documentWith("Steps");
    const both = (names: string[]): EditorElementNode => ({
      ...base,
      styleAssets: {
        counters: names.map((name, index) => ({
          id: index === 0 ? "counter-a" : "counter-x",
          name,
        })),
      },
    });
    const compiler = new DocumentStyleCompiler("design");
    compiler.update(both(["Steps", "steps"]));
    expect(compiler.printSheet()).toContain("c-steps-2");
    compiler.update(both(["Renamed", "steps"]));
    // counter-x is now the only "steps": its identifier lost the suffix, so its three dependants recompiled.
    expect(compiler.lastStats.compiled).toBe(3);
    expect(compiler.printSheet()).not.toContain("c-steps-2");
    expect(compiler.printSheet()).toBe(
      compileDocumentSheet(both(["Renamed", "steps"]), "design"),
    );
  });
});
