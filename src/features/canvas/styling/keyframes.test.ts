// @vitest-environment node
import { describe, expect, it } from "vitest";
import { compileKeyframes } from "@/features/canvas/styling/compileKeyframes";
import {
  DocumentStyleCompiler,
  KEYFRAMES_OWNER,
} from "@/features/canvas/styling/documentStyleCompiler";
import {
  keyframeRefsOf,
  keyframesCssIdentifiers,
  referencedKeyframes,
} from "@/features/canvas/styling/keyframes";
import {
  printKeyframes,
  StylePrintError,
} from "@/features/canvas/styling/printStyleRules";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { KeyframesDefinition } from "@/features/editor/types/styleAssets";
import { everyFactoryDocument } from "@/features/project/utils/projectTestDocuments";
import { exportHtmlCss } from "@/features/export/utils/exportHtmlCss";

/*
 * BC-17.3.1 QA-4 — the keyframe dependency foundation (see keyframes.ts for
 * the implemented / deferred boundary). These tests run on the real model:
 * nothing can reference a definition before BC-17.11.
 */

const context = {
  parentLayoutMode: "flow" as const,
  isPreview: true,
  counterIdentifiers: new Map<string, string>(),
};

const pulse: KeyframesDefinition = {
  id: "keyframes-pulse",
  name: "Pulse",
  stops: [
    { offset: 100, groups: { filters: { opacity: 60 } } },
    { offset: 0, groups: { filters: { opacity: 100 } } },
  ],
};
const fade: KeyframesDefinition = {
  id: "keyframes-fade",
  name: "Fade in!",
  stops: [{ offset: 0, groups: { filters: { opacity: 0 } } }],
};

describe("keyframe foundation (BC-17.3.1 QA-4)", () => {
  it("the boundary: no node of any factory component references a keyframes definition before BC-17.11", () => {
    const document = everyFactoryDocument();
    expect(referencedKeyframes(document)).toEqual([]);
    const visit = (node: EditorElementNode) => {
      expect(keyframeRefsOf(node)).toEqual([]);
      node.children?.forEach(visit);
    };
    visit(document);
  });

  it("derives deterministic k- identifiers, with collision suffixes and a fallback for names without letters", () => {
    const identifiers = keyframesCssIdentifiers([
      pulse,
      fade,
      { id: "k3", name: "pulse", stops: pulse.stops },
      { id: "k4", name: "!!!", stops: pulse.stops },
    ]);
    expect([...identifiers]).toEqual([
      ["keyframes-pulse", "k-pulse"],
      ["keyframes-fade", "k-fade-in"],
      ["k3", "k-pulse-2"],
      ["k4", "k-keyframes"],
    ]);
    expect(keyframesCssIdentifiers([pulse, fade])).toEqual(
      keyframesCssIdentifiers([pulse, fade]),
    );
  });

  it("compiles only the referenced definitions, each once, in definition order, stops in offset order, values validated", () => {
    const diagnostics: string[] = [];
    const bad: KeyframesDefinition = {
      id: "k-bad",
      name: "Bad",
      stops: [{ offset: 0, groups: { typography: { color: "red; x: y" } } }],
    };
    const compiled = compileKeyframes(
      [pulse, fade, bad],
      ["k-bad", "keyframes-pulse", "keyframes-pulse"],
      context,
      (diagnostic) => diagnostics.push(diagnostic.code),
    );
    expect(compiled.map((entry) => entry.name)).toEqual(["k-pulse", "k-bad"]);
    expect(compiled[0].stops.map((stop) => stop.offset)).toEqual([0, 100]);
    expect(compiled[0].stops[0].declarations).toEqual([["opacity", "1"]]);
    expect(compiled[1].stops[0].declarations).toEqual([]);
    // Refused by the structural check (";" could break out of the declaration) before colour validation.
    expect(diagnostics).toEqual(["invalid-css-value"]);
    expect(compileKeyframes([pulse, fade], [], context)).toEqual([]);
    expect(compileKeyframes([pulse], ["missing"], context)).toEqual([]);
  });

  it("prints one @keyframes block and refuses names and offsets it did not generate", () => {
    expect(
      printKeyframes({
        name: "k-pulse",
        stops: [
          { offset: 0, declarations: [["opacity", "1"]] },
          { offset: 100, declarations: [["opacity", "0.6"]] },
        ],
      }),
    ).toBe(
      "@keyframes k-pulse {\n  0% {\n    opacity: 1;\n  }\n  100% {\n    opacity: 0.6;\n  }\n}",
    );
    expect(() => printKeyframes({ name: "pulse} body{", stops: [] })).toThrow(
      StylePrintError,
    );
    expect(() =>
      printKeyframes({
        name: "k-x",
        stops: [{ offset: 120, declarations: [] }],
      }),
    ).toThrow(StylePrintError);
  });

  it("a keyframes definition edit with no references recompiles nothing and emits no chunk, on the Canvas and in the export", () => {
    const base: EditorElementNode = {
      id: "page-root",
      tag: "page",
      styleAssets: { keyframes: [pulse] },
      children: [
        { id: "p", tag: "p", text: "x", typography: { color: "#111111" } },
      ],
    };
    const compiler = new DocumentStyleCompiler("preview");
    compiler.update(base);
    const change = compiler.update({
      ...base,
      styleAssets: { keyframes: [{ ...pulse, name: "Throb" }, fade] },
    });
    expect(compiler.lastStats.compiled).toBe(0);
    expect(change.changed.has(KEYFRAMES_OWNER)).toBe(false);
    expect(compiler.printSheet()).not.toContain("@keyframes");
    const withDefinitions = exportHtmlCss(base, {
      mode: "separate",
      title: "QA-4",
    });
    const without = exportHtmlCss(
      { ...base, styleAssets: undefined },
      { mode: "separate", title: "QA-4" },
    );
    expect(withDefinitions.files).toEqual(without.files);
  });
});
