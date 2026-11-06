import { describe, expect, it } from "vitest";
import type { EditorElementNode } from "@/features/editor/types/document";
import { buildExportDocument } from "@/features/export/utils/buildExportDocument";
import { printExportStylesheet } from "@/features/export/utils/printExportStylesheet";

function stylesheet(children: EditorElementNode[]): string {
  const built = buildExportDocument({ id: "page-root", tag: "page", children });
  if (!built.ok) throw new Error("unbuildable");
  return printExportStylesheet(built.document);
}

const transition = { property: "opacity" as const, durationMs: 500, timingFunction: "ease" as const, delayMs: 200 };

describe("printExportStylesheet — reduced motion (BC-02.5, B7)", () => {
  it("adds one reduced-motion block covering exactly the elements with an authored transition", () => {
    const css = stylesheet([
      { id: "a", tag: "div", transition },
      { id: "b", tag: "div" },
      { id: "c", tag: "p", text: "x", transition: { ...transition, delayMs: 0 } },
    ]);
    const blocks = css.match(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}/g) ?? [];
    expect(blocks).toHaveLength(1);
    const block = blocks[0] ?? "";
    expect(block).toContain("transition-duration: 0.01ms !important;");
    expect(block).toContain("transition-delay: 0s !important;");
    const selectors = /\{\n {2}([^{]+) \{/.exec(block)?.[1]?.split(", ") ?? [];
    expect(selectors).toHaveLength(2);
    expect(selectors.every((selector) => /^\.ly-node-\d+$/.test(selector))).toBe(true);
  });

  it("keeps the authored transition itself unchanged (normal motion is untouched)", () => {
    const css = stylesheet([{ id: "a", tag: "div", transition }]);
    const authored = css.slice(0, css.indexOf("@media (prefers-reduced-motion"));
    expect(authored).toContain("transition-duration: 500ms;");
    expect(authored).toContain("transition-delay: 200ms;");
  });

  it("adds nothing when no element has a transition", () => {
    expect(stylesheet([{ id: "a", tag: "div" }])).not.toContain("prefers-reduced-motion");
  });
});
