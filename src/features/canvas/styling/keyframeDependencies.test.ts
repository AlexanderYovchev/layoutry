// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { KeyframesDefinition } from "@/features/editor/types/styleAssets";

/*
 * BC-17.3.1 QA-4 — the keyframe DEPENDENCY path, exercised ahead of
 * BC-17.11. No field of the current model can reference a definition, so
 * keyframeRefsOf (the single discovery point) is stubbed here: a node whose
 * displayName is "anim:<definition id>" references that definition. Every
 * other part — IR refs, cache keys, invalidation, the once-per-id chunk,
 * the CSSOM host — is the real implementation.
 */

vi.mock("@/features/canvas/styling/keyframes", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/features/canvas/styling/keyframes")
    >();
  return {
    ...actual,
    keyframeRefsOf: (node: EditorElementNode) =>
      node.displayName?.startsWith("anim:") ? [node.displayName.slice(5)] : [],
  };
});

const { compileDocumentSheet, DocumentStyleCompiler, KEYFRAMES_OWNER } =
  await import("@/features/canvas/styling/documentStyleCompiler");
const { StyleSheetHost } =
  await import("@/features/canvas/utils/styleSheetHost");

afterEach(() => {
  for (const element of document.querySelectorAll("style")) element.remove();
});

const pulse: KeyframesDefinition = {
  id: "keyframes-pulse",
  name: "Pulse",
  stops: [
    { offset: 0, groups: { filters: { opacity: 100 } } },
    { offset: 100, groups: { filters: { opacity: 60 } } },
  ],
};
const spin: KeyframesDefinition = {
  id: "keyframes-spin",
  name: "Spin",
  stops: [{ offset: 100, groups: { transform: { rotateDeg: 360 } } }],
};

function documentWith(definitions: KeyframesDefinition[]): EditorElementNode {
  return {
    id: "page-root",
    tag: "page",
    styleAssets: { keyframes: definitions },
    children: [
      { id: "a", tag: "div", displayName: "anim:keyframes-pulse" },
      { id: "b", tag: "div", displayName: "anim:keyframes-pulse" },
      { id: "c", tag: "div", displayName: "anim:keyframes-spin" },
      ...Array.from({ length: 50 }, (_, index) => ({
        id: `p-${index}`,
        tag: "p",
        text: `P${index}`,
      })),
    ],
  };
}

const keyframesBlocks = (sheet: string) =>
  sheet.match(/@keyframes [a-z0-9-]+/g) ?? [];

describe("keyframe dependencies (BC-17.3.1 QA-4, references stubbed)", () => {
  it("emits each referenced definition exactly once, however many nodes reference it, and records the refs in the IR", () => {
    const compiler = new DocumentStyleCompiler("preview");
    compiler.update(documentWith([pulse, spin]));
    expect(keyframesBlocks(compiler.printSheet())).toEqual([
      "@keyframes k-pulse",
      "@keyframes k-spin",
    ]);
    expect(compiler.irOf("a")?.keyframeRefs).toEqual(["keyframes-pulse"]);
    expect(compiler.printSheet()).toBe(
      compileDocumentSheet(documentWith([pulse, spin]), "preview"),
    );
  });

  it("renaming one definition recompiles exactly its dependants and replaces the keyframes chunk; incremental == full", () => {
    const initial = documentWith([pulse, spin]);
    const compiler = new DocumentStyleCompiler("preview");
    compiler.update(initial);
    const renamed: EditorElementNode = {
      ...initial,
      styleAssets: { keyframes: [{ ...pulse, name: "Throb" }, spin] },
    };
    const change = compiler.update(renamed);
    // Exactly the two dependants recompile (c and the 50 paragraphs do not). Their own CSS does not change yet —
    // no node prints animation-name before BC-17.11 — so only the keyframes chunk is rewritten.
    expect(compiler.lastStats.compiled).toBe(2);
    expect([...change.changed.keys()]).toEqual([KEYFRAMES_OWNER]);
    expect(keyframesBlocks(compiler.printSheet())).toEqual([
      "@keyframes k-throb",
      "@keyframes k-spin",
    ]);
    expect(compiler.printSheet()).toBe(
      compileDocumentSheet(renamed, "preview"),
    );
  });

  it("editing only a definition's stops rewrites the chunk and recompiles no node", () => {
    const initial = documentWith([pulse, spin]);
    const compiler = new DocumentStyleCompiler("preview");
    compiler.update(initial);
    const edited: EditorElementNode = {
      ...initial,
      styleAssets: {
        keyframes: [
          {
            ...pulse,
            stops: [{ offset: 50, groups: { filters: { opacity: 10 } } }],
          },
          spin,
        ],
      },
    };
    const change = compiler.update(edited);
    expect(compiler.lastStats.compiled).toBe(0);
    expect([...change.changed.keys()]).toEqual([KEYFRAMES_OWNER]);
    expect(compiler.printSheet()).toContain("50% {");
    expect(compiler.printSheet()).toBe(compileDocumentSheet(edited, "preview"));
  });

  it("removing the last reference removes the definition from the sheet; removing all references removes the chunk", () => {
    const initial = documentWith([pulse, spin]);
    const compiler = new DocumentStyleCompiler("preview");
    compiler.update(initial);
    const withoutSpin: EditorElementNode = {
      ...initial,
      children: initial.children?.filter((child) => child.id !== "c"),
    };
    compiler.update(withoutSpin);
    expect(keyframesBlocks(compiler.printSheet())).toEqual([
      "@keyframes k-pulse",
    ]);
    const none: EditorElementNode = {
      ...initial,
      children: initial.children?.filter(
        (child) => !child.displayName?.startsWith("anim:"),
      ),
    };
    const change = compiler.update(none);
    expect(change.changed.get(KEYFRAMES_OWNER)).toBeNull();
    expect(compiler.printSheet()).not.toContain("@keyframes");
  });

  it("the CSSOM host installs the @keyframes rules and replaces them on change", () => {
    const host = new StyleSheetHost(document, "preview", "s1");
    const compiler = new DocumentStyleCompiler("preview", "s1");
    const initial = documentWith([pulse, spin]);
    host.apply(compiler.update(initial));
    const installed = () =>
      Array.from(
        document.querySelector<HTMLStyleElement>(
          "style[data-ly-document-styles]",
        )?.sheet?.cssRules ?? [],
      ).filter((rule) => rule.cssText.startsWith("@keyframes")).length;
    expect(installed()).toBe(2);
    host.apply(
      compiler.update({ ...initial, styleAssets: { keyframes: [pulse] } }),
    );
    // "Spin" is gone from the definitions: only k-pulse can still be printed.
    expect(installed()).toBe(1);
  });
});
